const fs = require('fs');
const mysql = require('mysql2/promise');

async function fix() {
  const d = JSON.parse(fs.readFileSync('./data/database.json', 'utf8'));
  const u = d.users.find(x => x.email === 'emp_a_1793438064974@corp.test');
  if (u) u.status = 'Active';
  const e = d.employees.find(x => x.email === 'emp_a_1793438064974@corp.test');
  if (e) e.status = 'Active';
  fs.writeFileSync('./data/database.json', JSON.stringify(d, null, 2));

  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'hrms', port: 3306 });
  await conn.query("UPDATE users SET status = 'Active' WHERE email = 'emp_a_1793438064974@corp.test'");
  await conn.end();
  console.log('Successfully set emp_a_1793438064974@corp.test to Active');
}
fix().catch(console.error);
