import mysql from 'mysql2/promise';

async function inspect() {
  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', database: 'hrms' });
  const [employees] = await conn.query('SELECT id, employeeCode, email, firstName, lastName, companyId, departmentName, designationTitle FROM employees ORDER BY email, id');
  console.log('--- ALL 8 EMPLOYEES IN MYSQL ---');
  console.table(employees);

  const [users] = await conn.query('SELECT id, email, role, companyId, employeeId, employeeCode FROM users ORDER BY email, id');
  console.log('--- ALL 13 USERS IN MYSQL ---');
  console.table(users);

  await conn.end();
}

inspect().catch(console.error);
