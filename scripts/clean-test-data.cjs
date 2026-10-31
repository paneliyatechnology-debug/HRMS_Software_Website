const fs = require('fs');
const mysql = require('mysql2/promise');

async function clean() {
  const dbJson = JSON.parse(fs.readFileSync('data/database.json', 'utf8'));
  dbJson.users = dbJson.users.filter(u => !u.email.startsWith('test-'));
  dbJson.employees = dbJson.employees.filter(e => !e.email.startsWith('test-'));
  fs.writeFileSync('data/database.json', JSON.stringify(dbJson, null, 2), 'utf8');

  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'hrms',
  });
  await conn.query("DELETE FROM users WHERE email LIKE 'test-%'");
  await conn.end();
  console.log('Cleaned lingering test- accounts successfully.');
}

clean().catch(console.error);

