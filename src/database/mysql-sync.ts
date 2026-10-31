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
      city VARCHAR(100),
      state VARCHAR(100),
      gstin VARCHAR(50),
      industrySector VARCHAR(100),
      status VARCHAR(50) DEFAULT 'Active',
      adminUserId VARCHAR(64),
      createdAt VARCHAR(50),
      updatedAt VARCHAR(50)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS company_registration_requests (
      id VARCHAR(64) PRIMARY KEY,
      companyLegalName VARCHAR(255) NOT NULL,
      gstin VARCHAR(50),
      industrySector VARCHAR(100),
      officeAddress TEXT,
      city VARCHAR(100),
      state VARCHAR(100),
      firstName VARCHAR(100) NOT NULL,
      lastName VARCHAR(100) NOT NULL,
      officialEmail VARCHAR(255) NOT NULL,
      mobileNumber VARCHAR(50) NOT NULL,
      passwordHash VARCHAR(255) NOT NULL,
      status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
      rejectionReason TEXT,
      approvedCompanyId VARCHAR(64),
      approvedCompanyCode VARCHAR(50),
      approvedAdminUserId VARCHAR(64),
      approvedBy VARCHAR(64),
      approvedAt VARCHAR(50),
      rejectedAt VARCHAR(50),
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
      companyId VARCHAR(64),
      companyCode VARCHAR(50),
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
      companyId VARCHAR(64),
      companyCode VARCHAR(50),
      title VARCHAR(255) NOT NULL,
      departmentId VARCHAR(64),
      departmentName VARCHAR(255),
      minSalary DECIMAL(12,2) DEFAULT 0,
      maxSalary DECIMAL(12,2) DEFAULT 0,
      createdAt VARCHAR(50)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
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
      employeeCode VARCHAR(50),
      permissions JSON,
      avatarUrl TEXT,
      gender VARCHAR(20),
      dateOfBirth VARCHAR(30),
      address TEXT,
      joiningDate VARCHAR(30),
      employmentType VARCHAR(50),
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
      updatedAt VARCHAR(50),
      UNIQUE KEY uq_user_company_email (companyId, email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS holidays (
      id VARCHAR(64) PRIMARY KEY,
      companyId VARCHAR(64),
      companyCode VARCHAR(50),
      name VARCHAR(255) NOT NULL,
      date VARCHAR(30) NOT NULL,
      dayOfWeek VARCHAR(30),
      type VARCHAR(50),
      description TEXT,
      locationId VARCHAR(64)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS leave_balances (
      id VARCHAR(64) PRIMARY KEY,
      companyId VARCHAR(64),
      companyCode VARCHAR(50),
      employeeId VARCHAR(64) NOT NULL,
      year INT NOT NULL,
      casualLeave JSON,
      sickLeave JSON,
      paidLeave JSON
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS leave_requests (
      id VARCHAR(64) PRIMARY KEY,
      companyId VARCHAR(64),
      companyCode VARCHAR(50),
      employeeId VARCHAR(64) NOT NULL,
      employeeName VARCHAR(255),
      employeeAvatar TEXT,
      departmentName VARCHAR(255),
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
      companyId VARCHAR(64),
      companyCode VARCHAR(50),
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
      companyId VARCHAR(64),
      companyCode VARCHAR(50),
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
      companyId VARCHAR(64),
      companyCode VARCHAR(50),
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
      companyId VARCHAR(64),
      companyCode VARCHAR(50),
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
      companyId VARCHAR(64),
      companyCode VARCHAR(50),
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
      companyId VARCHAR(64),
      companyCode VARCHAR(50),
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
      companyId VARCHAR(64),
      companyCode VARCHAR(50),
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
      companyId VARCHAR(64),
      companyCode VARCHAR(50),
      title VARCHAR(255) NOT NULL,
      year INT NOT NULL,
      period VARCHAR(50),
      startDate VARCHAR(30),
      endDate VARCHAR(30),
      status VARCHAR(50)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS performance_reviews (
      id VARCHAR(64) PRIMARY KEY,
      companyId VARCHAR(64),
      companyCode VARCHAR(50),
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
      companyId VARCHAR(64),
      companyCode VARCHAR(50),
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
      companyId VARCHAR(64),
      companyCode VARCHAR(50),
      title VARCHAR(255) NOT NULL,
      content TEXT,
      publishDate VARCHAR(30),
      targetAudience VARCHAR(100),
      priority VARCHAR(50),
      authorName VARCHAR(255)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS notifications (
      id VARCHAR(64) PRIMARY KEY,
      companyId VARCHAR(64),
      companyCode VARCHAR(50),
      title VARCHAR(255) NOT NULL,
      message TEXT,
      type VARCHAR(50),
      isRead BOOLEAN DEFAULT FALSE,
      createdAt VARCHAR(50),
      link VARCHAR(255)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS documents (
      id VARCHAR(64) PRIMARY KEY,
      companyId VARCHAR(64),
      companyCode VARCHAR(50),
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
      companyId VARCHAR(64),
      companyCode VARCHAR(50),
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

    `CREATE TABLE IF NOT EXISTS refresh_tokens (
      id VARCHAR(64) PRIMARY KEY,
      userId VARCHAR(64) NOT NULL,
      companyId VARCHAR(64) NOT NULL,
      companyCode VARCHAR(50) NOT NULL,
      tokenHash VARCHAR(255) NOT NULL,
      familyId VARCHAR(64) NOT NULL,
      isRevoked BOOLEAN DEFAULT FALSE,
      expiresAt VARCHAR(50) NOT NULL,
      createdAt VARCHAR(50) NOT NULL,
      updatedAt VARCHAR(50) NOT NULL,
      INDEX idx_rt_user (userId),
      INDEX idx_rt_family (familyId),
      INDEX idx_rt_hash (tokenHash)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS employee_invitations (
      id VARCHAR(64) PRIMARY KEY,
      userId VARCHAR(64) NOT NULL,
      email VARCHAR(255) NOT NULL,
      companyId VARCHAR(64) NOT NULL,
      companyCode VARCHAR(50) NOT NULL,
      tokenHash VARCHAR(255) NOT NULL,
      expiresAt VARCHAR(50) NOT NULL,
      usedAt VARCHAR(50) DEFAULT NULL,
      revokedAt VARCHAR(50) DEFAULT NULL,
      createdAt VARCHAR(50) NOT NULL,
      INDEX idx_ei_user (userId),
      INDEX idx_ei_company (companyId),
      INDEX idx_ei_hash (tokenHash)
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

  // -------------------------------------------------------------
  // AUTOMATED CASCADE DELETION TRIGGERS IN MYSQL
  // Whenever a company or user is deleted directly in MySQL/phpMyAdmin,
  // all corresponding rows across all tables are deleted instantaneously!
  // -------------------------------------------------------------
  try {
    await pool.query('DROP TRIGGER IF EXISTS trg_cascade_delete_company');
    await pool.query(`
      CREATE TRIGGER trg_cascade_delete_company
      AFTER DELETE ON companies
      FOR EACH ROW
      BEGIN
        DELETE FROM users WHERE (companyId = OLD.id OR companyCode = OLD.companyCode) AND role != 'SUPER_ADMIN' AND isSuperAdmin = 0;
        DELETE FROM departments WHERE companyId = OLD.id OR companyCode = OLD.companyCode;
        DELETE FROM designations WHERE companyId = OLD.id OR companyCode = OLD.companyCode;
        DELETE FROM locations WHERE companyId = OLD.id OR companyCode = OLD.companyCode;
        DELETE FROM holidays WHERE companyId = OLD.id OR companyCode = OLD.companyCode;
        DELETE FROM leave_balances WHERE companyId = OLD.id OR companyCode = OLD.companyCode;
        DELETE FROM leave_requests WHERE companyId = OLD.id OR companyCode = OLD.companyCode;
        DELETE FROM attendance_records WHERE companyId = OLD.id OR companyCode = OLD.companyCode;
        DELETE FROM work_sessions WHERE companyId = OLD.id OR companyCode = OLD.companyCode;
        DELETE FROM payroll_records WHERE companyId = OLD.id OR companyCode = OLD.companyCode;
        DELETE FROM job_openings WHERE companyId = OLD.id OR companyCode = OLD.companyCode;
        DELETE FROM candidates WHERE companyId = OLD.id OR companyCode = OLD.companyCode;
        DELETE FROM company_assets WHERE companyId = OLD.id OR companyCode = OLD.companyCode;
        DELETE FROM training_programs WHERE companyId = OLD.id OR companyCode = OLD.companyCode;
        DELETE FROM employee_trainings WHERE companyId = OLD.id OR companyCode = OLD.companyCode;
        DELETE FROM performance_cycles WHERE companyId = OLD.id OR companyCode = OLD.companyCode;
        DELETE FROM performance_reviews WHERE companyId = OLD.id OR companyCode = OLD.companyCode;
        DELETE FROM resignations WHERE companyId = OLD.id OR companyCode = OLD.companyCode;
        DELETE FROM announcements WHERE companyId = OLD.id OR companyCode = OLD.companyCode;
        DELETE FROM notifications WHERE companyId = OLD.id OR companyCode = OLD.companyCode;
        DELETE FROM documents WHERE companyId = OLD.id OR companyCode = OLD.companyCode;
        DELETE FROM audit_logs WHERE companyId = OLD.id OR companyCode = OLD.companyCode;
        DELETE FROM employee_invitations WHERE companyId = OLD.id OR companyCode = OLD.companyCode;
        DELETE FROM refresh_tokens WHERE companyId = OLD.id OR companyCode = OLD.companyCode;
        DELETE FROM company_registration_requests WHERE approvedCompanyId = OLD.id OR approvedCompanyCode = OLD.companyCode;
      END;
    `);
  } catch (trgErr) {
    // If triggers are restricted by server permissions, backend cascade handles it
  }

  try {
    await pool.query('DROP TRIGGER IF EXISTS trg_cascade_delete_user');
    await pool.query(`
      CREATE TRIGGER trg_cascade_delete_user
      AFTER DELETE ON users
      FOR EACH ROW
      BEGIN
        DELETE FROM leave_balances WHERE employeeId = OLD.id OR (OLD.employeeId IS NOT NULL AND employeeId = OLD.employeeId);
        DELETE FROM leave_requests WHERE employeeId = OLD.id OR (OLD.employeeId IS NOT NULL AND employeeId = OLD.employeeId);
        DELETE FROM attendance_records WHERE employeeId = OLD.id OR (OLD.employeeId IS NOT NULL AND employeeId = OLD.employeeId);
        DELETE FROM work_sessions WHERE employeeId = OLD.id OR (OLD.employeeId IS NOT NULL AND employeeId = OLD.employeeId);
        DELETE FROM payroll_records WHERE employeeId = OLD.id OR (OLD.employeeId IS NOT NULL AND employeeId = OLD.employeeId);
        DELETE FROM employee_trainings WHERE employeeId = OLD.id OR (OLD.employeeId IS NOT NULL AND employeeId = OLD.employeeId);
        DELETE FROM performance_reviews WHERE employeeId = OLD.id OR (OLD.employeeId IS NOT NULL AND employeeId = OLD.employeeId);
        DELETE FROM resignations WHERE employeeId = OLD.id OR (OLD.employeeId IS NOT NULL AND employeeId = OLD.employeeId);
        DELETE FROM documents WHERE employeeId = OLD.id OR (OLD.employeeId IS NOT NULL AND employeeId = OLD.employeeId);
        DELETE FROM refresh_tokens WHERE userId = OLD.id;
        DELETE FROM employee_invitations WHERE email = OLD.email;
      END;
    `);
  } catch (trgErr) {
    // Fallback handled by backend
  }
}

/**
 * Purges any orphaned data in MySQL whose company has been deleted or no longer exists.
 * Preserves the SUPER_ADMIN account.
 */
export async function purgeOrphanedData(pool: mysql.Pool) {
  try {
    // 1. Delete non-super-admin users whose company does not exist in companies table
    await pool.query(`
      DELETE FROM users 
      WHERE role != 'SUPER_ADMIN' 
        AND isSuperAdmin = 0 
        AND (
          (companyId IS NULL OR companyId = '' OR companyId NOT IN (SELECT id FROM companies))
          AND
          (companyCode IS NULL OR companyCode = '' OR companyCode NOT IN (SELECT companyCode FROM companies))
        )
    `);

    // 2. Cascade delete from all child tables
    const tablesWithCompanyCols = [
      'departments', 'designations', 'locations', 'holidays', 'leave_balances',
      'leave_requests', 'attendance_records', 'work_sessions', 'payroll_records',
      'job_openings', 'candidates', 'company_assets', 'training_programs',
      'employee_trainings', 'performance_cycles', 'performance_reviews',
      'resignations', 'announcements', 'notifications', 'documents',
      'audit_logs', 'refresh_tokens', 'employee_invitations'
    ];

    for (const tbl of tablesWithCompanyCols) {
      try {
        await pool.query(`
          DELETE FROM ${tbl}
          WHERE (
            (companyId IS NULL OR companyId = '' OR companyId NOT IN (SELECT id FROM companies))
            AND
            (companyCode IS NULL OR companyCode = '' OR companyCode NOT IN (SELECT companyCode FROM companies))
          )
        `);
      } catch {}
    }

    // 3. Purge orphaned leave balances and refresh tokens where user no longer exists
    try {
      await pool.query(`DELETE FROM leave_balances WHERE employeeId NOT IN (SELECT id FROM users)`);
    } catch {}

    try {
      await pool.query(`DELETE FROM refresh_tokens WHERE userId NOT IN (SELECT id FROM users)`);
    } catch {}
  } catch (err) {
    // Handled
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

      // Automatically purge all orphaned records in child tables for any company that was deleted
      await purgeOrphanedData(pool);

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
          `INSERT INTO departments (id, companyId, companyCode, name, code, headEmployeeId, headName, employeeCount, description, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             companyId=COALESCE(VALUES(companyId), departments.companyId, 'cmp-1'),
             companyCode=COALESCE(VALUES(companyCode), departments.companyCode, 'CMP-000001'),
             name=VALUES(name), code=VALUES(code), headEmployeeId=VALUES(headEmployeeId), headName=VALUES(headName), employeeCount=VALUES(employeeCount), description=VALUES(description)`,
          [dept.id, dept.companyId || 'cmp-1', dept.companyCode || 'CMP-000001', dept.name, dept.code, dept.headEmployeeId || null, dept.headName || null, dept.employeeCount || 0, dept.description || '', dept.createdAt || new Date().toISOString()],
        );
      }
    }

    // 3. Designations
    if (data.designations && data.designations.length > 0) {
      for (const des of data.designations) {
        await pool.query(
          `INSERT INTO designations (id, companyId, companyCode, title, departmentId, departmentName, minSalary, maxSalary, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             companyId=COALESCE(VALUES(companyId), designations.companyId, 'cmp-1'),
             companyCode=COALESCE(VALUES(companyCode), designations.companyCode, 'CMP-000001'),
             title=VALUES(title), departmentId=VALUES(departmentId), departmentName=VALUES(departmentName), minSalary=VALUES(minSalary), maxSalary=VALUES(maxSalary)`,
          [des.id, des.companyId || 'cmp-1', des.companyCode || 'CMP-000001', des.title, des.departmentId, des.departmentName, des.minSalary || 0, des.maxSalary || 0, des.createdAt || new Date().toISOString()],
        );
      }
    }

    // 4. Users (Unified login accounts: SUPER_ADMIN, ADMIN, EMPLOYEE)
    if (data.users !== undefined) {
      const allUsers = data.users || [];
      const activeUserIds = allUsers.map((u: any) => u.id).filter(Boolean);
      if (activeUserIds.length > 0) {
        await pool.query(`DELETE FROM users WHERE id NOT IN (?)`, [activeUserIds]);
      } else {
        await pool.query(`DELETE FROM users`);
      }

      for (const u of allUsers) {
        let employeeCode = u.employeeCode || null;
        if (!employeeCode && u.employeeId && data.employees) {
          const matchedEmp = data.employees.find((e: any) => e.id === u.employeeId);
          if (matchedEmp) {
            employeeCode = matchedEmp.employeeCode;
          }
        }

        const isSuper = u.role === 'SUPER_ADMIN' || u.isSuperAdmin === true;
        const role = u.role || (isSuper ? 'SUPER_ADMIN' : 'EMPLOYEE');
        const permissions = u.permissions
          ? (typeof u.permissions === 'string' ? u.permissions : JSON.stringify(u.permissions))
          : (isSuper ? JSON.stringify(['*']) : null);

        await pool.query(
          `INSERT INTO users (
            id, email, phone, password, firstName, lastName, role, isSuperAdmin, status, companyId, companyCode, employeeId, employeeCode, permissions, avatarUrl,
            gender, dateOfBirth, address, joiningDate, employmentType, departmentId, departmentName, designationId, designationTitle,
            reportingManagerId, reportingManagerName, workLocationId, workLocationName, shift, emergencyContact, bankDetails, taxInformation, education, previousExperience, skills, salary,
            createdAt, updatedAt
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
            email=VALUES(email), phone=VALUES(phone), password=VALUES(password), firstName=VALUES(firstName), lastName=VALUES(lastName), role=VALUES(role),
            isSuperAdmin=VALUES(isSuperAdmin), status=VALUES(status),
            companyId=COALESCE(VALUES(companyId), users.companyId, 'cmp-1'),
            companyCode=COALESCE(VALUES(companyCode), users.companyCode, 'CMP-000001'),
            employeeId=VALUES(employeeId), employeeCode=VALUES(employeeCode),
            permissions=VALUES(permissions), avatarUrl=VALUES(avatarUrl),
            gender=VALUES(gender), dateOfBirth=VALUES(dateOfBirth), address=VALUES(address), joiningDate=VALUES(joiningDate), employmentType=VALUES(employmentType),
            departmentId=VALUES(departmentId), departmentName=VALUES(departmentName), designationId=VALUES(designationId), designationTitle=VALUES(designationTitle),
            reportingManagerId=VALUES(reportingManagerId), reportingManagerName=VALUES(reportingManagerName), workLocationId=VALUES(workLocationId), workLocationName=VALUES(workLocationName),
            shift=VALUES(shift), emergencyContact=VALUES(emergencyContact), bankDetails=VALUES(bankDetails), taxInformation=VALUES(taxInformation), education=VALUES(education), previousExperience=VALUES(previousExperience), skills=VALUES(skills), salary=VALUES(salary),
            updatedAt=VALUES(updatedAt)`,
          [
            u.id,
            u.email,
            u.phone || '',
            u.password || null,
            u.firstName || '',
            u.lastName || '',
            role,
            isSuper ? 1 : 0,
            u.status || 'Active',
            u.companyId || 'cmp-1',
            u.companyCode || 'CMP-000001',
            isSuper ? null : (u.employeeId || null),
            isSuper ? null : employeeCode,
            permissions,
            u.avatarUrl || '',
            isSuper ? null : (u.gender || 'Other'),
            isSuper ? null : (u.dateOfBirth || null),
            isSuper ? null : (u.address || null),
            isSuper ? null : (u.joiningDate || null),
            isSuper ? null : (u.employmentType || null),
            isSuper ? null : (u.departmentId || null),
            isSuper ? null : (u.departmentName || null),
            isSuper ? null : (u.designationId || null),
            isSuper ? null : (u.designationTitle || null),
            isSuper ? null : (u.reportingManagerId || null),
            isSuper ? null : (u.reportingManagerName || null),
            isSuper ? null : (u.workLocationId || null),
            isSuper ? null : (u.workLocationName || null),
            isSuper ? null : (u.shift || null),
            isSuper ? null : (u.emergencyContact ? (typeof u.emergencyContact === 'string' ? u.emergencyContact : JSON.stringify(u.emergencyContact)) : null),
            isSuper ? null : (u.bankDetails ? (typeof u.bankDetails === 'string' ? u.bankDetails : JSON.stringify(u.bankDetails)) : null),
            isSuper ? null : (u.taxInformation ? (typeof u.taxInformation === 'string' ? u.taxInformation : JSON.stringify(u.taxInformation)) : null),
            isSuper ? null : (u.education ? (typeof u.education === 'string' ? u.education : JSON.stringify(u.education)) : null),
            isSuper ? null : (u.previousExperience ? (typeof u.previousExperience === 'string' ? u.previousExperience : JSON.stringify(u.previousExperience)) : null),
            isSuper ? null : (u.skills ? (typeof u.skills === 'string' ? u.skills : JSON.stringify(u.skills)) : null),
            isSuper ? null : (u.salary ? (typeof u.salary === 'string' ? u.salary : JSON.stringify(u.salary)) : null),
            u.createdAt || new Date().toISOString(),
            u.updatedAt || new Date().toISOString(),
          ],
        );
      }
    }

    // 6. Attendance Records
    if (data.attendanceRecords && data.attendanceRecords.length > 0) {
      for (const att of data.attendanceRecords) {
        await pool.query(
          `INSERT INTO attendance_records (id, companyId, companyCode, employeeId, employeeName, date, checkIn, checkOut, breakDurationMinutes, workingHours, overtimeHours, status, remarks, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE companyId=VALUES(companyId), companyCode=VALUES(companyCode), checkIn=VALUES(checkIn), checkOut=VALUES(checkOut), breakDurationMinutes=VALUES(breakDurationMinutes), workingHours=VALUES(workingHours), overtimeHours=VALUES(overtimeHours), status=VALUES(status), remarks=VALUES(remarks)`,
          [att.id, (att as any).companyId || null, (att as any).companyCode || null, att.employeeId, att.employeeName, att.date, att.checkIn || '', att.checkOut || '', att.breakDurationMinutes || 0, att.workingHours || 0, att.overtimeHours || 0, att.status, att.remarks || '', att.createdAt || new Date().toISOString()],
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
          `INSERT INTO leave_requests (id, companyId, companyCode, employeeId, employeeName, employeeAvatar, departmentName, leaveType, startDate, endDate, daysCount, isHalfDay, reason, status, appliedDate, managerApproverId, managerApproverName, hrApprovedAt, managerApprovedAt, comments)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE companyId=VALUES(companyId), companyCode=VALUES(companyCode), status=VALUES(status), comments=VALUES(comments), hrApprovedAt=VALUES(hrApprovedAt), managerApprovedAt=VALUES(managerApprovedAt)`,
          [lr.id, (lr as any).companyId || null, (lr as any).companyCode || null, lr.employeeId, lr.employeeName, lr.employeeAvatar || '', lr.departmentName || '', lr.leaveType, lr.startDate, lr.endDate, lr.daysCount, Boolean(lr.isHalfDay), lr.reason, lr.status, lr.appliedDate, lr.managerApproverId || null, lr.managerApproverName || null, lr.hrApprovedAt || null, lr.managerApprovedAt || null, lr.comments || ''],
        );
      }
    }

    // 7b. Leave Balances
    if (data.leaveBalances && data.leaveBalances.length > 0) {
      for (const lb of data.leaveBalances) {
        await pool.query(
          `INSERT INTO leave_balances (id, companyId, companyCode, employeeId, year, casualLeave, sickLeave, paidLeave)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             companyId=COALESCE(VALUES(companyId), leave_balances.companyId),
             companyCode=COALESCE(VALUES(companyCode), leave_balances.companyCode),
             casualLeave=VALUES(casualLeave), sickLeave=VALUES(sickLeave), paidLeave=VALUES(paidLeave)`,
          [
            lb.id,
            (lb as any).companyId || null,
            (lb as any).companyCode || null,
            lb.employeeId,
            lb.year,
            JSON.stringify(lb.casualLeave || {}),
            JSON.stringify(lb.sickLeave || {}),
            JSON.stringify(lb.paidLeave || {}),
          ],
        );
      }
    }

    // 8. Payroll Records
    if (data.payrollRecords && data.payrollRecords.length > 0) {
      for (const pr of data.payrollRecords) {
        await pool.query(
          `INSERT INTO payroll_records (id, companyId, companyCode, payrollMonth, employeeId, employeeName, employeeCode, designationTitle, departmentName, basicSalary, hra, allowances, bonus, overtimePay, grossSalary, pfDeduction, taxDeduction, professionalTax, otherDeductions, totalDeductions, netSalary, status, paymentDate, paymentMethod)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE companyId=VALUES(companyId), companyCode=VALUES(companyCode), status=VALUES(status), paymentDate=VALUES(paymentDate)`,
          [pr.id, pr.companyId || null, pr.companyCode || null, pr.payrollMonth, pr.employeeId, pr.employeeName, pr.employeeCode, pr.designationTitle, pr.departmentName, pr.basicSalary, pr.hra, pr.allowances, pr.bonus, pr.overtimePay, pr.grossSalary, pr.pfDeduction, pr.taxDeduction, pr.professionalTax, pr.otherDeductions, pr.totalDeductions, pr.netSalary, pr.status, pr.paymentDate || '', pr.paymentMethod || ''],
        );
      }
    }

    // 9. Job Openings
    if (data.jobs && data.jobs.length > 0) {
      for (const j of data.jobs) {
        await pool.query(
          `INSERT INTO job_openings (id, companyId, companyCode, title, departmentId, departmentName, designationTitle, location, employmentType, experienceLevel, openingsCount, salaryRange, description, skillsRequired, status, postedDate, applicantCount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE companyId=VALUES(companyId), companyCode=VALUES(companyCode), status=VALUES(status), applicantCount=VALUES(applicantCount)`,
          [j.id, j.companyId || null, j.companyCode || null, j.title, j.departmentId, j.departmentName, j.designationTitle, j.location, j.employmentType, j.experienceLevel, j.openingsCount, j.salaryRange, j.description, JSON.stringify(j.skillsRequired || []), j.status, j.postedDate, j.applicantCount || 0],
        );
      }
    }

    // 10. Candidates
    if (data.candidates && data.candidates.length > 0) {
      for (const c of data.candidates) {
        await pool.query(
          `INSERT INTO candidates (id, companyId, companyCode, jobId, jobTitle, fullName, email, phone, resumeUrl, experienceYears, currentCompany, skills, source, status, appliedDate, rating, notes, interviews)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE companyId=VALUES(companyId), companyCode=VALUES(companyCode), status=VALUES(status), notes=VALUES(notes), interviews=VALUES(interviews)`,
          [c.id, c.companyId || null, c.companyCode || null, c.jobId, c.jobTitle, c.fullName, c.email, c.phone || '', c.resumeUrl || '', c.experienceYears || 0, c.currentCompany || '', JSON.stringify(c.skills || []), c.source || '', c.status, c.appliedDate, c.rating || 0, c.notes || '', JSON.stringify(c.interviews || [])],
        );
      }
    }

    // 11. Assets
    if (data.assets && data.assets.length > 0) {
      for (const a of data.assets) {
        await pool.query(
          `INSERT INTO company_assets (id, companyId, companyCode, assetCode, name, category, serialNumber, condition_status, status, assignedToEmployeeId, assignedToEmployeeName, assignedDate, purchaseDate)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE companyId=VALUES(companyId), companyCode=VALUES(companyCode), status=VALUES(status), condition_status=VALUES(condition_status), assignedToEmployeeId=VALUES(assignedToEmployeeId), assignedToEmployeeName=VALUES(assignedToEmployeeName), assignedDate=VALUES(assignedDate)`,
          [a.id, a.companyId || null, a.companyCode || null, a.assetCode, a.name, a.category, a.serialNumber || '', a.condition || 'Good', a.status, a.assignedToEmployeeId || null, a.assignedToEmployeeName || null, a.assignedDate || null, a.purchaseDate || ''],
        );
      }
    }

    // 12. Holidays
    if (data.holidays && data.holidays.length > 0) {
      for (const h of data.holidays) {
        await pool.query(
          `INSERT INTO holidays (id, companyId, companyCode, name, date, dayOfWeek, type, description, locationId)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             companyId=COALESCE(VALUES(companyId), holidays.companyId),
             companyCode=COALESCE(VALUES(companyCode), holidays.companyCode),
             name=VALUES(name), date=VALUES(date), dayOfWeek=VALUES(dayOfWeek), type=VALUES(type), description=VALUES(description)`,
          [h.id, h.companyId || null, h.companyCode || null, h.name, h.date, h.dayOfWeek, h.type, h.description || '', h.locationId || null],
        );
      }
    }

    // 13. Announcements
    if (data.announcements && data.announcements.length > 0) {
      for (const anc of data.announcements) {
        await pool.query(
          `INSERT INTO announcements (id, companyId, companyCode, title, content, publishDate, targetAudience, priority, authorName)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             companyId=COALESCE(VALUES(companyId), announcements.companyId, 'cmp-1'),
             companyCode=COALESCE(VALUES(companyCode), announcements.companyCode, 'CMP-000001'),
             title=VALUES(title), content=VALUES(content), priority=VALUES(priority)`,
          [anc.id, anc.companyId || 'cmp-1', anc.companyCode || 'CMP-000001', anc.title, anc.content, anc.publishDate, anc.targetAudience, anc.priority, anc.authorName],
        );
      }
    }

    // 14. Notifications
    if (data.notifications && data.notifications.length > 0) {
      for (const n of data.notifications) {
        await pool.query(
          `INSERT INTO notifications (id, companyId, companyCode, title, message, type, isRead, createdAt, link)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE companyId=VALUES(companyId), companyCode=VALUES(companyCode), isRead=VALUES(isRead)`,
          [n.id, n.companyId || null, n.companyCode || null, n.title, n.message, n.type, Boolean(n.isRead), n.createdAt, n.link || ''],
        );
      }
    }

    // 15. Documents
    if (data.documents && data.documents.length > 0) {
      for (const d of data.documents) {
        await pool.query(
          `INSERT INTO documents (id, companyId, companyCode, employeeId, employeeName, title, category, fileUrl, fileSize, uploadDate, expiryDate, verificationStatus, verifiedBy)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             companyId=COALESCE(VALUES(companyId), documents.companyId, 'cmp-1'),
             companyCode=COALESCE(VALUES(companyCode), documents.companyCode, 'CMP-000001'),
             verificationStatus=VALUES(verificationStatus), verifiedBy=VALUES(verifiedBy)`,
          [d.id, d.companyId || 'cmp-1', d.companyCode || 'CMP-000001', d.employeeId, d.employeeName, d.title, d.category, d.fileUrl, d.fileSize || '', d.uploadDate, d.expiryDate || null, d.verificationStatus, d.verifiedBy || null],
        );
      }
    }

    // 16. Audit Logs
    if (data.auditLogs && data.auditLogs.length > 0) {
      for (const al of data.auditLogs.slice(0, 50)) {
        await pool.query(
          `INSERT INTO audit_logs (id, companyId, companyCode, userId, userName, userRole, action, module, recordId, details, ipAddress, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             companyId=COALESCE(VALUES(companyId), audit_logs.companyId, 'cmp-1'),
             companyCode=COALESCE(VALUES(companyCode), audit_logs.companyCode, 'CMP-000001'),
             details=VALUES(details)`,
          [al.id, al.companyId || 'cmp-1', al.companyCode || 'CMP-000001', al.userId, al.userName, al.userRole, al.action, al.module, al.recordId || null, al.details, al.ipAddress || '127.0.0.1', al.createdAt],
        );
      }
    }

    // 17. Training Programs
    if (data.trainingPrograms && data.trainingPrograms.length > 0) {
      for (const tp of data.trainingPrograms) {
        await pool.query(
          `INSERT INTO training_programs (id, companyId, companyCode, title, description, trainerName, skillsCovered, startDate, endDate, durationHours, status, enrolledCount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             companyId=COALESCE(VALUES(companyId), training_programs.companyId, 'cmp-1'),
             companyCode=COALESCE(VALUES(companyCode), training_programs.companyCode, 'CMP-000001'),
             title=VALUES(title), status=VALUES(status), enrolledCount=VALUES(enrolledCount)`,
          [tp.id, tp.companyId || 'cmp-1', tp.companyCode || 'CMP-000001', tp.title, tp.description || '', tp.trainerName || '', JSON.stringify(tp.skillsCovered || []), tp.startDate, tp.endDate, tp.durationHours || 0, tp.status, tp.enrolledCount || 0],
        );
      }
    }

    // 18. Employee Trainings
    if (data.employeeTrainings && data.employeeTrainings.length > 0) {
      for (const et of data.employeeTrainings) {
        await pool.query(
          `INSERT INTO employee_trainings (id, companyId, companyCode, trainingId, trainingTitle, employeeId, employeeName, status, progressPercent, completionDate, certificateUrl)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             companyId=COALESCE(VALUES(companyId), employee_trainings.companyId, 'cmp-1'),
             companyCode=COALESCE(VALUES(companyCode), employee_trainings.companyCode, 'CMP-000001'),
             status=VALUES(status), progressPercent=VALUES(progressPercent), completionDate=VALUES(completionDate)`,
          [et.id, et.companyId || 'cmp-1', et.companyCode || 'CMP-000001', et.trainingId, et.trainingTitle, et.employeeId, et.employeeName, et.status, et.progressPercent || 0, et.completionDate || null, et.certificateUrl || null],
        );
      }
    }

    // 19. Performance Cycles
    if (data.performanceCycles && data.performanceCycles.length > 0) {
      for (const pc of data.performanceCycles) {
        await pool.query(
          `INSERT INTO performance_cycles (id, companyId, companyCode, title, year, period, startDate, endDate, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             companyId=COALESCE(VALUES(companyId), performance_cycles.companyId, 'cmp-1'),
             companyCode=COALESCE(VALUES(companyCode), performance_cycles.companyCode, 'CMP-000001'),
             status=VALUES(status)`,
          [pc.id, pc.companyId || 'cmp-1', pc.companyCode || 'CMP-000001', pc.title, pc.year, pc.period, pc.startDate, pc.endDate, pc.status],
        );
      }
    }

    // 20. Performance Reviews
    if (data.performanceReviews && data.performanceReviews.length > 0) {
      for (const pr of data.performanceReviews) {
        await pool.query(
          `INSERT INTO performance_reviews (id, companyId, companyCode, cycleId, cycleTitle, employeeId, employeeName, departmentName, managerId, managerName, selfRating, selfComments, managerRating, managerFeedback, finalRating, appraisalRecommended, status, completedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             companyId=COALESCE(VALUES(companyId), performance_reviews.companyId, 'cmp-1'),
             companyCode=COALESCE(VALUES(companyCode), performance_reviews.companyCode, 'CMP-000001'),
             status=VALUES(status), selfRating=VALUES(selfRating), managerRating=VALUES(managerRating), finalRating=VALUES(finalRating)`,
          [pr.id, pr.companyId || 'cmp-1', pr.companyCode || 'CMP-000001', pr.cycleId, pr.cycleTitle, pr.employeeId, pr.employeeName, pr.departmentName || '', pr.managerId || '', pr.managerName || '', pr.selfRating || null, pr.selfComments || null, pr.managerRating || null, pr.managerFeedback || null, pr.finalRating || null, pr.appraisalRecommended || null, pr.status, pr.completedAt || null],
        );
      }
    }

    // 21. Resignations
    if (data.resignations && data.resignations.length > 0) {
      for (const res of data.resignations) {
        await pool.query(
          `INSERT INTO resignations (id, companyId, companyCode, employeeId, employeeName, employeeCode, departmentName, resignationDate, lastWorkingDay, noticePeriodDays, reason, status, managerApproval, clearance)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             companyId=COALESCE(VALUES(companyId), resignations.companyId, 'cmp-1'),
             companyCode=COALESCE(VALUES(companyCode), resignations.companyCode, 'CMP-000001'),
             status=VALUES(status), managerApproval=VALUES(managerApproval), clearance=VALUES(clearance)`,
          [res.id, res.companyId || 'cmp-1', res.companyCode || 'CMP-000001', res.employeeId, res.employeeName, res.employeeCode, res.departmentName, res.resignationDate, res.lastWorkingDay, res.noticePeriodDays || 30, res.reason, res.status, JSON.stringify(res.managerApproval || {}), JSON.stringify(res.clearance || {})],
        );
      }
    }

    // 22. Refresh Tokens
    if (data.refreshTokens && data.refreshTokens.length > 0) {
      for (const rt of data.refreshTokens) {
        await pool.query(
          `INSERT INTO refresh_tokens (id, userId, companyId, companyCode, tokenHash, familyId, isRevoked, expiresAt, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE isRevoked=VALUES(isRevoked), updatedAt=VALUES(updatedAt)`,
          [rt.id, rt.userId, rt.companyId || 'cmp-1', rt.companyCode || 'CMP-000001', rt.tokenHash, rt.familyId, rt.isRevoked ? 1 : 0, rt.expiresAt, rt.createdAt, rt.updatedAt],
        );
      }
    }

    // 23. Employee Invitations
    if (data.employeeInvitations && data.employeeInvitations.length > 0) {
      for (const inv of data.employeeInvitations) {
        await pool.query(
          `INSERT INTO employee_invitations (id, userId, email, companyId, companyCode, tokenHash, expiresAt, usedAt, revokedAt, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE usedAt=VALUES(usedAt), revokedAt=VALUES(revokedAt)`,
          [
            inv.id,
            inv.userId,
            inv.email,
            inv.companyId || 'cmp-1',
            inv.companyCode || 'CMP-000001',
            inv.tokenHash,
            inv.expiresAt,
            inv.usedAt || null,
            inv.revokedAt || null,
            inv.createdAt,
          ],
        );
      }
    }
  } catch (err) {
    console.error('Error synchronizing data to MySQL:', err);
  }
}
