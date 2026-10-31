import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

async function runMigration() {
  console.log('--- Starting User Architecture Consolidation Migration ---');

  const dataDir = path.resolve(process.cwd(), 'data');
  const dbFilePath = path.join(dataDir, 'database.json');

  if (!fs.existsSync(dbFilePath)) {
    throw new Error(`database.json not found at ${dbFilePath}`);
  }

  const db = JSON.parse(fs.readFileSync(dbFilePath, 'utf8'));

  // 1. Deduplicate employees by ID
  const uniqueEmployees = [];
  const seenEmpIds = new Set();
  for (const emp of db.employees || []) {
    if (!seenEmpIds.has(emp.id)) {
      seenEmpIds.add(emp.id);
      uniqueEmployees.push(emp);
    }
  }
  console.log(`Employees: ${db.employees?.length || 0} -> ${uniqueEmployees.length} unique records`);

  // 2. Deduplicate users by lowercase email
  const usersByEmail = {};
  for (const u of db.users || []) {
    const em = (u.email || '').trim().toLowerCase();
    if (!usersByEmail[em]) usersByEmail[em] = [];
    usersByEmail[em].push(u);
  }

  const uniqueUsers = [];
  for (const em in usersByEmail) {
    const list = usersByEmail[em];
    if (list.length === 1) {
      uniqueUsers.push(list[0]);
    } else {
      // Pick the best user record (prefer one with non-empty bcrypt password)
      const withPw = list.find(u => u.password && (u.password.startsWith('$2a$') || u.password.startsWith('$2b$')));
      const chosen = withPw || list[0];
      console.log(`Deduplicating multiple users for email "${em}": retained user id ${chosen.id}`);
      uniqueUsers.push(chosen);
    }
  }
  console.log(`Users: ${db.users?.length || 0} -> ${uniqueUsers.length} unique accounts`);

  // 3. Normalize User records & link to Employees/Companies
  for (const u of uniqueUsers) {
    const isSuper = u.role === 'SUPER_ADMIN' || u.isSuperAdmin === true;
    if (isSuper) {
      u.role = 'SUPER_ADMIN';
      u.isSuperAdmin = true;
      u.permissions = ['*'];
      u.companyId = null;
      u.companyCode = null;
      u.employeeId = null;
      u.employeeCode = null;
    } else if (u.role === 'EMPLOYEE') {
      const matchedEmp = uniqueEmployees.find(e =>
        e.id === u.employeeId ||
        e.userId === u.id ||
        (e.email && u.email && e.email.toLowerCase() === u.email.toLowerCase())
      );
      if (matchedEmp) {
        u.employeeId = matchedEmp.id;
        u.employeeCode = matchedEmp.employeeCode;
        u.companyId = matchedEmp.companyId || u.companyId;
        u.companyCode = matchedEmp.companyCode || u.companyCode;
        matchedEmp.userId = u.id;
      }
    } else if (u.role === 'ADMIN') {
      const comp = (db.companies || []).find(c => c.id === u.companyId || c.adminUserId === u.id);
      if (comp) {
        u.companyId = comp.id;
        u.companyCode = comp.companyCode;
      }
    }
  }

  // 4. Update JSON data
  db.employees = uniqueEmployees;
  db.users = uniqueUsers;

  const tempPath = `${dbFilePath}.tmp-${Date.now()}`;
  fs.writeFileSync(tempPath, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tempPath, dbFilePath);
  console.log('Saved consolidated database.json successfully.');

  // 5. Connect to MySQL and synchronize users table
  console.log('Connecting to MySQL database "hrms"...');
  const pool = mysql.createPool({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    database: 'hrms',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  // Ensure columns exist in MySQL users
  try {
    await pool.query('ALTER TABLE users ADD COLUMN employeeCode VARCHAR(50) NULL AFTER employeeId');
  } catch {}
  try {
    await pool.query('ALTER TABLE users ADD COLUMN permissions JSON NULL AFTER employeeCode');
  } catch {}

  // Sync users to MySQL
  const activeUserIds = uniqueUsers.map(u => u.id);
  if (activeUserIds.length > 0) {
    await pool.query('DELETE FROM users WHERE id NOT IN (?)', [activeUserIds]);
  } else {
    await pool.query('DELETE FROM users');
  }

  for (const u of uniqueUsers) {
    const isSuper = u.role === 'SUPER_ADMIN' || u.isSuperAdmin === true;
    const permissions = u.permissions
      ? (typeof u.permissions === 'string' ? u.permissions : JSON.stringify(u.permissions))
      : (isSuper ? JSON.stringify(['*']) : null);

    await pool.query(
      `INSERT INTO users (id, email, phone, password, firstName, lastName, role, isSuperAdmin, status, companyId, companyCode, employeeId, employeeCode, permissions, avatarUrl, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE email=VALUES(email), phone=VALUES(phone), password=VALUES(password), firstName=VALUES(firstName), lastName=VALUES(lastName), role=VALUES(role), isSuperAdmin=VALUES(isSuperAdmin), status=VALUES(status), companyId=VALUES(companyId), companyCode=VALUES(companyCode), employeeId=VALUES(employeeId), employeeCode=VALUES(employeeCode), permissions=VALUES(permissions), avatarUrl=VALUES(avatarUrl), updatedAt=VALUES(updatedAt)`,
      [
        u.id,
        u.email,
        u.phone || '',
        u.password || null,
        u.firstName || '',
        u.lastName || '',
        u.role,
        isSuper ? 1 : 0,
        u.status || 'Active',
        isSuper ? null : (u.companyId || null),
        isSuper ? null : (u.companyCode || null),
        isSuper ? null : (u.employeeId || null),
        isSuper ? null : (u.employeeCode || null),
        permissions,
        u.avatarUrl || '',
        u.createdAt || new Date().toISOString(),
        u.updatedAt || new Date().toISOString(),
      ]
    );
  }

  // 6. Verify records in MySQL
  const [roleCounts] = await pool.query('SELECT role, COUNT(*) as count FROM users GROUP BY role');
  console.log('\n--- MySQL Users Table Role Distribution ---');
  console.table(roleCounts);

  const [allUsers] = await pool.query('SELECT id, email, role, companyId, companyCode, employeeId, employeeCode FROM users ORDER BY role, id');
  console.log('\n--- MySQL Users Table Detailed Records ---');
  console.table(allUsers);

  await pool.end();
  console.log('\n--- Migration Completed Successfully! ---');
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

