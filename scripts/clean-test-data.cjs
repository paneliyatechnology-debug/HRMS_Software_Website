const fs = require('fs');
const mysql = require('mysql2/promise');

async function clean() {
  const dbJson = JSON.parse(fs.readFileSync('data/database.json', 'utf8'));
  const isTest = (email) =>
    email.startsWith('test-') ||
    email.startsWith('test.unique.') ||
    email.startsWith('conc1.') ||
    email.startsWith('conc2.') ||
    email.startsWith('verified.test.') ||
    email.startsWith('admin.179') ||
    email.startsWith('worker2.179');

  dbJson.users = dbJson.users.filter(u => !isTest(u.email));
  dbJson.employees = dbJson.employees.filter(e => !isTest(e.email));
  fs.writeFileSync('data/database.json', JSON.stringify(dbJson, null, 2), 'utf8');

  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'hrms',
  });
  await conn.query(
    "DELETE FROM users WHERE email LIKE 'test-%' OR email LIKE 'test.unique.%' OR email LIKE 'conc1.%' OR email LIKE 'conc2.%' OR email LIKE 'verified.test.%' OR email LIKE 'admin.179%' OR email LIKE 'worker2.179%'"
  );
  await conn.end();
  console.log('Cleaned lingering test accounts successfully.');
}

clean().catch(console.error);
