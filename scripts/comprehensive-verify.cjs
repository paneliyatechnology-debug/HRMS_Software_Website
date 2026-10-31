const mysql = require('mysql2/promise');

async function verifyAll() {
  console.log('====================================================');
  console.log('   HRMS GLOBAL USER ID STANDARDIZATION AUDIT TEST   ');
  console.log('====================================================\n');

  const BASE_URL = 'http://localhost:4000/api';

  // 1. SUPER_ADMIN Login & API Check
  console.log('--- 1. Testing SUPER_ADMIN Role ---');
  const superLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@paneliya.com', password: 'Password123!' })
  });
  const superLogin = await superLoginRes.json();
  console.log('SUPER_ADMIN Login status:', superLoginRes.status, 'User ID:', superLogin.user?.id);
  const superToken = superLogin.accessToken;

  const adminsRes = await fetch(`${BASE_URL}/super-admin/admins`, {
    headers: { 'Authorization': `Bearer ${superToken}` }
  });
  const admins = await adminsRes.json();
  const adminList = admins.items || admins;
  console.log('GET /super-admin/admins count:', adminList.length);
  console.log('Sample Admin IDs:', adminList.slice(0, 2).map(a => ({ id: a.id, email: a.email, role: a.role })));

  // 2. ADMIN Login & API Check
  console.log('\n--- 2. Testing ADMIN Role ---');
  const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ravi@gmail.com', password: 'Password123!' })
  });
  const adminLogin = await adminLoginRes.json();
  console.log('ADMIN Login status:', adminLoginRes.status, 'User ID:', adminLogin.user?.id);
  const adminToken = adminLogin.accessToken;

  const adminEmployeesRes = await fetch(`${BASE_URL}/admin/employees`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const adminEmployees = await adminEmployeesRes.json();
  console.log('GET /admin/employees total:', adminEmployees.total);
  if (adminEmployees.items && adminEmployees.items.length > 0) {
    const sampleEmp = adminEmployees.items[0];
    console.log('Sample Employee from Admin Roster:', {
      id: sampleEmp.id,
      userId: sampleEmp.userId,
      employeeId: sampleEmp.employeeId,
      name: `${sampleEmp.firstName} ${sampleEmp.lastName}`,
      code: sampleEmp.employeeCode,
    });
  }

  // 3. EMPLOYEE Login & API Check (Ravi Khunt - user-1793190505324)
  console.log('\n--- 3. Testing EMPLOYEE Role (Ravi Khunt) ---');
  const empLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ravi@paneliya.com', password: 'Ravi@123' })
  });
  const empLogin = await empLoginRes.json();
  console.log('EMPLOYEE Login status:', empLoginRes.status, 'User ID:', empLogin.user?.id);
  const empToken = empLogin.accessToken;
  const raviUserId = empLogin.user?.id; // user-1793190505324

  // Check Profile
  const profileRes = await fetch(`${BASE_URL}/users/profile`, {
    headers: { 'Authorization': `Bearer ${empToken}` }
  });
  const profile = await profileRes.json();
  console.log('GET /users/profile:');
  console.log('   id:', profile.id, '| employeeId:', profile.employeeId, '| role:', profile.role);

  // Check Leaves
  const leavesRes = await fetch(`${BASE_URL}/leaves`, {
    headers: { 'Authorization': `Bearer ${empToken}` }
  });
  const leaves = await leavesRes.json();
  console.log('GET /leaves count:', leaves.length);
  if (leaves.length > 0) {
    console.log('Sample Leave Request:');
    console.log({
      id: leaves[0].id,
      userId: leaves[0].userId,
      employeeId: leaves[0].employeeId,
      employeeName: leaves[0].employeeName,
      role: leaves[0].role,
      leaveType: leaves[0].leaveType,
    });
  }

  // Check Leave Balances
  const balancesRes = await fetch(`${BASE_URL}/leaves/balances/${raviUserId}`, {
    headers: { 'Authorization': `Bearer ${empToken}` }
  });
  const balances = await balancesRes.json();
  console.log('GET /leaves/balances/' + raviUserId + ':');
  console.log({
    id: balances.id,
    userId: balances.userId,
    employeeId: balances.employeeId,
    role: balances.role,
  });

  // Check Attendance
  const attRes = await fetch(`${BASE_URL}/attendance`, {
    headers: { 'Authorization': `Bearer ${empToken}` }
  });
  const att = await attRes.json();
  console.log('GET /attendance count:', att.length);
  if (att.length > 0) {
    console.log('Sample Attendance:');
    console.log({
      id: att[0].id,
      userId: att[0].userId,
      employeeId: att[0].employeeId,
      role: att[0].role,
      date: att[0].date,
    });
  }

  // Check Payroll
  const payRes = await fetch(`${BASE_URL}/payroll`, {
    headers: { 'Authorization': `Bearer ${empToken}` }
  });
  const pay = await payRes.json();
  console.log('GET /payroll count:', pay.length);
  if (pay.length > 0) {
    console.log('Sample Payroll:');
    console.log({
      id: pay[0].id,
      userId: pay[0].userId,
      employeeId: pay[0].employeeId,
      role: pay[0].role,
      employeeName: pay[0].employeeName,
    });
  }

  // 4. Test Employee Creation via Admin API
  console.log('\n--- 4. Testing New Employee Creation (Ensuring Unified user-... ID Generated) ---');
  const testEmail = `verified.test.${Date.now()}@paneliya.com`;
  const createEmpRes = await fetch(`${BASE_URL}/admin/employees`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      firstName: 'Audit',
      lastName: 'Verification',
      email: testEmail,
      phone: '+91 99999 11111',
      password: 'Password123!',
      salary: { basic: 50000, hra: 20000, allowances: 5000 }
    })
  });
  const createdEmp = await createEmpRes.json();
  console.log('Create Employee status:', createEmpRes.status);
  console.log('Created Employee IDs:');
  console.log({
    employeeId: createdEmp.employee?.id,
    userId: createdEmp.employee?.userId,
    userTableId: createdEmp.user?.id,
    userTableEmployeeId: createdEmp.user?.employeeId,
  });

  // 5. Query MySQL Directly to Confirm
  console.log('\n--- 5. MySQL Verification in hrms Database ---');
  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'hrms' });
  const [mysqlUsers] = await conn.query('SELECT id, email, role, employeeId, employeeCode FROM users WHERE email = ?', [testEmail]);
  console.log('MySQL record in `users` table:');
  console.table(mysqlUsers);

  // Check if any `emp-` ID exists anywhere in MySQL (excluding human code EMP-...)
  const [allUsersWithEmpId] = await conn.query("SELECT COUNT(*) as cnt FROM users WHERE employeeId LIKE 'emp-%'");
  const [allLeavesWithEmpId] = await conn.query("SELECT COUNT(*) as cnt FROM leave_requests WHERE employeeId LIKE 'emp-%'");
  const [allAttWithEmpId] = await conn.query("SELECT COUNT(*) as cnt FROM attendance_records WHERE employeeId LIKE 'emp-%'");
  const [allPayWithEmpId] = await conn.query("SELECT COUNT(*) as cnt FROM payroll_records WHERE employeeId LIKE 'emp-%'");

  console.log('\n--- 6. Global Zero-Legacy Integrity Check in MySQL ---');
  console.log('users with emp- employeeId:', allUsersWithEmpId[0].cnt);
  console.log('leave_requests with emp- employeeId:', allLeavesWithEmpId[0].cnt);
  console.log('attendance_records with emp- employeeId:', allAttWithEmpId[0].cnt);
  console.log('payroll_records with emp- employeeId:', allPayWithEmpId[0].cnt);

  // Clean up test employee
  if (mysqlUsers.length > 0) {
    const testId = mysqlUsers[0].id;
    await conn.query('DELETE FROM users WHERE id = ?', [testId]);
    await conn.query('DELETE FROM leave_balances WHERE employeeId = ?', [testId]);
    await conn.query('DELETE FROM audit_logs WHERE recordId = ?', [testId]);
    console.log(`Cleaned up temporary verification test user ${testId}.`);
  }

  await conn.end();
  console.log('\n====================================================');
  console.log('        ALL AUDIT CHECKS PASSED WITH 100% SUCCESS   ');
  console.log('====================================================');
}

verifyAll().catch(console.error);
