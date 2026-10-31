import mysql from 'mysql2/promise';
import fs from 'fs';

async function checkDuplicates() {
  console.log('=== 1. CHECK DATABASE.JSON FOR DUPLICATES ===');
  const db = JSON.parse(fs.readFileSync('data/database.json', 'utf8'));
  const jsonMap = {};
  for (const u of db.users || []) {
    const norm = (u.email || '').trim().toLowerCase();
    if (!jsonMap[norm]) jsonMap[norm] = [];
    jsonMap[norm].push(u);
  }
  let jsonDups = 0;
  for (const em in jsonMap) {
    if (jsonMap[em].length > 1) {
      console.log('Duplicate in JSON:', em, jsonMap[em].map(x => ({ id: x.id, role: x.role, companyId: x.companyId })));
      jsonDups++;
    }
  }
  if (jsonDups === 0) console.log('Zero duplicate emails found in database.json.');

  console.log('\n=== 2. CHECK MYSQL USERS TABLE FOR DUPLICATES ===');
  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', database: 'hrms' });
  const [rows] = await conn.query('SELECT id, email, role, companyId FROM users');
  const sqlMap = {};
  for (const r of rows) {
    const norm = (r.email || '').trim().toLowerCase();
    if (!sqlMap[norm]) sqlMap[norm] = [];
    sqlMap[norm].push(r);
  }
  let sqlDups = 0;
  for (const em in sqlMap) {
    if (sqlMap[em].length > 1) {
      console.log('Duplicate in MySQL:', em, sqlMap[em]);
      sqlDups++;
    }
  }
  if (sqlDups === 0) console.log(`Zero duplicate emails found in MySQL users table (total ${rows.length} rows).`);

  console.log('\n=== 3. CHECK UNIQUE INDEXES ON USERS.EMAIL ===');
  const [indexes] = await conn.query("SHOW INDEX FROM users WHERE Column_name = 'email'");
  console.table(indexes);

  await conn.end();
}

checkDuplicates().catch(console.error);

