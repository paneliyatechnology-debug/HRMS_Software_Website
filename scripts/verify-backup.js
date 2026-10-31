import mysql from 'mysql2/promise';

async function verifyBackup() {
  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', database: 'hrms' });

  const [legacy] = await conn.query('SELECT * FROM super_admins ORDER BY id');
  const [backup] = await conn.query('SELECT * FROM super_admins_backup_pre_consolidation ORDER BY id');
  const [unified] = await conn.query("SELECT id, email, role, isSuperAdmin, permissions FROM users WHERE role = 'SUPER_ADMIN' ORDER BY id");

  console.log('Legacy count:', legacy.length);
  console.log('Backup count:', backup.length);
  console.log('Unified count:', unified.length);

  let matchAll = true;
  for (const b of backup) {
    const l = legacy.find(x => x.id === b.id);
    const u = unified.find(x => x.id === b.userId);
    if (!l) {
      console.log('Missing in legacy:', b.id);
      matchAll = false;
    }
    if (!u) {
      console.log('Missing in unified users:', b.userId);
      matchAll = false;
    }
    console.log(`Verified: email=${b.email} | backupId=${b.id} | unifiedUserId=${u?.id} | permissions=${JSON.stringify(u?.permissions)}`);
  }

  console.log('\nAll backup records 100% accounted for in unified users:', matchAll);
  await conn.end();
}

verifyBackup().catch(console.error);

