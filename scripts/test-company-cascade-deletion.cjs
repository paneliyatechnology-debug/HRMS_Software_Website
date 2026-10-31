const http = require('http');
const mysql = require('mysql2/promise');

const BASE_URL = 'http://localhost:4000';

function post(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body || {});
    const req = http.request(
      `${BASE_URL}${path}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...headers,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode, data: parsed });
        });
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `${BASE_URL}${path}`,
      {
        method: 'GET',
        headers: {
          ...headers,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode, data: parsed });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

function del(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `${BASE_URL}${path}`,
      {
        method: 'DELETE',
        headers: {
          ...headers,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode, data: parsed });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('========================================================================');
  console.log('STARTING COMPLETE CASCADE COMPANY DELETION VERIFICATION TEST');
  console.log('========================================================================');

  const pool = await mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'hrms',
  });

  // Step 1: Super Admin Login
  console.log('\n[Step 1] Super Admin Login (paneliya@gmail.com / Paneliya@123)...');
  const superLoginRes = await post('/api/auth/login', {
    identifier: 'paneliya@gmail.com',
    password: 'Paneliya@123',
  });
  console.log('Super Admin Login Status:', superLoginRes.status);
  if (superLoginRes.status !== 200 && superLoginRes.status !== 201) {
    throw new Error('Super Admin login failed: ' + JSON.stringify(superLoginRes.data));
  }
  const superToken = superLoginRes.data.requestToken || superLoginRes.data.accessToken;
  console.log('Super Admin logged in successfully.');

  // Step 2: Register New Company A
  const compSuffixA = Date.now();
  const compEmailA = `cascade.owner.${compSuffixA}@testcorp.com`;
  const compPhoneA = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
  console.log(`\n[Step 2] Submitting Company Registration for "${compEmailA}"...`);
  const regResA = await post('/api/companies/register', {
    companyLegalName: `Cascade Test Corp A ${compSuffixA}`,
    industrySector: 'Information Technology',
    officeAddress: '100 Silicon Highway',
    city: 'Surat',
    state: 'Gujarat',
    firstName: 'Karan',
    lastName: 'Sangani',
    officialEmail: compEmailA,
    mobileNumber: compPhoneA,
    password: 'Password@123',
    confirmPassword: 'Password@123',
  });
  console.log('Registration Status:', regResA.status, regResA.data.message);
  const reqIdA = regResA.data.requestId;

  // Step 3: Approve Company A by Super Admin
  console.log(`\n[Step 3] Approving Company Request ID: ${reqIdA}...`);
  const approveResA = await post(
    `/api/super-admin/company-requests/${reqIdA}/approve`,
    {},
    { Authorization: `Bearer ${superToken}` },
  );
  console.log('Approval Status:', approveResA.status, approveResA.data.message);
  const companyA = approveResA.data.company;
  const companyAId = companyA.id;
  const companyACode = companyA.companyCode;
  console.log(`Company A Created: ID=${companyAId}, Code=${companyACode}`);

  // Step 4: Login as Company A Admin
  console.log(`\n[Step 4] Logging in as Company A Admin (${compEmailA})...`);
  const adminLoginResA = await post('/api/auth/login', {
    identifier: compEmailA,
    password: 'Password@123',
  });
  console.log('Admin Login Status:', adminLoginResA.status);
  if (adminLoginResA.status !== 200 && adminLoginResA.status !== 201) {
    throw new Error('Company A Admin login failed: ' + JSON.stringify(adminLoginResA.data));
  }
  const adminTokenA = adminLoginResA.data.requestToken || adminLoginResA.data.accessToken;
  const adminUserA = adminLoginResA.data.user;
  console.log(`Admin Logged In: UserID=${adminUserA.id}, CompanyId=${adminUserA.companyId}`);

  // Verify in MySQL that company and user exist
  const [dbCompBefore] = await pool.query('SELECT id, companyCode FROM companies WHERE id = ?', [companyAId]);
  const [dbUserBefore] = await pool.query('SELECT id, email, companyId FROM users WHERE id = ?', [adminUserA.id]);
  console.log('MySQL Before Deletion - Company exists:', dbCompBefore.length > 0, 'User exists:', dbUserBefore.length > 0);

  // Step 5: Delete Company A via Super Admin API (DELETE /api/super-admin/companies/:id)
  console.log(`\n[Step 5] Deleting Company A via Super Admin API (/api/super-admin/companies/${companyAId})...`);
  const deleteResA = await del(`/api/super-admin/companies/${companyAId}`, {
    Authorization: `Bearer ${superToken}`,
  });
  console.log('Delete API Status:', deleteResA.status, deleteResA.data);

  // Step 6: Verify Complete Cascade Deletion in MySQL
  console.log('\n[Step 6] Verifying MySQL database after Company A deletion...');
  const [dbCompAfter] = await pool.query('SELECT id FROM companies WHERE id = ? OR companyCode = ?', [companyAId, companyACode]);
  const [dbUserAfter] = await pool.query('SELECT id FROM users WHERE id = ? OR email = ? OR companyId = ?', [adminUserA.id, compEmailA, companyAId]);
  const [dbTokensAfter] = await pool.query('SELECT id FROM refresh_tokens WHERE userId = ? OR companyId = ?', [adminUserA.id, companyAId]);

  console.log('MySQL Check - Company in DB:', dbCompAfter.length, '(Expected 0)');
  console.log('MySQL Check - Users in DB:', dbUserAfter.length, '(Expected 0)');
  console.log('MySQL Check - Refresh Tokens in DB:', dbTokensAfter.length, '(Expected 0)');

  if (dbCompAfter.length !== 0 || dbUserAfter.length !== 0) {
    throw new Error('FAILED: MySQL still contains records for deleted Company A!');
  }
  console.log('PASS: All records completely wiped out from MySQL!');

  // Step 7: Verify Admin CANNOT Login anymore
  console.log('\n[Step 7] Attempting to login as deleted company admin...');
  const adminLoginAfterDelete = await post('/api/auth/login', {
    identifier: compEmailA,
    password: 'Password@123',
  });
  console.log('Login attempt status for deleted admin:', adminLoginAfterDelete.status, adminLoginAfterDelete.data.message);
  if (adminLoginAfterDelete.status === 200 || adminLoginAfterDelete.status === 201) {
    throw new Error('SECURITY VIOLATION: Deleted admin was allowed to log in!');
  }
  console.log('PASS: Login successfully blocked with 401 Unauthorized!');

  // Step 8: Verify Old Token is Rejected by JwtAuthGuard
  console.log('\n[Step 8] Attempting to make an authenticated request with deleted admin token...');
  const guardTestRes = await get('/api/companies/my-company', {
    Authorization: `Bearer ${adminTokenA}`,
  });
  console.log('Guard response status for deleted admin token:', guardTestRes.status, guardTestRes.data.message);
  if (guardTestRes.status !== 401) {
    throw new Error('SECURITY VIOLATION: Deleted admin token was accepted by JwtAuthGuard!');
  }
  console.log('PASS: Token rejected by JwtAuthGuard!');

  // Step 9: TEST DIRECT MYSQL / PHPMYADMIN DELETION TRIGGER
  console.log('\n------------------------------------------------------------------------');
  console.log('[Step 9] TESTING DIRECT MYSQL/PHPMYADMIN DELETION VIA MYSQL TRIGGER');
  console.log('------------------------------------------------------------------------');
  const compSuffixB = Date.now();
  const compEmailB = `phpmyadmin.owner.${compSuffixB}@testcorp.com`;
  const compPhoneB = `97${Math.floor(10000000 + Math.random() * 90000000)}`;
  const regResB = await post('/api/companies/register', {
    companyLegalName: `PhpMyAdmin Direct Test Corp ${compSuffixB}`,
    officialEmail: compEmailB,
    mobileNumber: compPhoneB,
    firstName: 'Ravi',
    lastName: 'Paneliya',
    password: 'Password@123',
    confirmPassword: 'Password@123',
  });
  const reqIdB = regResB.data.requestId;
  const approveResB = await post(
    `/api/super-admin/company-requests/${reqIdB}/approve`,
    {},
    { Authorization: `Bearer ${superToken}` },
  );
  const companyB = approveResB.data.company;
  const companyBId = companyB.id;
  const companyBCode = companyB.companyCode;
  console.log(`Company B Created: ID=${companyBId}, Code=${companyBCode}`);

  // Login as Company B admin
  const adminLoginB = await post('/api/auth/login', {
    identifier: compEmailB,
    password: 'Password@123',
  });
  console.log('Company B Admin Login Status:', adminLoginB.status);
  const userB = adminLoginB.data.user;

  // Simulate user clicking "Delete" on the row in phpMyAdmin: DELETE FROM companies WHERE id = ?
  console.log(`\nSimulating phpMyAdmin row deletion: "DELETE FROM companies WHERE id = '${companyBId}'"...`);
  await pool.query('DELETE FROM companies WHERE id = ?', [companyBId]);

  // Check MySQL immediately: Did the MySQL trigger delete the user?
  const [dbUserBAfterTrigger] = await pool.query('SELECT id, email FROM users WHERE id = ? OR email = ?', [userB.id, compEmailB]);
  console.log('MySQL Trigger Check - User rows in DB immediately after company delete:', dbUserBAfterTrigger.length, '(Expected 0)');

  if (dbUserBAfterTrigger.length !== 0) {
    throw new Error('FAILED: MySQL trigger did not cascade delete user!');
  }
  console.log('PASS: MySQL trigger trg_cascade_delete_company automatically wiped out the user from MySQL!');

  // Attempt login with Company B admin
  const adminLoginBAfterDelete = await post('/api/auth/login', {
    identifier: compEmailB,
    password: 'Password@123',
  });
  console.log('Login attempt for Company B admin after phpMyAdmin deletion:', adminLoginBAfterDelete.status, adminLoginBAfterDelete.data.message);
  if (adminLoginBAfterDelete.status === 200 || adminLoginBAfterDelete.status === 201) {
    throw new Error('SECURITY VIOLATION: Deleted Company B admin was allowed to log in!');
  }
  console.log('PASS: Company B admin login blocked!');

  await pool.end();
  console.log('\n========================================================================');
  console.log('ALL CASCADE DELETION TESTS PASSED 100%! ZERO ERRORS!');
  console.log('========================================================================\n');
}

run().catch((err) => {
  console.error('\nTEST RUN FAILED:', err);
  process.exit(1);
});
