import mysql from 'mysql2/promise';

async function verify() {
  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', database: 'hrms' });

  console.log('=== 1. USERS ROLE BREAKDOWN IN MYSQL ===');
  const [roleCounts] = await conn.query('SELECT role, COUNT(*) as count FROM users GROUP BY role');
  console.table(roleCounts);

  console.log('=== 2. ALL USERS IN MYSQL ===');
  const [users] = await conn.query('SELECT id, email, role, isSuperAdmin, companyId, companyCode, employeeId, employeeCode FROM users ORDER BY role, id');
  console.table(users);

  console.log('=== 3. EMPLOYEES COUNT & LINKAGE ===');
  const [empCount] = await conn.query('SELECT COUNT(*) as count FROM employees');
  console.log('Total MySQL employees count:', empCount[0].count);

  const [unlinkedEmps] = await conn.query('SELECT e.id, e.employeeCode, e.email FROM employees e LEFT JOIN users u ON (u.employeeId = e.id OR u.email = e.email) WHERE u.id IS NULL');
  console.log('Unlinked employees count:', unlinkedEmps.length);
  if (unlinkedEmps.length > 0) {
    console.table(unlinkedEmps);
  }

  console.log('=== 4. INTEGRITY CHECK ON RELATED TABLES ===');
  const tables = ['attendance_records', 'leave_requests', 'leave_balances', 'payroll_records', 'work_sessions'];
  for (const t of tables) {
    const [orphans] = await conn.query(`SELECT COUNT(*) as count FROM ${t} WHERE employeeId NOT IN (SELECT id FROM employees)`);
    console.log(`Orphans in ${t}: ${orphans[0].count}`);
  }

  await conn.end();
}

verify().catch(console.error);

