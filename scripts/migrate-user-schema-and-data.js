import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

async function migrate() {
  console.log('=== Step 1: Adding Employee Profile Columns to MySQL users Table ===');
  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', database: 'hrms' });

  const columnsToAdd = [
    { name: 'gender', type: 'VARCHAR(20) NULL AFTER avatarUrl' },
    { name: 'dateOfBirth', type: 'VARCHAR(30) NULL AFTER gender' },
    { name: 'address', type: 'TEXT NULL AFTER dateOfBirth' },
    { name: 'joiningDate', type: 'VARCHAR(30) NULL AFTER address' },
    { name: 'employmentType', type: 'VARCHAR(50) NULL AFTER joiningDate' },
    { name: 'departmentId', type: 'VARCHAR(64) NULL AFTER employmentType' },
    { name: 'departmentName', type: 'VARCHAR(255) NULL AFTER departmentId' },
    { name: 'designationId', type: 'VARCHAR(64) NULL AFTER departmentName' },
    { name: 'designationTitle', type: 'VARCHAR(255) NULL AFTER designationId' },
    { name: 'reportingManagerId', type: 'VARCHAR(64) NULL AFTER designationTitle' },
    { name: 'reportingManagerName', type: 'VARCHAR(255) NULL AFTER reportingManagerId' },
    { name: 'workLocationId', type: 'VARCHAR(64) NULL AFTER reportingManagerName' },
    { name: 'workLocationName', type: 'VARCHAR(255) NULL AFTER workLocationId' },
    { name: 'shift', type: 'VARCHAR(100) NULL AFTER workLocationName' },
    { name: 'emergencyContact', type: 'JSON NULL AFTER shift' },
    { name: 'bankDetails', type: 'JSON NULL AFTER emergencyContact' },
    { name: 'taxInformation', type: 'JSON NULL AFTER bankDetails' },
    { name: 'education', type: 'JSON NULL AFTER taxInformation' },
    { name: 'previousExperience', type: 'JSON NULL AFTER education' },
    { name: 'skills', type: 'JSON NULL AFTER previousExperience' },
    { name: 'salary', type: 'JSON NULL AFTER skills' },
  ];

  for (const col of columnsToAdd) {
    try {
      await conn.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
      console.log(`Added column ${col.name} to users table.`);
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log(`Column ${col.name} already exists in users table.`);
      } else {
        console.warn(`Could not add column ${col.name}: ${e.message}`);
      }
    }
  }

  console.log('\n=== Step 2: Migrating Employee Profile Data from employees into users ===');
  // Load database.json
  const dataDir = path.resolve(process.cwd(), 'data');
  const dbFilePath = path.join(dataDir, 'database.json');
  const db = JSON.parse(fs.readFileSync(dbFilePath, 'utf8'));

  // Get all employee records (both from employees array and employees MySQL table)
  const [mysqlEmployees] = await conn.query('SELECT * FROM employees');
  console.log(`Found ${mysqlEmployees.length} employees in MySQL employees table.`);

  // For each employee in mysqlEmployees, find the corresponding user in db.users
  let migratedCount = 0;
  for (const emp of mysqlEmployees) {
    // Parse JSON fields if they are strings
    const parseJson = (val) => {
      if (!val) return null;
      if (typeof val === 'object') return val;
      try { return JSON.parse(val); } catch { return null; }
    };

    const emergencyContact = parseJson(emp.emergencyContact);
    const bankDetails = parseJson(emp.bankDetails);
    const taxInformation = parseJson(emp.taxInformation);
    const education = parseJson(emp.education);
    const previousExperience = parseJson(emp.previousExperience);
    const skills = parseJson(emp.skills);
    const salary = parseJson(emp.salary);

    // Find in db.users
    const userInDb = db.users.find(u =>
      (u.employeeId && u.employeeId === emp.id) ||
      (u.email && emp.email && u.email.toLowerCase() === emp.email.toLowerCase())
    );

    if (userInDb) {
      userInDb.gender = emp.gender || userInDb.gender || 'Other';
      userInDb.dateOfBirth = emp.dateOfBirth || userInDb.dateOfBirth || '';
      userInDb.address = emp.address || userInDb.address || '';
      userInDb.joiningDate = emp.joiningDate || userInDb.joiningDate || '';
      userInDb.employmentType = emp.employmentType || userInDb.employmentType || 'Full-time';
      userInDb.departmentId = emp.departmentId || userInDb.departmentId || '';
      userInDb.departmentName = emp.departmentName || userInDb.departmentName || '';
      userInDb.designationId = emp.designationId || userInDb.designationId || '';
      userInDb.designationTitle = emp.designationTitle || userInDb.designationTitle || '';
      userInDb.reportingManagerId = emp.reportingManagerId || userInDb.reportingManagerId || '';
      userInDb.reportingManagerName = emp.reportingManagerName || userInDb.reportingManagerName || '';
      userInDb.workLocationId = emp.workLocationId || userInDb.workLocationId || '';
      userInDb.workLocationName = emp.workLocationName || userInDb.workLocationName || '';
      userInDb.shift = emp.shift || userInDb.shift || '';
      userInDb.emergencyContact = emergencyContact || userInDb.emergencyContact || {};
      userInDb.bankDetails = bankDetails || userInDb.bankDetails || {};
      userInDb.taxInformation = taxInformation || userInDb.taxInformation || {};
      userInDb.education = education || userInDb.education || [];
      userInDb.previousExperience = previousExperience || userInDb.previousExperience || [];
      userInDb.skills = skills || userInDb.skills || [];
      userInDb.salary = salary || userInDb.salary || {};
      userInDb.employeeId = emp.id;
      userInDb.employeeCode = emp.employeeCode || userInDb.employeeCode;
      userInDb.companyId = emp.companyId || userInDb.companyId;
      userInDb.companyCode = emp.companyCode || userInDb.companyCode;

      // Update in MySQL users table
      await conn.query(
        `UPDATE users SET
          gender = ?, dateOfBirth = ?, address = ?, joiningDate = ?, employmentType = ?,
          departmentId = ?, departmentName = ?, designationId = ?, designationTitle = ?,
          reportingManagerId = ?, reportingManagerName = ?, workLocationId = ?, workLocationName = ?, shift = ?,
          emergencyContact = ?, bankDetails = ?, taxInformation = ?, education = ?, previousExperience = ?, skills = ?, salary = ?,
          employeeId = ?, employeeCode = ?, companyId = ?, companyCode = ?
         WHERE id = ?`,
        [
          userInDb.gender,
          userInDb.dateOfBirth,
          userInDb.address,
          userInDb.joiningDate,
          userInDb.employmentType,
          userInDb.departmentId,
          userInDb.departmentName,
          userInDb.designationId,
          userInDb.designationTitle,
          userInDb.reportingManagerId,
          userInDb.reportingManagerName,
          userInDb.workLocationId,
          userInDb.workLocationName,
          userInDb.shift,
          JSON.stringify(userInDb.emergencyContact),
          JSON.stringify(userInDb.bankDetails),
          JSON.stringify(userInDb.taxInformation),
          JSON.stringify(userInDb.education),
          JSON.stringify(userInDb.previousExperience),
          JSON.stringify(userInDb.skills),
          JSON.stringify(userInDb.salary),
          userInDb.employeeId,
          userInDb.employeeCode,
          userInDb.companyId,
          userInDb.companyCode,
          userInDb.id,
        ]
      );
      migratedCount++;
      console.log(`Migrated profile for user ${userInDb.email} (${userInDb.employeeCode})`);
    }
  }

  console.log(`Successfully migrated ${migratedCount} employee profiles into users.`);

  // 3. Remap older historical attendance and payroll employeeId to current active employeeId
  // emp-1793190505324 -> emp-1793192050133 (Ravi Khunt)
  // emp-1793192815053 -> emp-1793192832564 (Keyur Sangani)
  console.log('\n=== Step 3: Remapping Legacy Employee IDs in Related Tables ===');
  const remap = [
    { from: 'emp-1793190505324', to: 'emp-1793192050133' },
    { from: 'emp-1793192815053', to: 'emp-1793192832564' },
  ];

  for (const r of remap) {
    const [attRes] = await conn.query('UPDATE attendance_records SET employeeId = ? WHERE employeeId = ?', [r.to, r.from]);
    const [payRes] = await conn.query('UPDATE payroll_records SET employeeId = ? WHERE employeeId = ?', [r.to, r.from]);
    console.log(`Remapped ${r.from} -> ${r.to}: attendance updated ${attRes.affectedRows}, payroll updated ${payRes.affectedRows}`);
  }

  // Update in database.json too
  for (const r of remap) {
    for (const a of (db.attendanceRecords || [])) {
      if (a.employeeId === r.from) a.employeeId = r.to;
    }
    for (const p of (db.payrollRecords || [])) {
      if (p.employeeId === r.from) p.employeeId = r.to;
    }
  }

  // Sync employees in database.json to be identical to users with role EMPLOYEE
  db.employees = db.users.filter(u => u.role === 'EMPLOYEE');

  // Save database.json
  const tempPath = `${dbFilePath}.tmp-${Date.now()}`;
  fs.writeFileSync(tempPath, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tempPath, dbFilePath);
  console.log('Saved updated database.json successfully.');

  // 4. Verify columns and records in users
  const [sample] = await conn.query("SELECT id, email, role, employeeCode, departmentName, designationTitle, salary FROM users WHERE role = 'EMPLOYEE'");
  console.log('\n--- Sample EMPLOYEE Records in Unified users Table ---');
  console.table(sample);

  await conn.end();
  console.log('\n=== Migration Step Finished Successfully ===');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
