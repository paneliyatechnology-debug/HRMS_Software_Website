const http = require('http');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'HRMS_Software_Website/.env' });

function request(path, method, body, token) {
  return new Promise((resolve, reject) => {
    const req = http.request('http://localhost:4000/api' + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('=== TEST: PHPMYADMIN / XAMPP DIRECT DELETION SYNCHRONIZATION ===\n');

  const pool = mysql.createPool({
    host: process.env.DATABASE_HOST || 'localhost',
    port: Number(process.env.DATABASE_PORT) || 3306,
    user: process.env.DATABASE_USER || 'root',
    password: process.env.DATABASE_PASSWORD || '',
    database: process.env.DATABASE_NAME || 'hrms',
  });

  // 1. Authenticate as Admin
  console.log('Step 1: Authenticating as Admin admin@paneliya.com...');
  const login = await request('/auth/login', 'POST', {
    email: 'admin@paneliya.com',
    password: 'Admin@123',
  });
  const token = login.body.accessToken;
  if (!token) {
    console.error('Login failed:', login.body);
    process.exit(1);
  }
  console.log('Admin authenticated successfully.');

  const testEmail = `test.phpmyadmin.sync.${Date.now()}@gmail.com`;

  // 2. Create an employee via POST /api/admin/employees
  console.log(`\nStep 2: Creating employee with email "${testEmail}" via API...`);
  const createRes = await request('/admin/employees', 'POST', {
    firstName: 'Demo',
    lastName: 'SyncTest',
    email: testEmail,
    phone: `+91 97${String(Date.now()).slice(-8)}`,
  }, token);
  console.log('Create Status:', createRes.status);
  console.log('Employee ID:', createRes.body.employee?.id);

  // Verify it exists in MySQL
  const [rowsBefore] = await pool.query('SELECT id, email FROM users WHERE email = ?', [testEmail]);
  console.log('Verified in MySQL users table:', rowsBefore.length > 0 ? 'YES' : 'NO');

  // 3. Trying to create again gives 409 Conflict
  console.log('\nStep 3: Trying to create again with duplicate email while it exists in MySQL...');
  const dupBeforeRes = await request('/admin/employees', 'POST', {
    firstName: 'Demo',
    lastName: 'SyncTest',
    email: testEmail,
  }, token);
  console.log('Duplicate Status (Expected 409):', dupBeforeRes.status);
  console.log('Duplicate Message:', dupBeforeRes.body.message);

  // 4. SIMULATE USER DELETING DIRECTLY IN PHPMYADMIN / XAMPP
  console.log(`\nStep 4: Simulating user deleting row directly in XAMPP phpMyAdmin (DELETE FROM users WHERE email = ?)...`);
  await pool.query('DELETE FROM users WHERE email = ?', [testEmail]);
  await pool.query('DELETE FROM employee_invitations WHERE email = ?', [testEmail]);
  const [rowsAfterDelete] = await pool.query('SELECT id, email FROM users WHERE email = ?', [testEmail]);
  console.log('MySQL users table after phpMyAdmin deletion count:', rowsAfterDelete.length);

  // 5. User tries to create employee with same email again
  console.log('\nStep 5: User tries to register/create employee with same email again after phpMyAdmin deletion...');
  const createAfterDeleteRes = await request('/admin/employees', 'POST', {
    firstName: 'Demo',
    lastName: 'SyncTestReborn',
    email: testEmail,
  }, token);
  console.log('Create After Delete Status:', createAfterDeleteRes.status);
  console.log('Create After Delete Response:', JSON.stringify(createAfterDeleteRes.body, null, 2));

  // 6. Verification
  console.log('\n=== RESULTS ===');
  if (createAfterDeleteRes.status === 201) {
    console.log('[SUCCESS] PASSED! When deleted in XAMPP phpMyAdmin, backend no longer says "already registered". Registration succeeds with 201!');
  } else {
    console.error('[FAILURE] Backend still rejected with status:', createAfterDeleteRes.status);
  }

  // Cleanup
  await pool.query('DELETE FROM users WHERE email = ?', [testEmail]);
  await pool.query('DELETE FROM employee_invitations WHERE email = ?', [testEmail]);
  await pool.end();
}

run().catch(console.error);

