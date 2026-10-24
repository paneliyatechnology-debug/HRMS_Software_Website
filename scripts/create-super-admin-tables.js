import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function createSuperAdminTables() {
  const conn = await mysql.createConnection({
    host: process.env.DATABASE_HOST || 'localhost',
    user: process.env.DATABASE_USER || 'root',
    password: process.env.DATABASE_PASSWORD || '',
    database: process.env.DATABASE_NAME || 'hrms',
  });

  console.log('Connected to XAMPP MySQL "hrms" database.');

  // 1. super_admins table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS super_admins (
      id VARCHAR(64) PRIMARY KEY,
      userId VARCHAR(64) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      fullName VARCHAR(255) NOT NULL,
      permissions JSON,
      isRoot BOOLEAN DEFAULT TRUE,
      status VARCHAR(50) DEFAULT 'Active',
      lastLoginAt VARCHAR(50),
      createdAt VARCHAR(50),
      updatedAt VARCHAR(50)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('Table [super_admins] created/verified.');

  // 2. system_settings table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id VARCHAR(64) PRIMARY KEY,
      companyName VARCHAR(255) NOT NULL,
      supportEmail VARCHAR(255),
      timeZone VARCHAR(100) DEFAULT 'Asia/Kolkata',
      currency VARCHAR(20) DEFAULT 'INR',
      maintenanceMode BOOLEAN DEFAULT FALSE,
      allowRegistration BOOLEAN DEFAULT TRUE,
      twoFactorAuthEnforced BOOLEAN DEFAULT FALSE,
      sessionTimeoutMinutes INT DEFAULT 120,
      configData JSON,
      updatedBy VARCHAR(64),
      updatedAt VARCHAR(50)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('Table [system_settings] created/verified.');

  // 3. system_backups table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS system_backups (
      id VARCHAR(64) PRIMARY KEY,
      backupFileName VARCHAR(255) NOT NULL,
      backupFilePath TEXT NOT NULL,
      totalEntities INT DEFAULT 0,
      fileSizeBytes BIGINT DEFAULT 0,
      initiatedBy VARCHAR(255),
      createdAt VARCHAR(50)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('Table [system_backups] created/verified.');

  // Seed default record in system_settings if empty
  const [rows] = await conn.query('SELECT COUNT(*) as count FROM system_settings');
  if (rows[0].count === 0) {
    await conn.query(
      `INSERT INTO system_settings (id, companyName, supportEmail, timeZone, currency, maintenanceMode, allowRegistration, twoFactorAuthEnforced, sessionTimeoutMinutes, configData, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'settings-1',
        'Paneliya Enterprise HRMS',
        'admin@paneliya.com',
        'Asia/Kolkata',
        'INR',
        0,
        1,
        0,
        120,
        JSON.stringify({
          rbacRoles: ['SUPER_ADMIN', 'HR_ADMIN', 'HR_EXECUTIVE', 'MANAGER', 'EMPLOYEE', 'RECRUITER', 'FINANCE_ADMIN'],
          activeModules: ['Super Admin', 'Employees', 'Organization', 'Attendance', 'Leaves', 'Payroll', 'Recruitment'],
        }),
        new Date().toISOString(),
      ],
    );
    console.log('Default settings seeded in system_settings table.');
  }

  const [tables] = await conn.query('SHOW TABLES');
  console.log('\nTotal MySQL Tables:', tables.length);
  console.log('All Tables:', tables.map((t) => Object.values(t)[0]));

  await conn.end();
}

createSuperAdminTables().catch(console.error);
