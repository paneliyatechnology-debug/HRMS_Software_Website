const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function debugAuth() {
  const pool = await mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'hrms',
  });

  const [mysqlUsers] = await pool.query('SELECT * FROM users');
  console.log('Loaded from MySQL users count:', mysqlUsers.length);
  
  const users = mysqlUsers.map(u => ({
    id: u.id,
    email: u.email,
    phone: u.phone || '',
    password: u.password,
    role: u.role,
    isSuperAdmin: u.isSuperAdmin === 1 || u.isSuperAdmin === true || u.role === 'SUPER_ADMIN',
    status: u.status || 'Active',
    companyId: u.companyId,
    companyCode: u.companyCode,
  }));

  const identifier = 'paneliya@gmail.com';
  const cleanInput = identifier.trim();
  const lowerEmail = cleanInput.toLowerCase();
  
  let matchingUsers = users.filter((u) => u.email.toLowerCase() === lowerEmail);
  console.log('Matching users found:', matchingUsers.length);
  if (matchingUsers.length === 0) {
    console.log('ERROR: matchingUsers.length === 0!');
    return;
  }

  const user = matchingUsers[0];
  console.log('User found:', user.email, 'role:', user.role, 'isSuperAdmin:', user.isSuperAdmin);

  // Check live MySQL verification:
  const [liveUserRows] = await pool.query('SELECT id FROM users WHERE id = ? LIMIT 1', [user.id]);
  console.log('liveUserRows count:', liveUserRows.length);
  if (!liveUserRows || liveUserRows.length === 0) {
    console.log('ERROR: liveUserRows is empty!');
    return;
  }

  // Strict Company Existence Verification:
  const isSuper = user.role === 'SUPER_ADMIN' || user.isSuperAdmin === true;
  console.log('isSuper:', isSuper);

  const password = 'Paneliya@123';
  const isValid = bcrypt.compareSync(password, user.password);
  console.log('Password comparison isValid:', isValid);

  await pool.end();
}

debugAuth().catch(console.error);

