import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export async function getMysqlPool() {
  return mysql.createPool({
    host: process.env.DATABASE_HOST || 'localhost',
    port: Number(process.env.DATABASE_PORT) || 3306,
    user: process.env.DATABASE_USER || 'root',
    password: process.env.DATABASE_PASSWORD || '',
    database: process.env.DATABASE_NAME || 'hrms',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
}

export async function initializeMysqlTables(pool: mysql.Pool) {
  const tableDefinitions = [
    `CREATE TABLE IF NOT EXISTS locations (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      city VARCHAR(100),
      country VARCHAR(100),
      address TEXT,
      isHeadquarter BOOLEAN DEFAULT FALSE
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
      password VARCHAR(255),
      firstName VARCHAR(100),
      lastName VARCHAR(100),
      role VARCHAR(50),
      employeeId VARCHAR(64),
      avatarUrl TEXT,
      createdAt VARCHAR(50),
      updatedAt VARCHAR(50)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS employees (
      id VARCHAR(64) PRIMARY KEY,
      employeeCode VARCHAR(50) NOT NULL UNIQUE,
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
  ];

  for (const sql of tableDefinitions) {
    await pool.query(sql);
  }

  try {
    await pool.query(`ALTER TABLE users ADD COLUMN password VARCHAR(255) AFTER email;`);
  } catch {
    // Column already exists or table freshly created
  }
}

export async function syncDataToMysql(pool: mysql.Pool, data: any) {
  try {
    // 1. Locations
    if (data.locations && data.locations.length > 0) {
      for (const loc of data.locations) {
        await pool.query(
          `INSERT INTO locations (id, name, city, country, address, isHeadquarter)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name=VALUES(name), city=VALUES(city), country=VALUES(country), address=VALUES(address), isHeadquarter=VALUES(isHeadquarter)`,
          [loc.id, loc.name, loc.city || '', loc.country || '', loc.address || '', Boolean(loc.isHeadquarter)],
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

    // 4. Users
    if (data.users && data.users.length > 0) {
      for (const u of data.users) {
        await pool.query(
          `INSERT INTO users (id, email, password, firstName, lastName, role, employeeId, avatarUrl, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE email=VALUES(email), password=VALUES(password), firstName=VALUES(firstName), lastName=VALUES(lastName), role=VALUES(role), employeeId=VALUES(employeeId), avatarUrl=VALUES(avatarUrl), updatedAt=VALUES(updatedAt)`,
          [u.id, u.email, u.password || null, u.firstName, u.lastName, u.role, u.employeeId || null, u.avatarUrl || '', u.createdAt || new Date().toISOString(), u.updatedAt || new Date().toISOString()],
        );
      }
    }

    // 5. Employees
    if (data.employees && data.employees.length > 0) {
      for (const emp of data.employees) {
        await pool.query(
          `INSERT INTO employees (
            id, employeeCode, firstName, lastName, email, phone, avatarUrl, gender, dateOfBirth, address,
            joiningDate, employmentType, status, departmentId, departmentName, designationId, designationTitle,
            reportingManagerId, reportingManagerName, workLocationId, workLocationName, shift,
            emergencyContact, bankDetails, taxInformation, education, previousExperience, skills, salary,
            createdAt, updatedAt
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
            employeeCode=VALUES(employeeCode), firstName=VALUES(firstName), lastName=VALUES(lastName), email=VALUES(email),
            phone=VALUES(phone), avatarUrl=VALUES(avatarUrl), gender=VALUES(gender), dateOfBirth=VALUES(dateOfBirth),
            address=VALUES(address), joiningDate=VALUES(joiningDate), employmentType=VALUES(employmentType), status=VALUES(status),
            departmentId=VALUES(departmentId), departmentName=VALUES(departmentName), designationId=VALUES(designationId),
            designationTitle=VALUES(designationTitle), reportingManagerId=VALUES(reportingManagerId), reportingManagerName=VALUES(reportingManagerName),
            workLocationId=VALUES(workLocationId), workLocationName=VALUES(workLocationName), shift=VALUES(shift),
            emergencyContact=VALUES(emergencyContact), bankDetails=VALUES(bankDetails), taxInformation=VALUES(taxInformation),
            education=VALUES(education), previousExperience=VALUES(previousExperience), skills=VALUES(skills), salary=VALUES(salary),
            updatedAt=VALUES(updatedAt)`,
          [
            emp.id, emp.employeeCode, emp.firstName, emp.lastName, emp.email, emp.phone || '', emp.avatarUrl || '',
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

    // 7. Leave Requests
    if (data.leaveRequests && data.leaveRequests.length > 0) {
      for (const lr of data.leaveRequests) {
        await pool.query(
          `INSERT INTO leave_requests (id, employeeId, employeeName, employeeAvatar, departmentName, leaveType, startDate, endDate, daysCount, isHalfDay, reason, status, appliedDate, managerApproverId, managerApproverName, hrApprovedAt, managerApprovedAt, comments)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE status=VALUES(status), comments=VALUES(comments), hrApprovedAt=VALUES(hrApprovedAt), managerApprovedAt=VALUES(managerApprovedAt)`,
          [lr.id, lr.employeeId, lr.employeeName, lr.employeeAvatar || '', lr.departmentName || '', lr.leaveType, lr.startDate, lr.endDate, lr.daysCount, Boolean(lr.isHalfDay), lr.reason, lr.status, lr.appliedDate, lr.managerApproverId || null, lr.managerApproverName || null, lr.hrApprovedAt || null, lr.managerApprovedAt || null, lr.comments || ''],
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
