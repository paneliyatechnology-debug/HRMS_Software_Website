const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function standardizeAllIds() {
  console.log('=== Global Database User ID Standardization ===');
  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'hrms' });

  // 1. Load users
  const [dbUsers] = await conn.query('SELECT id, email, firstName, lastName, employeeId, role FROM users');
  console.log(`Loaded ${dbUsers.length} users from MySQL.`);

  const empToUserMap = new Map();
  for (const u of dbUsers) {
    if (u.employeeId) empToUserMap.set(u.employeeId, u.id);
    const ts = u.id.match(/\d+/);
    if (ts) {
      empToUserMap.set(`emp-${ts[0]}`, u.id);
    }
  }

  // Common known mappings
  empToUserMap.set('emp-1793192050133', 'user-1793190505324');
  empToUserMap.set('emp-1793192832564', 'user-1793192815053');
  empToUserMap.set('emp-test-company2-worker', 'user-test-company2-worker');
  empToUserMap.set('emp-2', 'user-test-company2-worker');
  empToUserMap.set('emp-1', 'user-admin-default');

  // Generic timestamp resolver
  function resolveUser(empId) {
    if (!empId || typeof empId !== 'string') return empId;
    if (empToUserMap.has(empId)) return empToUserMap.get(empId);
    if (empId.startsWith('emp-')) {
      const ts = empId.match(/\d+/);
      if (ts) return `user-${ts[0]}`;
    }
    return empId;
  }

  // 2. Standardize audit_logs in MySQL
  const [logs] = await conn.query('SELECT id, userId, recordId FROM audit_logs WHERE userId LIKE "emp-%" OR recordId LIKE "emp-%"');
  console.log(`Found ${logs.length} audit_logs with legacy IDs in MySQL.`);
  let updatedLogs = 0;
  for (const log of logs) {
    const newUserId = resolveUser(log.userId);
    const newRecordId = resolveUser(log.recordId);
    if (newUserId !== log.userId || newRecordId !== log.recordId) {
      await conn.query('UPDATE audit_logs SET userId = ?, recordId = ? WHERE id = ?', [newUserId, newRecordId, log.id]);
      updatedLogs++;
    }
  }
  console.log(`Updated ${updatedLogs} audit_logs in MySQL.`);

  // 3. Standardize users.reportingManagerId in MySQL
  const [managerUsers] = await conn.query('SELECT id, reportingManagerId FROM users WHERE reportingManagerId LIKE "emp-%"');
  for (const u of managerUsers) {
    const newMgrId = resolveUser(u.reportingManagerId);
    await conn.query('UPDATE users SET reportingManagerId = ? WHERE id = ?', [newMgrId, u.id]);
  }
  console.log(`Updated ${managerUsers.length} users with legacy reportingManagerId in MySQL.`);

  // 4. Standardize leave_balances in MySQL
  const [balances] = await conn.query('SELECT id, employeeId FROM leave_balances WHERE employeeId LIKE "emp-%"');
  for (const b of balances) {
    const newEmpId = resolveUser(b.employeeId);
    await conn.query('UPDATE leave_balances SET employeeId = ? WHERE id = ?', [newEmpId, b.id]);
  }
  console.log(`Updated ${balances.length} leave_balances in MySQL.`);

  // 5. Standardize resignations in MySQL
  const [resignations] = await conn.query('SELECT id, employeeId FROM resignations WHERE employeeId LIKE "emp-%"');
  for (const r of resignations) {
    const newEmpId = resolveUser(r.employeeId);
    await conn.query('UPDATE resignations SET employeeId = ? WHERE id = ?', [newEmpId, r.id]);
  }
  console.log(`Updated ${resignations.length} resignations in MySQL.`);

  await conn.end();

  // 6. Standardize data/database.json
  const jsonPath = path.resolve(process.cwd(), 'data', 'database.json');
  if (fs.existsSync(jsonPath)) {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    // Users
    if (Array.isArray(data.users)) {
      for (const u of data.users) {
        if (u.role === 'EMPLOYEE' || (u.employeeId && u.employeeId.startsWith('emp-'))) {
          u.employeeId = u.id;
        }
        if (u.reportingManagerId && u.reportingManagerId.startsWith('emp-')) {
          u.reportingManagerId = resolveUser(u.reportingManagerId);
        }
      }
    }

    // Employees
    if (Array.isArray(data.employees)) {
      for (const e of data.employees) {
        e.id = resolveUser(e.id);
        e.userId = e.id;
        if (e.reportingManagerId && e.reportingManagerId.startsWith('emp-')) {
          e.reportingManagerId = resolveUser(e.reportingManagerId);
        }
      }
    }

    // Leave Balances
    if (Array.isArray(data.leaveBalances)) {
      for (const lb of data.leaveBalances) {
        lb.employeeId = resolveUser(lb.employeeId);
        lb.userId = lb.employeeId;
        if (lb.id && lb.id.includes('emp-')) {
          lb.id = lb.id.replace('emp-', 'user-');
        }
      }
    }

    // Resignations
    if (Array.isArray(data.resignations)) {
      for (const r of data.resignations) {
        r.employeeId = resolveUser(r.employeeId);
        r.userId = r.employeeId;
      }
    }

    // Audit Logs
    if (Array.isArray(data.auditLogs)) {
      for (const log of data.auditLogs) {
        log.userId = resolveUser(log.userId);
        log.recordId = resolveUser(log.recordId);
      }
    }

    // Documents
    if (Array.isArray(data.documents)) {
      for (const d of data.documents) {
        d.employeeId = resolveUser(d.employeeId);
        d.userId = d.employeeId;
      }
    }

    // Assets
    if (Array.isArray(data.assets)) {
      for (const a of data.assets) {
        if (a.assignedToEmployeeId) {
          a.assignedToEmployeeId = resolveUser(a.assignedToEmployeeId);
          a.assignedToUserId = a.assignedToEmployeeId;
        }
      }
    }

    // Performance Reviews
    if (Array.isArray(data.performanceReviews)) {
      for (const pr of data.performanceReviews) {
        pr.employeeId = resolveUser(pr.employeeId);
        pr.userId = pr.employeeId;
        if (pr.managerId) {
          pr.managerId = resolveUser(pr.managerId);
        }
      }
    }

    // Employee Trainings
    if (Array.isArray(data.employeeTrainings)) {
      for (const et of data.employeeTrainings) {
        et.employeeId = resolveUser(et.employeeId);
        et.userId = et.employeeId;
      }
    }

    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
    console.log('Successfully standardized data/database.json!');
  }

  console.log('=== Standardization Finished ===');
}

standardizeAllIds().catch(console.error);

