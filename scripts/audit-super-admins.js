import mysql from 'mysql2/promise';

async function audit() {
  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', database: 'hrms' });

  console.log('=== 1. FOREIGN KEY CONSTRAINTS AUDIT ===');
  const [fksReferencing] = await conn.query(`
    SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = 'hrms' AND REFERENCED_TABLE_NAME = 'super_admins'
  `);
  console.log('Foreign keys referencing super_admins:', fksReferencing);

  const [fksFrom] = await conn.query(`
    SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = 'hrms' AND TABLE_NAME = 'super_admins' AND REFERENCED_TABLE_NAME IS NOT NULL
  `);
  console.log('Foreign keys on super_admins pointing elsewhere:', fksFrom);

  const [constraints] = await conn.query(`
    SELECT CONSTRAINT_NAME, CONSTRAINT_TYPE
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = 'hrms' AND TABLE_NAME = 'super_admins'
  `);
  console.log('Constraints on super_admins:', constraints);

  console.log('\n=== 2. LEGACY TABLE RECORDS (super_admins) ===');
  const [saRows] = await conn.query('SELECT id, userId, email, fullName, permissions, isRoot, status, createdAt, updatedAt FROM super_admins');
  console.log(`super_admins row count: ${saRows.length}`);
  console.table(saRows);

  console.log('\n=== 3. BACKUP TABLE RECORDS (super_admins_backup_pre_consolidation) ===');
  const [backupRows] = await conn.query('SELECT id, userId, email, fullName, permissions, isRoot, status, createdAt, updatedAt FROM super_admins_backup_pre_consolidation');
  console.log(`super_admins_backup_pre_consolidation row count: ${backupRows.length}`);
  console.table(backupRows);

  console.log('\n=== 4. UNIFIED USERS TABLE - SUPER_ADMIN RECORDS ===');
  const [unifiedSaRows] = await conn.query("SELECT id, email, role, isSuperAdmin, permissions, status, createdAt FROM users WHERE role = 'SUPER_ADMIN'");
  console.log(`users table (SUPER_ADMIN) row count: ${unifiedSaRows.length}`);
  console.table(unifiedSaRows);

  await conn.end();
}

audit().catch(console.error);

