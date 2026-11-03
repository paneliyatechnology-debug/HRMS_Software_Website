const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function test() {
  const pool = await mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'hrms',
  });

  const [users] = await pool.query('SELECT * FROM users');
  console.log('Total users in DB:', users.length);
  for (const u of users) {
    console.log(`User: id=${u.id}, email="${u.email}", role=${u.role}, isSuperAdmin=${u.isSuperAdmin}, companyId=${u.companyId}, passHash=${u.password}`);
    const matchesPaneliya = bcrypt.compareSync('Paneliya@123', u.password || '');
    console.log(`  Password "Paneliya@123" matches: ${matchesPaneliya}`);
  }

  const [comps] = await pool.query('SELECT * FROM companies');
  console.log('Total companies in DB:', comps.length);
  for (const c of comps) {
    console.log(`Company: id=${c.id}, code=${c.companyCode}, name=${c.companyName}`);
  }

  await pool.end();
}

test().catch(console.error);

