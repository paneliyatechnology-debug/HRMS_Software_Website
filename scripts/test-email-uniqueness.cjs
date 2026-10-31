const http = require('http');
const mysql = require('mysql2/promise');

const BASE_URL = 'http://localhost:4000/api';

function request(path, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const url = new URL(cleanPath, BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`);
    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    };

    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function getErrorMessage(body) {
  if (!body) return '';
  if (typeof body.message === 'string') return body.message;
  if (body.error && typeof body.error.message === 'string') return body.error.message;
  return typeof body === 'string' ? body : JSON.stringify(body);
}

async function loginSuperAdmin() {
  const res = await request('/auth/login', { method: 'POST' }, {
    identifier: 'superadmin@paneliya.com',
    password: 'Password123!',
  });
  const token = res.body.accessToken || res.body.token;
  if ((res.status !== 200 && res.status !== 201) || !token) {
    throw new Error(`Failed to login as superadmin: ${JSON.stringify(res.body)}`);
  }
  return token;
}

async function run() {
  console.log('================================================================');
  console.log('   GLOBAL EMAIL UNIQUENESS ACROSS ALL ROLES - VERIFICATION SUITE');
  console.log('================================================================');

  const token = await loginSuperAdmin();
  console.log('✓ Super Admin authenticated.');

  const authHeaders = { Authorization: `Bearer ${token}` };
  let passed = 0;
  let failed = 0;
  const createdUserIds = [];

  const runId = Date.now();
  const EXPECTED_CONFLICT_MSG = 'This email address is already registered. Please use another email.';

  const emailSA = `test-sa-${runId}@paneliya.com`;
  const emailAdmin = `test-admin-${runId}@paneliya.com`;
  const emailCross = `test-cross-${runId}@paneliya.com`;
  const emailCase = `test-case-${runId}@paneliya.com`;
  const emailConcurrent = `test-concurrent-${runId}@paneliya.com`;

  // -------------------------------------------------------------
  // Test 1: Same email for SUPER_ADMIN and ADMIN
  // -------------------------------------------------------------
  console.log('\n[Test 1] Same email for SUPER_ADMIN and ADMIN');
  const saRes = await request('/super-admin/users', { method: 'POST', headers: authHeaders }, {
    email: emailSA,
    password: 'Password123!',
    firstName: 'Super',
    lastName: 'AdminTest',
    role: 'SUPER_ADMIN',
  });
  console.log('1a. Create SUPER_ADMIN status:', saRes.status);
  if (saRes.body?.user?.id) createdUserIds.push(saRes.body.user.id);

  const adminConflictRes = await request('/super-admin/users', { method: 'POST', headers: authHeaders }, {
    email: emailSA,
    password: 'Password123!',
    firstName: 'Admin',
    lastName: 'Duplicate',
    role: 'ADMIN',
    companyId: 'cmp-1',
  });
  const msg1 = getErrorMessage(adminConflictRes.body);
  console.log('1b. Create ADMIN with same email status:', adminConflictRes.status, 'Message:', msg1);

  if (saRes.status === 201 && adminConflictRes.status === 409 && msg1 === EXPECTED_CONFLICT_MSG) {
    console.log('✓ PASS: Rejected duplicate email between SUPER_ADMIN and ADMIN with HTTP 409 Conflict.');
    passed++;
  } else {
    console.error('✗ FAIL: Expected 409 Conflict with exact message.');
    failed++;
  }

  // -------------------------------------------------------------
  // Test 2: Same email for ADMIN and EMPLOYEE
  // -------------------------------------------------------------
  console.log('\n[Test 2] Same email for ADMIN and EMPLOYEE');
  const adminRes = await request('/super-admin/users', { method: 'POST', headers: authHeaders }, {
    email: emailAdmin,
    password: 'Password123!',
    firstName: 'Company',
    lastName: 'AdminTest',
    role: 'ADMIN',
    companyId: 'cmp-1',
  });
  console.log('2a. Create ADMIN status:', adminRes.status);
  if (adminRes.body?.user?.id) createdUserIds.push(adminRes.body.user.id);

  const empConflictRes = await request('/employees', { method: 'POST', headers: authHeaders }, {
    email: emailAdmin,
    password: 'Password123!',
    firstName: 'Employee',
    lastName: 'Duplicate',
    role: 'EMPLOYEE',
    companyId: 'cmp-1',
  });
  const msg2 = getErrorMessage(empConflictRes.body);
  console.log('2b. Create EMPLOYEE with same email status:', empConflictRes.status, 'Message:', msg2);

  if (adminRes.status === 201 && empConflictRes.status === 409 && msg2 === EXPECTED_CONFLICT_MSG) {
    console.log('✓ PASS: Rejected duplicate email between ADMIN and EMPLOYEE with HTTP 409 Conflict.');
    passed++;
  } else {
    console.error('✗ FAIL: Expected 409 Conflict with exact message.');
    failed++;
  }

  // -------------------------------------------------------------
  // Test 3: Same email across two different companies
  // -------------------------------------------------------------
  console.log('\n[Test 3] Same email across two different companies');
  const empCmp1Res = await request('/employees', { method: 'POST', headers: authHeaders }, {
    email: emailCross,
    password: 'Password123!',
    firstName: 'Emp1',
    lastName: 'Cmp1',
    role: 'EMPLOYEE',
    companyId: 'cmp-1',
  });
  console.log('3a. Create employee in Company 1 (Paneliya Technologies) status:', empCmp1Res.status);
  if (empCmp1Res.body?.userId) createdUserIds.push(empCmp1Res.body.userId);
  else if (empCmp1Res.body?.id) createdUserIds.push(empCmp1Res.body.id);

  const empCmp2Res = await request('/employees', { method: 'POST', headers: authHeaders }, {
    email: emailCross,
    password: 'Password123!',
    firstName: 'Emp2',
    lastName: 'Cmp2',
    role: 'EMPLOYEE',
    companyId: 'cmp-1793180626095',
  });
  const msg3 = getErrorMessage(empCmp2Res.body);
  console.log('3b. Create employee in Company 2 with same email status:', empCmp2Res.status, 'Message:', msg3);

  if (empCmp1Res.status === 201 && empCmp2Res.status === 409 && msg3 === EXPECTED_CONFLICT_MSG) {
    console.log('✓ PASS: Rejected duplicate email across two different companies with HTTP 409 Conflict.');
    passed++;
  } else {
    console.error('✗ FAIL: Expected 409 Conflict with exact message.');
    failed++;
  }

  // -------------------------------------------------------------
  // Test 4: Same email with uppercase/lowercase and whitespace variations
  // -------------------------------------------------------------
  console.log('\n[Test 4] Same email with case and whitespace variations');
  const userCaseRes = await request('/auth/register', { method: 'POST' }, {
    email: emailCase,
    password: 'Password123!',
    firstName: 'Case',
    lastName: 'Lower',
  });
  console.log('4a. Register with lowercase email status:', userCaseRes.status);
  if (userCaseRes.body?.user?.id) createdUserIds.push(userCaseRes.body.user.id);

  const mixedCaseEmail = `  ${emailCase.toUpperCase()}  `;
  const userUpperRes = await request('/auth/register', { method: 'POST' }, {
    email: mixedCaseEmail,
    password: 'Password123!',
    firstName: 'Case',
    lastName: 'Upper',
  });
  const msg4 = getErrorMessage(userUpperRes.body);
  console.log(`4b. Register with mixed-case "${mixedCaseEmail}" status:`, userUpperRes.status, 'Message:', msg4);

  if (userCaseRes.status === 201 && userUpperRes.status === 409 && msg4 === EXPECTED_CONFLICT_MSG) {
    console.log('✓ PASS: Normalized and rejected mixed-case duplicate email with HTTP 409 Conflict.');
    passed++;
  } else {
    console.error('✗ FAIL: Expected 409 Conflict with exact message.');
    failed++;
  }

  // -------------------------------------------------------------
  // Test 5: Two simultaneous/concurrent registration requests using the same email
  // -------------------------------------------------------------
  console.log('\n[Test 5] Simultaneous/concurrent registration requests (Race Condition Defense)');
  const [resA, resB] = await Promise.all([
    request('/auth/register', { method: 'POST' }, {
      email: emailConcurrent,
      password: 'Password123!',
      firstName: 'Concurrent',
      lastName: 'UserA',
    }),
    request('/auth/register', { method: 'POST' }, {
      email: emailConcurrent,
      password: 'Password123!',
      firstName: 'Concurrent',
      lastName: 'UserB',
    }),
  ]);
  const msgA = getErrorMessage(resA.body);
  const msgB = getErrorMessage(resB.body);
  console.log('5a. Request A status:', resA.status, resA.status === 201 ? 'Created' : msgA);
  console.log('5b. Request B status:', resB.status, resB.status === 201 ? 'Created' : msgB);
  if (resA.body?.user?.id) createdUserIds.push(resA.body.user.id);
  if (resB.body?.user?.id) createdUserIds.push(resB.body.user.id);

  const oneCreated = (resA.status === 201 && resB.status === 409) || (resB.status === 201 && resA.status === 409);
  const conflictMessageCorrect =
    (resA.status === 409 && msgA === EXPECTED_CONFLICT_MSG) ||
    (resB.status === 409 && msgB === EXPECTED_CONFLICT_MSG);

  // Allow brief window for async persistence and MySQL synchronization to flush
  await new Promise((r) => setTimeout(r, 500));

  const db = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'hrms',
  });

  const [dbRows] = await db.query('SELECT id, email, role FROM users WHERE LOWER(TRIM(email)) = ?', [emailConcurrent.toLowerCase()]);
  console.log('5c. MySQL records found for', emailConcurrent, ':', dbRows.length);
  await db.end();

  if (oneCreated && conflictMessageCorrect && dbRows.length === 1) {
    console.log('✓ PASS: Exactly one concurrent request succeeded and the other was rejected with HTTP 409 Conflict. Exactly 1 record saved in MySQL.');
    passed++;
  } else {
    console.error('✗ FAIL: Concurrent email registration test failed.');
    failed++;
  }

  // -------------------------------------------------------------
  // Cleanup test records
  // -------------------------------------------------------------
  console.log('\n--- Cleaning up test records via Super Admin API ---');
  for (const uid of createdUserIds) {
    try {
      const delRes = await request(`/super-admin/users/${uid}`, { method: 'DELETE', headers: authHeaders });
      console.log(`- Cleaned test user ${uid} (Status: ${delRes.status})`);
    } catch (e) {
      console.warn(`- Failed to clean user ${uid}:`, e.message);
    }
  }

  console.log(`\n================================================================`);
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: 5)`);
  console.log(`================================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Error during test execution:', err);
  process.exit(1);
});
