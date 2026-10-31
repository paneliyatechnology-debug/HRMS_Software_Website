import mysql from 'mysql2/promise';

async function check() {
  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', database: 'hrms' });
  const [fks] = await conn.query(`
    SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = 'hrms' AND REFERENCED_TABLE_NAME = 'employees'
  `);
  console.log('Foreign keys referencing employees:', fks);

  const [fksFrom] = await conn.query(`
    SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = 'hrms' AND TABLE_NAME = 'employees' AND REFERENCED_TABLE_NAME IS NOT NULL
  `);
  console.log('Foreign keys on employees pointing elsewhere:', fksFrom);

  await conn.end();
}

check().catch(console.error);
