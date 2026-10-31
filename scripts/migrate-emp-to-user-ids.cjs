const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function migrateEmpToUserIds() {
  console.log('=== Starting EMP to USER ID Migration ===');

  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'hrms' });

  // 1. Build mapping table from MySQL users
  const [dbUsers] = await conn.query('SELECT id, email, role, firstName, lastName, employeeId FROM users');
  console.log(`Found ${dbUsers.length} users in MySQL.`);

  const empToUserMap = new Map();
  const nameToUserMap = new Map();

  for (const u of dbUsers) {
    if (u.employeeId) {
      empToUserMap.set(u.employeeId, u.id);
    }
    // Also map timestamp match if emp-123456 -> user-123456
    const ts = u.id.match(/\d+/);
    if (ts) {
      empToUserMap.set(`emp-${ts[0]}`, u.id);
    }
    const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim().toLowerCase();
    if (fullName) {
      nameToUserMap.set(fullName, u.id);
    }
  }

  // 2. Update leave_requests in MySQL
  const [leaves] = await conn.query('SELECT id, employeeId, employeeName FROM leave_requests');
  let updatedLeaves = 0;
  for (const l of leaves) {
    let targetUserId = empToUserMap.get(l.employeeId) || nameToUserMap.get((l.employeeName || '').toLowerCase().trim());
    if (targetUserId && targetUserId !== l.employeeId) {
      await conn.query('UPDATE leave_requests SET employeeId = ? WHERE id = ?', [targetUserId, l.id]);
      updatedLeaves++;
    }
  }
  console.log(`Updated ${updatedLeaves} leave_requests in MySQL.`);

  // 3. Update attendance_records in MySQL
  const [attRecords] = await conn.query('SELECT id, employeeId, employeeName FROM attendance_records');
  let updatedAtt = 0;
  for (const a of attRecords) {
    let targetUserId = empToUserMap.get(a.employeeId) || nameToUserMap.get((a.employeeName || '').toLowerCase().trim());
    if (targetUserId && targetUserId !== a.employeeId) {
      await conn.query('UPDATE attendance_records SET employeeId = ? WHERE id = ?', [targetUserId, a.id]);
      updatedAtt++;
    }
  }
  console.log(`Updated ${updatedAtt} attendance_records in MySQL.`);

  // 4. Update payroll_records in MySQL
  const [payRecords] = await conn.query('SELECT id, employeeId, employeeName FROM payroll_records');
  let updatedPay = 0;
  for (const p of payRecords) {
    let targetUserId = empToUserMap.get(p.employeeId) || nameToUserMap.get((p.employeeName || '').toLowerCase().trim());
    if (targetUserId && targetUserId !== p.employeeId) {
      await conn.query('UPDATE payroll_records SET employeeId = ? WHERE id = ?', [targetUserId, p.id]);
      updatedPay++;
    }
  }
  console.log(`Updated ${updatedPay} payroll_records in MySQL.`);

  // 5. Update work_sessions in MySQL
  const [sessions] = await conn.query('SELECT id, employeeId, employeeName FROM work_sessions');
  let updatedWs = 0;
  for (const s of sessions) {
    let targetUserId = empToUserMap.get(s.employeeId) || nameToUserMap.get((s.employeeName || '').toLowerCase().trim());
    if (targetUserId && targetUserId !== s.employeeId) {
      await conn.query('UPDATE work_sessions SET employeeId = ? WHERE id = ?', [targetUserId, s.id]);
      updatedWs++;
    }
  }
  console.log(`Updated ${updatedWs} work_sessions in MySQL.`);

  // 6. Update leave_balances in MySQL
  const [balances] = await conn.query('SELECT id, employeeId FROM leave_balances');
  let updatedBalances = 0;
  for (const b of balances) {
    let targetUserId = empToUserMap.get(b.employeeId);
    if (targetUserId && targetUserId !== b.employeeId) {
      await conn.query('UPDATE leave_balances SET employeeId = ? WHERE id = ?', [targetUserId, b.id]);
      updatedBalances++;
    }
  }
  console.log(`Updated ${updatedBalances} leave_balances in MySQL.`);

  // 7. Update users table employeeId = id for all users
  const [userUpdateRes] = await conn.query('UPDATE users SET employeeId = id WHERE role = "EMPLOYEE" OR employeeId LIKE "emp-%"');
  console.log(`Updated users.employeeId in MySQL: affected rows = ${userUpdateRes.affectedRows}`);

  await conn.end();

  // 8. Update data/database.json
  const jsonPath = path.resolve(process.cwd(), 'data', 'database.json');
  if (fs.existsSync(jsonPath)) {
    const raw = fs.readFileSync(jsonPath, 'utf8');
    const data = JSON.parse(raw);

    // Update users
    if (Array.isArray(data.users)) {
      for (const u of data.users) {
        if (u.role === 'EMPLOYEE' || (u.employeeId && u.employeeId.startsWith('emp-'))) {
          u.employeeId = u.id;
        }
      }
    }

    // Update employees
    if (Array.isArray(data.employees)) {
      for (const e of data.employees) {
        const mappedId = empToUserMap.get(e.id) || (e.email ? dbUsers.find(u => u.email.toLowerCase() === e.email.toLowerCase())?.id : null);
        if (mappedId) {
          e.id = mappedId;
          e.userId = mappedId;
        }
      }
    }

    // Update leaveRequests
    if (Array.isArray(data.leaveRequests)) {
      for (const lr of data.leaveRequests) {
        const mapped = empToUserMap.get(lr.employeeId) || nameToUserMap.get((lr.employeeName || '').toLowerCase().trim());
        if (mapped) {
          lr.employeeId = mapped;
          lr.userId = mapped;
        }
      }
    }

    // Update attendanceRecords
    if (Array.isArray(data.attendanceRecords)) {
      for (const ar of data.attendanceRecords) {
        const mapped = empToUserMap.get(ar.employeeId) || nameToUserMap.get((ar.employeeName || '').toLowerCase().trim());
        if (mapped) {
          ar.employeeId = mapped;
          ar.userId = mapped;
        }
      }
    }

    // Update payrollRecords
    if (Array.isArray(data.payrollRecords)) {
      for (const pr of data.payrollRecords) {
        const mapped = empToUserMap.get(pr.employeeId) || nameToUserMap.get((pr.employeeName || '').toLowerCase().trim());
        if (mapped) {
          pr.employeeId = mapped;
          pr.userId = mapped;
        }
      }
    }

    // Update workSessions
    if (Array.isArray(data.workSessions)) {
      for (const ws of data.workSessions) {
        const mapped = empToUserMap.get(ws.employeeId) || nameToUserMap.get((ws.employeeName || '').toLowerCase().trim());
        if (mapped) {
          ws.employeeId = mapped;
          ws.userId = mapped;
        }
      }
    }

    // Update leaveBalances
    if (Array.isArray(data.leaveBalances)) {
      for (const lb of data.leaveBalances) {
        const mapped = empToUserMap.get(lb.employeeId);
        if (mapped) {
          lb.employeeId = mapped;
          lb.userId = mapped;
        }
      }
    }

    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
    console.log('Successfully updated data/database.json with unified user IDs!');
  }

  console.log('=== Migration Complete ===');
}

migrateEmpToUserIds().catch(console.error);

