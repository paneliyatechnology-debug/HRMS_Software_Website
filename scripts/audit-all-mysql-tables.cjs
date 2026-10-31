const mysql = require('mysql2/promise');

async function checkAllTables() {
  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'hrms' });
  const [tables] = await conn.query('SHOW TABLES');
  const tableNames = tables.map(t => Object.values(t)[0]);

  console.log(`Scanning ${tableNames.length} tables in MySQL database "hrms"...`);
  let totalFound = 0;

  for (const table of tableNames) {
    const [cols] = await conn.query(`DESCRIBE ${table}`);
    const textCols = cols.filter(c => /char|text/i.test(c.Type)).map(c => c.Field);
    
    for (const col of textCols) {
      try {
        const [rows] = await conn.query(`SELECT COUNT(*) as count FROM \`${table}\` WHERE \`${col}\` LIKE ?`, ['emp-%']);
        if (rows[0].count > 0) {
          totalFound += rows[0].count;
          console.log(`FOUND: table [${table}] column [${col}] has ${rows[0].count} rows with emp-%`);
          const [samples] = await conn.query(`SELECT \`${col}\` FROM \`${table}\` WHERE \`${col}\` LIKE ? LIMIT 5`, ['emp-%']);
          console.log('   Samples:', samples.map(s => s[col]));
        }
      } catch (err) {
        // ignore column error if json or binary
      }
    }
  }

  console.log(`Scan completed. Total emp-% references found: ${totalFound}`);
  await conn.end();
}

checkAllTables().catch(console.error);

