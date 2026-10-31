import mysql from 'mysql2/promise';

async function removeLegacyTables() {
  console.log('=== Step 6: Safely Removing Separate employees and super_admins Tables ===\n');

  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', database: 'hrms' });

  // 1. Verify backup tables exist and have rows
  const [bSa] = await conn.query('SELECT count(*) as c FROM super_admins_backup_pre_unification');
  const [bEmp] = await conn.query('SELECT count(*) as c FROM employees_backup_pre_unification');
  console.log(`Pre-unification backup super_admins_backup_pre_unification: ${bSa[0].c} records`);
  console.log(`Pre-unification backup employees_backup_pre_unification: ${bEmp[0].c} records`);

  if (bSa[0].c === 0 || bEmp[0].c === 0) {
    throw new Error('Backup tables are empty! Aborting table removal.');
  }

  // 2. Safely remove separate employees and super_admins tables
  console.log('\nDropping legacy table "employees"...');
  await conn.query('DROP TABLE IF EXISTS employees');
  console.log('Table "employees" dropped successfully.');

  console.log('Dropping legacy table "super_admins"...');
  await conn.query('DROP TABLE IF EXISTS super_admins');
  console.log('Table "super_admins" dropped successfully.');

  // 3. Verify remaining tables in hrms database
  const [tables] = await conn.query('SHOW TABLES');
  console.log('\n--- Active Tables in hrms Database ---');
  console.table(tables);

  await conn.end();
  console.log('\n=== Legacy Tables Safely Removed! ===');
}

removeLegacyTables().catch(console.error);
