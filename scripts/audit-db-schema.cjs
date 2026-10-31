const mysql = require('mysql2/promise');
require('dotenv').config();

async function audit() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hrms'
  });

  const [tables] = await conn.query('SHOW TABLES');
  const tableNames = tables.map(t => Object.values(t)[0]);

  console.log('Total MySQL tables:', tableNames.length);
  console.log('------------------------------------------------------------------------------------------------------');
  console.log('Table Name'.padEnd(25) + ' | Rows | companyId | companyCode | Notes / Missing Tenant Ownership');
  console.log('------------------------------------------------------------------------------------------------------');

  for (const t of tableNames) {
    const [cols] = await conn.query('SHOW COLUMNS FROM ' + t);
    const colNames = cols.map(c => c.Field);
    const hasCompanyId = colNames.includes('companyId');
    const hasCompanyCode = colNames.includes('companyCode');
    const [countRes] = await conn.query('SELECT COUNT(*) as cnt FROM ' + t);
    const count = countRes[0].cnt;

    let notes = '';
    if (hasCompanyId && count > 0) {
      const [nc] = await conn.query('SELECT COUNT(*) as ncnt FROM ' + t + ' WHERE companyId IS NULL OR companyId = ""');
      if (nc[0].ncnt > 0) {
        notes = `${nc[0].ncnt} / ${count} rows have NULL/Empty companyId`;
      } else {
        notes = 'All rows have companyId';
      }
    } else if (!hasCompanyId) {
      notes = 'MISSING companyId column';
    }

    console.log(
      t.padEnd(25) +
      ' | ' + String(count).padStart(4) +
      ' | ' + (hasCompanyId ? '  YES  ' : '   NO  ') +
      ' | ' + (hasCompanyCode ? '    YES    ' : '     NO    ') +
      ' | ' + notes
    );
  }

  await conn.end();
}

audit().catch(console.error);

