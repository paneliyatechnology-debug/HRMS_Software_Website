const mysql = require('mysql2/promise');

async function main() {
  try {
    const conn = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: '',
      database: 'hrms'
    });
    console.log('Connected to MySQL');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS attendance_breaks (
        id VARCHAR(64) PRIMARY KEY,
        attendanceSessionId VARCHAR(64) NOT NULL,
        userId VARCHAR(64) NOT NULL,
        companyId VARCHAR(64) NOT NULL,
        companyCode VARCHAR(50),
        breakStartTime VARCHAR(50) NOT NULL,
        breakEndTime VARCHAR(50),
        durationSeconds INT DEFAULT 0,
        createdAt VARCHAR(50),
        updatedAt VARCHAR(50),
        INDEX idx_break_session (attendanceSessionId),
        INDEX idx_break_user (userId),
        INDEX idx_break_company (companyId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const [cols] = await conn.query('DESCRIBE attendance_breaks');
    console.log('attendance_breaks columns:');
    console.table(cols);
    await conn.end();
  } catch (err) {
    console.error('Error:', err);
  }
}
main();

