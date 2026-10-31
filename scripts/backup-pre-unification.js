import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

async function backup() {
  console.log('--- Starting Pre-Unification Backup ---');

  // 1. JSON Backup
  const dataDir = path.resolve(process.cwd(), 'data');
  const backupDir = path.join(dataDir, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupJsonPath = path.join(backupDir, `backup_hrms_pre_unification_${timestamp}.json`);
  const dbFilePath = path.join(dataDir, 'database.json');
  fs.copyFileSync(dbFilePath, backupJsonPath);
  console.log(`JSON database backed up to: ${backupJsonPath}`);

  // 2. MySQL Snapshot Tables
  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', database: 'hrms' });

  await conn.query('DROP TABLE IF EXISTS users_backup_pre_unification');
  await conn.query('CREATE TABLE users_backup_pre_unification AS SELECT * FROM users');
  const [uRows] = await conn.query('SELECT count(*) as c FROM users_backup_pre_unification');
  console.log(`Created users_backup_pre_unification (${uRows[0].c} rows)`);

  await conn.query('DROP TABLE IF EXISTS employees_backup_pre_unification');
  await conn.query('CREATE TABLE employees_backup_pre_unification AS SELECT * FROM employees');
  const [eRows] = await conn.query('SELECT count(*) as c FROM employees_backup_pre_unification');
  console.log(`Created employees_backup_pre_unification (${eRows[0].c} rows)`);

  await conn.query('DROP TABLE IF EXISTS super_admins_backup_pre_unification');
  await conn.query('CREATE TABLE super_admins_backup_pre_unification AS SELECT * FROM super_admins');
  const [sRows] = await conn.query('SELECT count(*) as c FROM super_admins_backup_pre_unification');
  console.log(`Created super_admins_backup_pre_unification (${sRows[0].c} rows)`);

  await conn.end();
  console.log('--- Backup Completed Successfully ---');
}

backup().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});
