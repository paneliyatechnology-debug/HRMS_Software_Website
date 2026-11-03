const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'hrms'
  });

  const [users] = await conn.query('SELECT id, email, role, companyId, companyCode, status FROM users');
  console.log('Users:');
  console.table(users);

  const [locations] = await conn.query('SELECT id, name, latitude, longitude, radiusMeters, companyId FROM locations');
  console.log('Locations:');
  console.table(locations);

  const [employees] = await conn.query('SELECT id, employeeCode, firstName, lastName, email, companyId, status FROM employees');
  console.log('Employees:');
  console.table(employees);

  await conn.end();
}
main();

