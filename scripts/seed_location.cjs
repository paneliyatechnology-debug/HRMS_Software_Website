const mysql = require('mysql2/promise');

async function main() {
  const c = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'hrms'
  });

  await c.query(`
    INSERT INTO locations (id, companyId, companyCode, name, city, country, address, isHeadquarter, latitude, longitude, radiusMeters, isActive)
    VALUES ('loc-sk-hq', 'cmp-1793694956491-ejyds', 'CMP-000001', 'sk Headquarters', 'Ahmedabad', 'India', '4/1, Ratan Park Rd', 1, 21.1702401, 72.8310607, 1000, 1)
    ON DUPLICATE KEY UPDATE name=VALUES(name), isActive=1, radiusMeters=1000
  `);

  const [rows] = await c.query('SELECT * FROM locations');
  console.log('Locations in MySQL:');
  console.table(rows);
  await c.end();
}
main();

