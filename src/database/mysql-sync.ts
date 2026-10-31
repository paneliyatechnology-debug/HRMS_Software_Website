import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export async function getMysqlPool() {
  const host = process.env.DATABASE_HOST || 'localhost';
  const port = Number(process.env.DATABASE_PORT) || 3306;
  const user = process.env.DATABASE_USER || 'root';
  const password = process.env.DATABASE_PASSWORD || '';
  const database = process.env.DATABASE_NAME || 'hrms';

  // Automatically create the database if it doesn't exist yet
  try {
    const adminConnection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      connectTimeout: 5000,
    });
    await adminConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
    );
    await adminConnection.end();
  } catch {
    // If admin connection fails (e.g. restricted permissions), proceed to let createPool handle it
  }

  return mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 5000, // 5s timeout — prevents indefinite hang if MySQL is offline
  });
}

export async function initializeMysqlTables(pool: mysql.Pool) {
  const tableDefinitions = [
    `CREATE TABLE IF NOT EXISTS companies (
      id VARCHAR(64) PRIMARY KEY,
      companyCode VARCHAR(50) NOT NULL UNIQUE,
      companyName VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      phone VARCHAR(50),
      address TEXT,
      status VARCHAR(50) DEFAULT 'Active',
      adminUserId VARCHAR(64),
      createdAt VARCHAR(50),
      updatedAt VARCHAR(50)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS locations (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      city VARCHAR(100),
      country VARCHAR(100),
      address TEXT,
      isHeadquarter BOOLEAN DEFAULT FALSE,
      latitude DECIMAL(10, 8) DEFAULT 0,
      longitude DECIMAL(11, 8) DEFAULT 0,
      radiusMeters INT DEFAULT 200,
      companyId VARCHAR(64),
      isActive BOOLEAN DEFAULT TRUE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS departments (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(50) NOT NULL,
      headEmployeeId VARCHAR(64),
      headName VARCHAR(255),
      employeeCount INT DEFAULT 0,
      description TEXT,
      createdAt VARCHAR(50)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS designations (
      id VARCHAR(64) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      departmentId VARCHAR(64),
      departmentName VARCHAR(255),
      minSalary DECIMAL(12,2) DEFAULT 0,
      maxSalary DECIMAL(12,2) DEFAULT 0,
      createdAt VARCHAR(50)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(50),
      password VARCHAR(255),
      firstName VARCHAR(100),
      lastName VARCHAR(100),
      role ENUM('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE') DEFAULT 'EMPLOYEE',
      isSuperAdmin BOOLEAN DEFAULT FALSE,
      status VARCHAR(50) DEFAULT 'Active',
      companyId VARCHAR(64),
      companyCode VARCHAR(50),
      employeeId VARCHAR(64),
      avatarUrl TEXT,
      createdAt VARCHAR(50),
      updatedAt VARCHAR(50)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS employees (
      id VARCHAR(64) PRIMARY KEY,
      employeeCode VARCHAR(50) NOT NULL UNIQUE,
      companyId VARCHAR(64),
      companyCode VARCHAR(50),
      firstName VARCHAR(100) NOT NULL,
      lastName VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      avatarUrl TEXT,
      gender VARCHAR(20),
      dateOfBirth VARCHAR(30),
      address TEXT,
      joiningDate VARCHAR(30),
      employmentType VARCHAR(50),
      status VARCHAR(50),
      departmentId VARCHAR(64),
      departmentName VARCHAR(255),
      designationId VARCHAR(64),
      designationTitle VARCHAR(255),
      reportingManagerId VARCHAR(64),
      reportingManagerName VARCHAR(255),
      workLocationId VARCHAR(64),
      workLocationName VARCHAR(255),
      shift VARCHAR(100),
      emergencyContact JSON,
      bankDetails JSON,
      taxInformation JSON,
      education JSON,
      previousExperience JSON,
      skills JSON,
      salary JSON,
      createdAt VARCHAR(50),
      updatedAt VARCHAR(50)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS holidays (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      date VARCHAR(30) NOT NULL,
      dayOfWeek VARCHAR(30),
      type VARCHAR(50),
      description TEXT,
      locationId VARCHAR(64)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS leave_balances (
      id VARCHAR(64) PRIMARY KEY,
      employeeId VARCHAR(64) NOT NULL,
      year INT NOT NULL,
      casualLeave JSON,
      sickLeave JSON,
      paidLeave JSON
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS leave_requests (
      id VARCHAR(64) PRIMARY KEY,
      employeeId VARCHAR(64) NOT NULL,
      employeeCode VARCHAR(64),
      employeeName VARCHAR(255),
      employeeEmail VARCHAR(255),
      employeeAvatar TEXT,
      departmentName VARCHAR(255),
      companyId VARCHAR(64),
      companyCode VARCHAR(64),
      leaveType VARCHAR(100),
      startDate VARCHAR(30),
      endDate VARCHAR(30),
      daysCount DECIMAL(4,1),
      isHalfDay BOOLEAN DEFAULT FALSE,
      reason TEXT,
      status VARCHAR(50),
      appliedDate VARCHAR(30),
      managerApproverId VARCHAR(64),
      managerApproverName VARCHAR(255),
      hrApprovedAt VARCHAR(50),
      managerApprovedAt VARCHAR(50),
      comments TEXT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS attendance_records (
      id VARCHAR(64) PRIMARY KEY,
      employeeId VARCHAR(64) NOT NULL,
      employeeName VARCHAR(255),
      date VARCHAR(30) NOT NULL,
      checkIn VARCHAR(30),
      checkOut VARCHAR(30),
      breakDurationMinutes INT DEFAULT 0,
      workingHours DECIMAL(5,2) DEFAULT 0,
      overtimeHours DECIMAL(5,2) DEFAULT 0,
      status VARCHAR(50),
      remarks TEXT,
      createdAt VARCHAR(50)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS work_sessions (
      id VARCHAR(64) PRIMARY KEY,
      employeeId VARCHAR(64) NOT NULL,
      employeeName VARCHAR(255),
      companyId VARCHAR(64) NOT NULL,
      companyCode VARCHAR(50),
      officeLocationId VARCHAR(64) NOT NULL,
      officeLocationName VARCHAR(255),
      status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
      startTime VARCHAR(50) NOT NULL,
      endTime VARCHAR(50),
      durationSeconds INT DEFAULT 0,
      durationFormatted VARCHAR(50),
      startLatitude DECIMAL(10, 8) NOT NULL,
      startLongitude DECIMAL(11, 8) NOT NULL,
      startAccuracy DECIMAL(8, 2),
      startDistanceMeters DECIMAL(10, 2),
      startSelfieUrl TEXT NOT NULL,
      stopLatitude DECIMAL(10, 8),
      stopLongitude DECIMAL(11, 8),
      stopAccuracy DECIMAL(8, 2),
      stopDistanceMeters DECIMAL(10, 2),
      stopSelfieUrl TEXT,
      deviceInfo TEXT,
      ipAddress VARCHAR(50),
      createdAt VARCHAR(50),
      updatedAt VARCHAR(50),
      INDEX idx_employee_status (employeeId, status),
      INDEX idx_company (companyId),
      INDEX idx_office (officeLocationId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS payroll_records (
      id VARCHAR(64) PRIMARY KEY,
      payrollMonth VARCHAR(20) NOT NULL,
      employeeId VARCHAR(64) NOT NULL,
      employeeName VARCHAR(255),
      employeeCode VARCHAR(50),
      designationTitle VARCHAR(255),
      departmentName VARCHAR(255),
      basicSalary DECIMAL(12,2) DEFAULT 0,
      hra DECIMAL(12,2) DEFAULT 0,
      allowances DECIMAL(12,2) DEFAULT 0,
      bonus DECIMAL(12,2) DEFAULT 0,
      overtimePay DECIMAL(12,2) DEFAULT 0,
      grossSalary DECIMAL(12,2) DEFAULT 0,
      pfDeduction DECIMAL(12,2) DEFAULT 0,
      taxDeduction DECIMAL(12,2) DEFAULT 0,
      professionalTax DECIMAL(12,2) DEFAULT 0,
      otherDeductions DECIMAL(12,2) DEFAULT 0,
      totalDeductions DECIMAL(12,2) DEFAULT 0,
      netSalary DECIMAL(12,2) DEFAULT 0,
      status VARCHAR(50),
      paymentDate VARCHAR(30),
      paymentMethod VARCHAR(100)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS job_openings (
      id VARCHAR(64) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      departmentId VARCHAR(64),
      departmentName VARCHAR(255),
      designationTitle VARCHAR(255),
      location VARCHAR(255),
      employmentType VARCHAR(50),
      experienceLevel VARCHAR(50),
      openingsCount INT DEFAULT 1,
      salaryRange VARCHAR(100),
      description TEXT,
      skillsRequired JSON,
      status VARCHAR(50),
      postedDate VARCHAR(30),
      applicantCount INT DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS candidates (
      id VARCHAR(64) PRIMARY KEY,
      jobId VARCHAR(64),
      jobTitle VARCHAR(255),
      fullName VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      resumeUrl TEXT,
      experienceYears DECIMAL(4,1) DEFAULT 0,
      currentCompany VARCHAR(255),
      skills JSON,
      source VARCHAR(100),
      status VARCHAR(50),
      appliedDate VARCHAR(30),
      rating DECIMAL(3,1) DEFAULT 0,
      notes TEXT,
      interviews JSON
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS company_assets (
      id VARCHAR(64) PRIMARY KEY,
      assetCode VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(100),
      serialNumber VARCHAR(100),
      condition_status VARCHAR(50),
      status VARCHAR(50),
      assignedToEmployeeId VARCHAR(64),
      assignedToEmployeeName VARCHAR(255),
      assignedDate VARCHAR(30),
      purchaseDate VARCHAR(30)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS training_programs (
      id VARCHAR(64) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      trainerName VARCHAR(255),
      skillsCovered JSON,
      startDate VARCHAR(30),
      endDate VARCHAR(30),
      durationHours INT DEFAULT 0,
      status VARCHAR(50),
      enrolledCount INT DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS employee_trainings (
      id VARCHAR(64) PRIMARY KEY,
      trainingId VARCHAR(64) NOT NULL,
      trainingTitle VARCHAR(255),
      employeeId VARCHAR(64) NOT NULL,
      employeeName VARCHAR(255),
      status VARCHAR(50),
      progressPercent INT DEFAULT 0,
      completionDate VARCHAR(30),
      certificateUrl TEXT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS performance_cycles (
      id VARCHAR(64) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      year INT NOT NULL,
      period VARCHAR(50),
      startDate VARCHAR(30),
      endDate VARCHAR(30),
      status VARCHAR(50)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS performance_reviews (
      id VARCHAR(64) PRIMARY KEY,
      cycleId VARCHAR(64),
      cycleTitle VARCHAR(255),
      employeeId VARCHAR(64) NOT NULL,
      employeeName VARCHAR(255),
      departmentName VARCHAR(255),
      managerId VARCHAR(64),
      managerName VARCHAR(255),
      selfRating DECIMAL(3,1),
      selfComments TEXT,
      managerRating DECIMAL(3,1),
      managerFeedback TEXT,
      finalRating DECIMAL(3,1),
      appraisalRecommended TEXT,
      status VARCHAR(50),
      completedAt VARCHAR(50)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS resignations (
      id VARCHAR(64) PRIMARY KEY,
      employeeId VARCHAR(64) NOT NULL,
      employeeName VARCHAR(255),
      employeeCode VARCHAR(50),
      departmentName VARCHAR(255),
      resignationDate VARCHAR(30),
      lastWorkingDay VARCHAR(30),
      noticePeriodDays INT DEFAULT 30,
      reason TEXT,
      status VARCHAR(50),
      managerApproval JSON,
      clearance JSON
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS announcements (
      id VARCHAR(64) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT,
      publishDate VARCHAR(30),
      targetAudience VARCHAR(100),
      priority VARCHAR(50),
      authorName VARCHAR(255)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS notifications (
      id VARCHAR(64) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      message TEXT,
      type VARCHAR(50),
      isRead BOOLEAN DEFAULT FALSE,
      createdAt VARCHAR(50),
      link VARCHAR(255)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS documents (
      id VARCHAR(64) PRIMARY KEY,
      employeeId VARCHAR(64) NOT NULL,
      employeeName VARCHAR(255),
      title VARCHAR(255) NOT NULL,
      category VARCHAR(100),
      fileUrl TEXT,
      fileSize VARCHAR(50),
      uploadDate VARCHAR(30),
      expiryDate VARCHAR(30),
      verificationStatus VARCHAR(50),
      verifiedBy VARCHAR(255)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(64) PRIMARY KEY,
      userId VARCHAR(64),
      userName VARCHAR(255),
      userRole VARCHAR(50),
      action VARCHAR(100),
      module VARCHAR(100),
      recordId VARCHAR(64),
      details TEXT,
      ipAddress VARCHAR(50),
      createdAt VARCHAR(50)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS super_admins (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS system_settings (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS system_backups (
      id VARCHAR(64) PRIMARY KEY,
      backupFileName VARCHAR(255) NOT NULL,
      backupFilePath TEXT NOT NULL,
      totalEntities INT DEFAULT 0,
      fileSizeBytes BIGINT DEFAULT 0,
      initiatedBy VARCHAR(255),
      createdAt VARCHAR(50)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  ];

  for (const sql of tableDefinitions) {
    await pool.query(sql);
  }

  try {
    await pool.query(`ALTER TABLE locations ADD COLUMN latitude DECIMAL(10, 8) DEFAULT 0;`);
  } catch {
    // Column already exists
  }

  try {
    await pool.query(`ALTER TABLE locations ADD COLUMN longitude DECIMAL(11, 8) DEFAULT 0;`);
  } catch {
    // Column already exists
  }

  try {
    await pool.query(`ALTER TABLE locations ADD COLUMN radiusMeters INT DEFAULT 200;`);
  } catch {
    // Column already exists
  }

  try {
    await pool.query(`ALTER TABLE locations ADD COLUMN companyId VARCHAR(64);`);
  } catch {
    // Column already exists
  }

  try {
    await pool.query(`ALTER TABLE locations ADD COLUMN isActive BOOLEAN DEFAULT TRUE;`);
  } catch {
    // Column already exists
  }

  try {
    await pool.query(`ALTER TABLE users ADD COLUMN password VARCHAR(255) AFTER email;`);
  } catch {
    // Column already exists or table freshly created
  }

  try {
    await pool.query(`ALTER TABLE users ADD COLUMN isSuperAdmin BOOLEAN DEFAULT FALSE AFTER role;`);
  } catch {
    // Column already exists
  }

  try {
    await pool.query(`ALTER TABLE users ADD COLUMN status VARCHAR(50) DEFAULT 'Active' AFTER isSuperAdmin;`);
  } catch {
    // Column already exists
  }

  try {
    await pool.query(`ALTER TABLE employees ADD COLUMN isSuperAdmin BOOLEAN DEFAULT FALSE AFTER password;`);
  } catch {
    // Column already exists
  }

  try {
    await pool.query(`ALTER TABLE users MODIFY COLUMN role ENUM('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE') DEFAULT 'EMPLOYEE';`);
  } catch {
    // Column already enum
  }

  try {
    await pool.query(`ALTER TABLE users ADD COLUMN companyId VARCHAR(64) AFTER status;`);
  } catch {
    // Column already exists
  }

  try {
    await pool.query(`ALTER TABLE users ADD COLUMN companyCode VARCHAR(50) AFTER companyId;`);
  } catch {
    // Column already exists
  }

  try {
    await pool.query(`ALTER TABLE employees ADD COLUMN companyId VARCHAR(64) AFTER employeeCode;`);
  } catch {
    // Column already exists
  }

  try {
    await pool.query(`ALTER TABLE employees ADD COLUMN companyCode VARCHAR(50) AFTER companyId;`);
  } catch {
    // Column already exists
  }

  try {
    await pool.query(`ALTER TABLE employees DROP INDEX employeeCode;`);
  } catch {
    // Index already dropped or does not exist
  }

  try {
    await pool.query(`ALTER TABLE users ADD COLUMN phone VARCHAR(50) AFTER email;`);
  } catch {
    // Column phone already exists
  }

  try {
    await pool.query(`ALTER TABLE employees ADD UNIQUE KEY unique_company_emp (companyId, employeeCode);`);
  } catch {
    // Composite key already exists
  }

  // Safe migrations for newly added columns across tables
  const safeAlterQueries = [
    `ALTER TABLE leave_requests ADD COLUMN employeeCode VARCHAR(64);`,
    `ALTER TABLE leave_requests ADD COLUMN employeeEmail VARCHAR(255);`,
    `ALTER TABLE leave_requests ADD COLUMN employeeAvatar TEXT;`,
    `ALTER TABLE leave_requests ADD COLUMN companyId VARCHAR(64);`,
    `ALTER TABLE leave_requests ADD COLUMN companyCode VARCHAR(64);`,
    `ALTER TABLE attendance_records ADD COLUMN companyId VARCHAR(64);`,
    `ALTER TABLE attendance_records ADD COLUMN companyCode VARCHAR(50);`,
    `ALTER TABLE departments ADD COLUMN companyId VARCHAR(64);`,
    `ALTER TABLE designations ADD COLUMN companyId VARCHAR(64);`,
    `ALTER TABLE announcements ADD COLUMN companyId VARCHAR(64);`,
    `ALTER TABLE payroll_records ADD COLUMN companyId VARCHAR(64);`,
    `ALTER TABLE payroll_records ADD COLUMN paymentMethod VARCHAR(100);`,
  ];

  for (const q of safeAlterQueries) {
    try {
      await pool.query(q);
    } catch {
      // Column already exists or table freshly defined
    }
  }

  try {
    const [rows]: any = await pool.query(`SELECT COUNT(*) as count FROM system_settings`);
    if (rows && rows[0]?.count === 0) {
      await pool.query(
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
            rbacRoles: ['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE'],
            activeModules: ['Super Admin', 'Employees', 'Organization', 'Attendance', 'Leaves', 'Payroll', 'Recruitment'],
          }),
          new Date().toISOString(),
        ],
      );
    }
  } catch {
    // Ignore seeding error if table already populated
  }
}

export async function syncDataToMysql(pool: mysql.Pool, data: any) {
  try {
    // 0. Companies
    if (data.companies !== undefined) {
      const activeCompIds = (data.companies || []).map((c: any) => c.id);
      if (activeCompIds.length > 0) {
        await pool.query(`DELETE FROM companies WHERE id NOT IN (?)`, [activeCompIds]);
      } else {
        await pool.query(`DELETE FROM companies`);
      }

      for (const c of data.companies) {
        await pool.query(
          `INSERT INTO companies (id, companyCode, companyName, email, phone, address, status, adminUserId, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE companyCode=VALUES(companyCode), companyName=VALUES(companyName), email=VALUES(email), phone=VALUES(phone), address=VALUES(address), status=VALUES(status), adminUserId=VALUES(adminUserId), updatedAt=VALUES(updatedAt)`,
          [
            c.id,
            c.companyCode,
            c.companyName || c.name || '',
            c.email || '',
            c.phone || '',
            c.address || '',
            c.status || 'Active',
            c.adminUserId || null,
            c.createdAt || new Date().toISOString(),
            c.updatedAt || new Date().toISOString(),
          ],
        );
      }
    }

    // 1. Locations
    if (data.locations && data.locations.length > 0) {
      for (const loc of data.locations) {
        await pool.query(
          `INSERT INTO locations (id, name, city, country, address, isHeadquarter, latitude, longitude, radiusMeters, companyId, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name=VALUES(name), city=VALUES(city), country=VALUES(country), address=VALUES(address), isHeadquarter=VALUES(isHeadquarter), latitude=VALUES(latitude), longitude=VALUES(longitude), radiusMeters=VALUES(radiusMeters), companyId=VALUES(companyId), isActive=VALUES(isActive)`,
          [
            loc.id,
            loc.name,
            loc.city || '',
            loc.country || '',
            loc.address || '',
            Boolean(loc.isHeadquarter),
            loc.latitude || 0,
            loc.longitude || 0,
            loc.radiusMeters || 200,
            loc.companyId || null,
            loc.isActive !== undefined ? Boolean(loc.isActive) : true,
          ],
        );
      }
    }

    // 2. Departments
    if (data.departments && data.departments.length > 0) {
      for (const dept of data.departments) {
        await pool.query(
          `INSERT INTO departments (id, name, code, headEmployeeId, headName, employeeCount, description, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name=VALUES(name), code=VALUES(code), headEmployeeId=VALUES(headEmployeeId), headName=VALUES(headName), employeeCount=VALUES(employeeCount), description=VALUES(description)`,
          [dept.id, dept.name, dept.code, dept.headEmployeeId || null, dept.headName || null, dept.employeeCount || 0, dept.description || '', dept.createdAt || new Date().toISOString()],
        );
      }
    }

    // 3. Designations
    if (data.designations && data.designations.length > 0) {
      for (const des of data.designations) {
        await pool.query(
          `INSERT INTO designations (id, title, departmentId, departmentName, minSalary, maxSalary, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE title=VALUES(title), departmentId=VALUES(departmentId), departmentName=VALUES(departmentName), minSalary=VALUES(minSalary), maxSalary=VALUES(maxSalary)`,
          [des.id, des.title, des.departmentId, des.departmentName, des.minSalary || 0, des.maxSalary || 0, des.createdAt || new Date().toISOString()],
        );
      }
    }

    // 4. Users (Only ADMIN and SUPER_ADMIN are stored in MySQL users table)
    if (data.users !== undefined) {
      const adminUsers = (data.users || []).filter(
        (u: any) => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN' || u.isSuperAdmin === true,
      );
      const activeAdminUserIds = adminUsers.map((u: any) => u.id);
      if (activeAdminUserIds.length > 0) {
        await pool.query(`DELETE FROM users WHERE id NOT IN (?)`, [activeAdminUserIds]);
      } else {
        await pool.query(`DELETE FROM users`);
      }

      for (const u of adminUsers) {
        await pool.query(
          `INSERT INTO users (id, email, phone, password, firstName, lastName, role, isSuperAdmin, status, companyId, companyCode, employeeId, avatarUrl, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE email=VALUES(email), phone=VALUES(phone), password=VALUES(password), firstName=VALUES(firstName), lastName=VALUES(lastName), role=VALUES(role), isSuperAdmin=VALUES(isSuperAdmin), status=VALUES(status), companyId=VALUES(companyId), companyCode=VALUES(companyCode), employeeId=VALUES(employeeId), avatarUrl=VALUES(avatarUrl), updatedAt=VALUES(updatedAt)`,
          [
            u.id,
            u.email,
            u.phone || '',
            u.password || null,
            u.firstName,
            u.lastName,
            u.role,
            u.isSuperAdmin ? 1 : 0,
            u.status || 'Active',
            u.companyId || null,
            u.companyCode || null,
            u.employeeId || null,
            u.avatarUrl || '',
            u.createdAt || new Date().toISOString(),
            u.updatedAt || new Date().toISOString(),
          ],
        );
      }

      // 4.1 Sync Super Admins Table
      const superAdmins = (data.users || []).filter(
        (u: any) => u.isSuperAdmin === true || u.role === 'SUPER_ADMIN',
      );
      const activeSaIds = superAdmins.map((u: any) => `sa-${u.id}`);
      if (activeSaIds.length > 0) {
        await pool.query(`DELETE FROM super_admins WHERE id NOT IN (?)`, [activeSaIds]);
      } else {
        await pool.query(`DELETE FROM super_admins`);
      }

      for (const sa of superAdmins) {
        await pool.query(
          `INSERT INTO super_admins (id, userId, email, fullName, permissions, isRoot, status, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE email=VALUES(email), fullName=VALUES(fullName), status=VALUES(status), updatedAt=VALUES(updatedAt)`,
          [
            `sa-${sa.id}`,
            sa.id,
            sa.email,
            `${sa.firstName || ''} ${sa.lastName || ''}`.trim() || sa.email,
            JSON.stringify(['*']),
            1,
            sa.status || 'Active',
            sa.createdAt || new Date().toISOString(),
            sa.updatedAt || new Date().toISOString(),
          ],
        );
      }
    }

    // 5. Employees - ONLY real employees (exclude Super Admins and Admins)
    if (data.employees !== undefined) {
      const onlyEmployees = (data.employees || []).filter((emp: any) => {
        const linkedUser = (data.users || []).find(
          (u: any) => u.id === emp.userId || u.employeeId === emp.id || (u.email && emp.email && u.email.toLowerCase() === emp.email.toLowerCase()),
        );
        if (linkedUser) {
          if (linkedUser.role === 'SUPER_ADMIN' || linkedUser.role === 'ADMIN' || linkedUser.isSuperAdmin) {
            return false;
          }
          if (linkedUser.role === 'EMPLOYEE') {
            return true;
          }
        }
        if (emp.isSuperAdmin) return false;
        const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
        if (fullName.includes('super admin') || fullName.includes('superadmin') || fullName.includes('ravi admin')) return false;
        if (emp.email?.toLowerCase().includes('superadmin')) return false;
        if (emp.designationTitle?.toLowerCase().includes('super admin')) return false;
        return true;
      });

      const activeEmpIds = onlyEmployees.map((e: any) => e.id);
      if (activeEmpIds.length > 0) {
        await pool.query(`DELETE FROM employees WHERE id NOT IN (?)`, [activeEmpIds]);
      } else {
        await pool.query(`DELETE FROM employees`);
      }

      for (const emp of onlyEmployees) {
        await pool.query(
          `INSERT INTO employees (
            id, employeeCode, companyId, companyCode, firstName, lastName, email, phone, avatarUrl, gender, dateOfBirth, address,
            joiningDate, employmentType, status, departmentId, departmentName, designationId, designationTitle,
            reportingManagerId, reportingManagerName, workLocationId, workLocationName, shift,
            emergencyContact, bankDetails, taxInformation, education, previousExperience, skills, salary,
            createdAt, updatedAt
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
            employeeCode=VALUES(employeeCode), companyId=VALUES(companyId), companyCode=VALUES(companyCode), firstName=VALUES(firstName), lastName=VALUES(lastName), email=VALUES(email),
            phone=VALUES(phone), avatarUrl=VALUES(avatarUrl), gender=VALUES(gender), dateOfBirth=VALUES(dateOfBirth),
            address=VALUES(address), joiningDate=VALUES(joiningDate), employmentType=VALUES(employmentType), status=VALUES(status),
            departmentId=VALUES(departmentId), departmentName=VALUES(departmentName), designationId=VALUES(designationId),
            designationTitle=VALUES(designationTitle), reportingManagerId=VALUES(reportingManagerId), reportingManagerName=VALUES(reportingManagerName),
            workLocationId=VALUES(workLocationId), workLocationName=VALUES(workLocationName), shift=VALUES(shift),
            emergencyContact=VALUES(emergencyContact), bankDetails=VALUES(bankDetails), taxInformation=VALUES(taxInformation),
            education=VALUES(education), previousExperience=VALUES(previousExperience), skills=VALUES(skills), salary=VALUES(salary),
            updatedAt=VALUES(updatedAt)`,
          [
            emp.id, emp.employeeCode, emp.companyId || null, emp.companyCode || null, emp.firstName, emp.lastName, emp.email, emp.phone || '', emp.avatarUrl || '',
            emp.gender || 'Other', emp.dateOfBirth || '', emp.address || '', emp.joiningDate || '', emp.employmentType || 'Full-time',
            emp.status || 'Active', emp.departmentId || '', emp.departmentName || '', emp.designationId || '', emp.designationTitle || '',
            emp.reportingManagerId || null, emp.reportingManagerName || null, emp.workLocationId || '', emp.workLocationName || '',
            emp.shift || '', JSON.stringify(emp.emergencyContact || {}), JSON.stringify(emp.bankDetails || {}),
            JSON.stringify(emp.taxInformation || {}), JSON.stringify(emp.education || []), JSON.stringify(emp.previousExperience || []),
            JSON.stringify(emp.skills || []), JSON.stringify(emp.salary || {}),
            emp.createdAt || new Date().toISOString(), emp.updatedAt || new Date().toISOString(),
          ],
        );
      }
    }

    // 6. Attendance Records
    if (data.attendanceRecords && data.attendanceRecords.length > 0) {
      for (const att of data.attendanceRecords) {
        await pool.query(
          `INSERT INTO attendance_records (id, employeeId, employeeName, date, checkIn, checkOut, breakDurationMinutes, workingHours, overtimeHours, status, remarks, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE checkIn=VALUES(checkIn), checkOut=VALUES(checkOut), breakDurationMinutes=VALUES(breakDurationMinutes), workingHours=VALUES(workingHours), overtimeHours=VALUES(overtimeHours), status=VALUES(status), remarks=VALUES(remarks)`,
          [att.id, att.employeeId, att.employeeName, att.date, att.checkIn || '', att.checkOut || '', att.breakDurationMinutes || 0, att.workingHours || 0, att.overtimeHours || 0, att.status, att.remarks || '', att.createdAt || new Date().toISOString()],
        );
      }
    }

    // 6b. Work Sessions (Geo-fenced Timer)
    if (data.workSessions && data.workSessions.length > 0) {
      for (const ws of data.workSessions) {
        await pool.query(
          `INSERT INTO work_sessions (id, employeeId, employeeName, companyId, companyCode, officeLocationId, officeLocationName, status, startTime, endTime, durationSeconds, durationFormatted, startLatitude, startLongitude, startAccuracy, startDistanceMeters, startSelfieUrl, stopLatitude, stopLongitude, stopAccuracy, stopDistanceMeters, stopSelfieUrl, deviceInfo, ipAddress, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE status=VALUES(status), endTime=VALUES(endTime), durationSeconds=VALUES(durationSeconds), durationFormatted=VALUES(durationFormatted), stopLatitude=VALUES(stopLatitude), stopLongitude=VALUES(stopLongitude), stopAccuracy=VALUES(stopAccuracy), stopDistanceMeters=VALUES(stopDistanceMeters), stopSelfieUrl=VALUES(stopSelfieUrl), updatedAt=VALUES(updatedAt)`,
          [
            ws.id,
            ws.employeeId,
            ws.employeeName || '',
            ws.companyId,
            ws.companyCode || '',
            ws.officeLocationId,
            ws.officeLocationName || '',
            ws.status,
            ws.startTime,
            ws.endTime || null,
            ws.durationSeconds || 0,
            ws.durationFormatted || '',
            ws.startLatitude,
            ws.startLongitude,
            ws.startAccuracy || null,
            ws.startDistanceMeters || null,
            ws.startSelfieUrl,
            ws.stopLatitude || null,
            ws.stopLongitude || null,
            ws.stopAccuracy || null,
            ws.stopDistanceMeters || null,
            ws.stopSelfieUrl || null,
            ws.deviceInfo || '',
            ws.ipAddress || '',
            ws.createdAt,
            ws.updatedAt,
          ],
        );
      }
    }

    // 7. Leave Requests
    if (data.leaveRequests && data.leaveRequests.length > 0) {
      for (const lr of data.leaveRequests) {
        await pool.query(
          `INSERT INTO leave_requests (id, employeeId, employeeCode, employeeName, employeeEmail, employeeAvatar, departmentName, companyId, companyCode, leaveType, startDate, endDate, daysCount, isHalfDay, reason, status, appliedDate, managerApproverId, managerApproverName, hrApprovedAt, managerApprovedAt, comments)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE status=VALUES(status), comments=VALUES(comments), hrApprovedAt=VALUES(hrApprovedAt), managerApprovedAt=VALUES(managerApprovedAt), companyId=VALUES(companyId), companyCode=VALUES(companyCode)`,
          [lr.id, lr.employeeId, lr.employeeCode || '', lr.employeeName, lr.employeeEmail || '', lr.employeeAvatar || '', lr.departmentName || '', lr.companyId || '', lr.companyCode || '', lr.leaveType, lr.startDate, lr.endDate, lr.daysCount, Boolean(lr.isHalfDay), lr.reason, lr.status, lr.appliedDate, lr.managerApproverId || null, lr.managerApproverName || null, lr.hrApprovedAt || null, lr.managerApprovedAt || null, lr.comments || ''],
        );
      }
    }

    // 8. Payroll Records
    if (data.payrollRecords && data.payrollRecords.length > 0) {
      for (const pr of data.payrollRecords) {
        await pool.query(
          `INSERT INTO payroll_records (id, payrollMonth, employeeId, employeeName, employeeCode, designationTitle, departmentName, basicSalary, hra, allowances, bonus, overtimePay, grossSalary, pfDeduction, taxDeduction, professionalTax, otherDeductions, totalDeductions, netSalary, status, paymentDate, paymentMethod)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE status=VALUES(status), paymentDate=VALUES(paymentDate)`,
          [pr.id, pr.payrollMonth, pr.employeeId, pr.employeeName, pr.employeeCode, pr.designationTitle, pr.departmentName, pr.basicSalary, pr.hra, pr.allowances, pr.bonus, pr.overtimePay, pr.grossSalary, pr.pfDeduction, pr.taxDeduction, pr.professionalTax, pr.otherDeductions, pr.totalDeductions, pr.netSalary, pr.status, pr.paymentDate || '', pr.paymentMethod || ''],
        );
      }
    }

    // 9. Job Openings
    if (data.jobs && data.jobs.length > 0) {
      for (const j of data.jobs) {
        await pool.query(
          `INSERT INTO job_openings (id, title, departmentId, departmentName, designationTitle, location, employmentType, experienceLevel, openingsCount, salaryRange, description, skillsRequired, status, postedDate, applicantCount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE status=VALUES(status), applicantCount=VALUES(applicantCount)`,
          [j.id, j.title, j.departmentId, j.departmentName, j.designationTitle, j.location, j.employmentType, j.experienceLevel, j.openingsCount, j.salaryRange, j.description, JSON.stringify(j.skillsRequired || []), j.status, j.postedDate, j.applicantCount || 0],
        );
      }
    }

    // 10. Candidates
    if (data.candidates && data.candidates.length > 0) {
      for (const c of data.candidates) {
        await pool.query(
          `INSERT INTO candidates (id, jobId, jobTitle, fullName, email, phone, resumeUrl, experienceYears, currentCompany, skills, source, status, appliedDate, rating, notes, interviews)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE status=VALUES(status), notes=VALUES(notes), interviews=VALUES(interviews)`,
          [c.id, c.jobId, c.jobTitle, c.fullName, c.email, c.phone || '', c.resumeUrl || '', c.experienceYears || 0, c.currentCompany || '', JSON.stringify(c.skills || []), c.source || '', c.status, c.appliedDate, c.rating || 0, c.notes || '', JSON.stringify(c.interviews || [])],
        );
      }
    }

    // 11. Assets
    if (data.assets && data.assets.length > 0) {
      for (const a of data.assets) {
        await pool.query(
          `INSERT INTO company_assets (id, assetCode, name, category, serialNumber, condition_status, status, assignedToEmployeeId, assignedToEmployeeName, assignedDate, purchaseDate)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE status=VALUES(status), condition_status=VALUES(condition_status), assignedToEmployeeId=VALUES(assignedToEmployeeId), assignedToEmployeeName=VALUES(assignedToEmployeeName), assignedDate=VALUES(assignedDate)`,
          [a.id, a.assetCode, a.name, a.category, a.serialNumber || '', a.condition || 'Good', a.status, a.assignedToEmployeeId || null, a.assignedToEmployeeName || null, a.assignedDate || null, a.purchaseDate || ''],
        );
      }
    }

    // 12. Holidays
    if (data.holidays && data.holidays.length > 0) {
      for (const h of data.holidays) {
        await pool.query(
          `INSERT INTO holidays (id, name, date, dayOfWeek, type, description, locationId)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name=VALUES(name), date=VALUES(date), dayOfWeek=VALUES(dayOfWeek), type=VALUES(type), description=VALUES(description)`,
          [h.id, h.name, h.date, h.dayOfWeek, h.type, h.description || '', h.locationId || null],
        );
      }
    }

    // 13. Announcements
    if (data.announcements && data.announcements.length > 0) {
      for (const anc of data.announcements) {
        await pool.query(
          `INSERT INTO announcements (id, title, content, publishDate, targetAudience, priority, authorName)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE title=VALUES(title), content=VALUES(content), priority=VALUES(priority)`,
          [anc.id, anc.title, anc.content, anc.publishDate, anc.targetAudience, anc.priority, anc.authorName],
        );
      }
    }

    // 14. Notifications
    if (data.notifications && data.notifications.length > 0) {
      for (const n of data.notifications) {
        await pool.query(
          `INSERT INTO notifications (id, title, message, type, isRead, createdAt, link)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE isRead=VALUES(isRead)`,
          [n.id, n.title, n.message, n.type, Boolean(n.isRead), n.createdAt, n.link || ''],
        );
      }
    }

    // 15. Documents
    if (data.documents && data.documents.length > 0) {
      for (const d of data.documents) {
        await pool.query(
          `INSERT INTO documents (id, employeeId, employeeName, title, category, fileUrl, fileSize, uploadDate, expiryDate, verificationStatus, verifiedBy)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE verificationStatus=VALUES(verificationStatus), verifiedBy=VALUES(verifiedBy)`,
          [d.id, d.employeeId, d.employeeName, d.title, d.category, d.fileUrl, d.fileSize || '', d.uploadDate, d.expiryDate || null, d.verificationStatus, d.verifiedBy || null],
        );
      }
    }

    // 16. Audit Logs
    if (data.auditLogs && data.auditLogs.length > 0) {
      for (const al of data.auditLogs.slice(0, 50)) {
        await pool.query(
          `INSERT INTO audit_logs (id, userId, userName, userRole, action, module, recordId, details, ipAddress, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE details=VALUES(details)`,
          [al.id, al.userId, al.userName, al.userRole, al.action, al.module, al.recordId || null, al.details, al.ipAddress || '127.0.0.1', al.createdAt],
        );
      }
    }
  } catch (err) {
    console.error('Error synchronizing data to MySQL:', err);
  }
}

function parseJsonCol(val: any, fallback: any = null) {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export async function loadAllDataFromMysql(pool: mysql.Pool): Promise<Record<string, any> | null> {
  try {
    const [companiesRows]: any = await pool.query('SELECT * FROM companies');
    const [locationsRows]: any = await pool.query('SELECT * FROM locations');
    const [departmentsRows]: any = await pool.query('SELECT * FROM departments');
    const [designationsRows]: any = await pool.query('SELECT * FROM designations');
    const [usersRows]: any = await pool.query('SELECT * FROM users');
    const [employeesRows]: any = await pool.query('SELECT * FROM employees');
    const [holidaysRows]: any = await pool.query('SELECT * FROM holidays');
    const [leaveBalancesRows]: any = await pool.query('SELECT * FROM leave_balances');
    const [leaveRequestsRows]: any = await pool.query('SELECT * FROM leave_requests');
    const [attendanceRecordsRows]: any = await pool.query('SELECT * FROM attendance_records');
    const [workSessionsRows]: any = await pool.query('SELECT * FROM work_sessions');
    const [payrollRecordsRows]: any = await pool.query('SELECT * FROM payroll_records');
    const [jobsRows]: any = await pool.query('SELECT * FROM job_openings');
    const [candidatesRows]: any = await pool.query('SELECT * FROM candidates');
    const [assetsRows]: any = await pool.query('SELECT * FROM company_assets');
    const [trainingProgramsRows]: any = await pool.query('SELECT * FROM training_programs');
    const [employeeTrainingsRows]: any = await pool.query('SELECT * FROM employee_trainings');
    const [performanceCyclesRows]: any = await pool.query('SELECT * FROM performance_cycles');
    const [performanceReviewsRows]: any = await pool.query('SELECT * FROM performance_reviews');
    const [resignationsRows]: any = await pool.query('SELECT * FROM resignations');
    const [announcementsRows]: any = await pool.query('SELECT * FROM announcements');
    const [notificationsRows]: any = await pool.query('SELECT * FROM notifications');
    const [documentsRows]: any = await pool.query('SELECT * FROM documents');
    const [auditLogsRows]: any = await pool.query('SELECT * FROM audit_logs ORDER BY createdAt DESC LIMIT 100');
    const [settingsRows]: any = await pool.query('SELECT * FROM system_settings LIMIT 1');

    return {
      companies: (companiesRows || []).map((c: any) => ({
        id: c.id,
        companyCode: c.companyCode,
        companyName: c.companyName,
        name: c.companyName,
        email: c.email || '',
        phone: c.phone || '',
        address: c.address || '',
        status: c.status || 'Active',
        adminUserId: c.adminUserId || null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      locations: (locationsRows || []).map((loc: any) => ({
        id: loc.id,
        name: loc.name,
        city: loc.city || '',
        country: loc.country || '',
        address: loc.address || '',
        isHeadquarter: Boolean(loc.isHeadquarter),
        latitude: Number(loc.latitude) || 0,
        longitude: Number(loc.longitude) || 0,
        radiusMeters: Number(loc.radiusMeters) || 200,
        companyId: loc.companyId || '',
        isActive: loc.isActive !== undefined ? Boolean(loc.isActive) : true,
      })),
      departments: departmentsRows || [],
      designations: (designationsRows || []).map((d: any) => ({
        ...d,
        minSalary: Number(d.minSalary) || 0,
        maxSalary: Number(d.maxSalary) || 0,
      })),
      users: (usersRows || []).map((u: any) => ({
        ...u,
        isSuperAdmin: Boolean(u.isSuperAdmin),
      })),
      employees: (employeesRows || []).map((e: any) => ({
        ...e,
        isSuperAdmin: Boolean(e.isSuperAdmin),
        emergencyContact: parseJsonCol(e.emergencyContact, { name: '', relationship: '', phone: '' }),
        bankDetails: parseJsonCol(e.bankDetails, { bankName: '', accountNumber: '', ifscOrRouting: '', accountHolderName: '' }),
        taxInformation: parseJsonCol(e.taxInformation, { taxId: '', panOrSsn: '', taxRegime: '' }),
        education: parseJsonCol(e.education, []),
        previousExperience: parseJsonCol(e.previousExperience, []),
        skills: parseJsonCol(e.skills, []),
        salary: parseJsonCol(e.salary, { basic: 0, hra: 0, allowances: 0, bonus: 0, pf: 0, tax: 0, professionalTax: 0, gross: 0, net: 0 }),
      })),
      holidays: holidaysRows || [],
      leaveBalances: (leaveBalancesRows || []).map((lb: any) => ({
        id: lb.id,
        employeeId: lb.employeeId,
        year: Number(lb.year) || new Date().getFullYear(),
        casualLeave: parseJsonCol(lb.casualLeave, { total: 12, used: 0, remaining: 12 }),
        sickLeave: parseJsonCol(lb.sickLeave, { total: 10, used: 0, remaining: 10 }),
        paidLeave: parseJsonCol(lb.paidLeave, { total: 15, used: 0, remaining: 15 }),
      })),
      leaveRequests: (leaveRequestsRows || []).map((lr: any) => ({
        ...lr,
        daysCount: Number(lr.daysCount) || 1,
        isHalfDay: Boolean(lr.isHalfDay),
      })),
      attendanceRecords: (attendanceRecordsRows || []).map((att: any) => ({
        ...att,
        workingHours: Number(att.workingHours) || 0,
        overtimeHours: Number(att.overtimeHours) || 0,
        breakDurationMinutes: Number(att.breakDurationMinutes) || 0,
      })),
      workSessions: (workSessionsRows || []).map((ws: any) => ({
        ...ws,
        durationSeconds: Number(ws.durationSeconds) || 0,
        startLatitude: Number(ws.startLatitude) || 0,
        startLongitude: Number(ws.startLongitude) || 0,
        startAccuracy: Number(ws.startAccuracy) || 0,
        startDistanceMeters: Number(ws.startDistanceMeters) || 0,
        stopLatitude: ws.stopLatitude ? Number(ws.stopLatitude) : undefined,
        stopLongitude: ws.stopLongitude ? Number(ws.stopLongitude) : undefined,
        stopAccuracy: ws.stopAccuracy ? Number(ws.stopAccuracy) : undefined,
        stopDistanceMeters: ws.stopDistanceMeters ? Number(ws.stopDistanceMeters) : undefined,
      })),
      payrollRecords: (payrollRecordsRows || []).map((p: any) => ({
        ...p,
        basicSalary: Number(p.basicSalary) || 0,
        hra: Number(p.hra) || 0,
        allowances: Number(p.allowances) || 0,
        bonus: Number(p.bonus) || 0,
        overtimePay: Number(p.overtimePay) || 0,
        grossSalary: Number(p.grossSalary) || 0,
        pfDeduction: Number(p.pfDeduction) || 0,
        taxDeduction: Number(p.taxDeduction) || 0,
        professionalTax: Number(p.professionalTax) || 0,
        otherDeductions: Number(p.otherDeductions) || 0,
        totalDeductions: Number(p.totalDeductions) || 0,
        netSalary: Number(p.netSalary) || 0,
      })),
      jobs: (jobsRows || []).map((j: any) => ({
        ...j,
        openingsCount: Number(j.openingsCount) || 1,
        applicantCount: Number(j.applicantCount) || 0,
        skillsRequired: parseJsonCol(j.skillsRequired, []),
      })),
      candidates: (candidatesRows || []).map((c: any) => ({
        ...c,
        experienceYears: Number(c.experienceYears) || 0,
        rating: Number(c.rating) || 0,
        skills: parseJsonCol(c.skills, []),
        interviews: parseJsonCol(c.interviews, []),
      })),
      assets: assetsRows || [],
      trainingPrograms: (trainingProgramsRows || []).map((tp: any) => ({
        ...tp,
        durationHours: Number(tp.durationHours) || 0,
        enrolledCount: Number(tp.enrolledCount) || 0,
        skillsCovered: parseJsonCol(tp.skillsCovered, []),
      })),
      employeeTrainings: (employeeTrainingsRows || []).map((et: any) => ({
        ...et,
        progressPercent: Number(et.progressPercent) || 0,
      })),
      performanceCycles: (performanceCyclesRows || []).map((pc: any) => ({
        ...pc,
        year: Number(pc.year) || new Date().getFullYear(),
      })),
      performanceReviews: (performanceReviewsRows || []).map((pr: any) => ({
        ...pr,
        selfRating: pr.selfRating ? Number(pr.selfRating) : null,
        managerRating: pr.managerRating ? Number(pr.managerRating) : null,
        finalRating: pr.finalRating ? Number(pr.finalRating) : null,
      })),
      resignations: (resignationsRows || []).map((r: any) => ({
        ...r,
        noticePeriodDays: Number(r.noticePeriodDays) || 30,
        managerApproval: parseJsonCol(r.managerApproval, null),
        clearance: parseJsonCol(r.clearance, []),
      })),
      announcements: announcementsRows || [],
      notifications: (notificationsRows || []).map((n: any) => ({
        ...n,
        isRead: Boolean(n.isRead),
      })),
      documents: documentsRows || [],
      auditLogs: auditLogsRows || [],
      systemSettings: settingsRows && settingsRows.length > 0 ? settingsRows[0] : null,
    };
  } catch (err) {
    console.error('Error loading data from MySQL:', err);
    return null;
  }
}
