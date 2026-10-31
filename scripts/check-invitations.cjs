const mysql = require('mysql2/promise');
async function check() {
  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'hrms', port: 3306 });
  const [tables] = await conn.query("SHOW TABLES LIKE 'employee_invitations'");
  console.log('Tables:', tables);
  if (tables.length > 0) {
    const [rows] = await conn.query('SELECT * FROM employee_invitations');
    console.log('Rows count:', rows.length, rows);
  }
  await conn.end();
}
check().catch(console.error);

