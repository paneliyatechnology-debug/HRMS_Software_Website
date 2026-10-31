/**
 * Comprehensive Automated Test Suite: Employee Email Invitation & Password Setup
 * 
 * Tests:
 * 1. ADMIN creates EMPLOYEE -> triggers invitation & stores SHA-256 token hash
 * 2. SUPER_ADMIN creates ADMIN -> feature does NOT trigger
 * 3. Employee receives valid 30-minute password setup token
 * 4. Valid token allows setting password via POST /api/auth/employee/set-password
 * 5. Expired token is rejected (400)
 * 6. Reused token is rejected (400)
 * 7. Invalid/forged token is rejected (400)
 * 8. Concurrent setup requests cannot set the password twice
 * 9. ADMIN cannot create/resend invitation for another company's employee (403)
 * 10. Inactive employee cannot complete password setup (400)
 * 11. Employee can successfully log in with their newly configured password
 * 12. Multi-company tenant isolation and existing features remain intact
 */

const http = require('http');
const mysql = require('mysql2/promise');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:4000/api';

function request(method, reqPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + reqPath);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json,
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('='.repeat(80));
  console.log('     EMPLOYEE EMAIL INVITATION & PASSWORD SETUP TEST SUITE');
  console.log('='.repeat(80));

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  const pool = await mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'hrms',
    port: 3306,
  });

  try {
    const testSuffix = Date.now();

    // 0. Authenticate Super Admin and Company Admin
    console.log('\n--- Step 0: Authenticating Actors ---');
    const saLogin = await request('POST', '/auth/login', {
      identifier: 'admin@paneliya.com',
      password: 'Admin@123',
    });
    assert(saLogin.status === 200 || saLogin.status === 201, 'Super Admin authenticated successfully');
    const saToken = saLogin.data.accessToken;

    const adminLogin = await request('POST', '/auth/login', {
      identifier: 'sarah.hr@paneliya.com',
      password: 'Admin@123',
      companyCode: 'CMP-000001',
    });
    assert(adminLogin.status === 200 || adminLogin.status === 201, 'Company Admin authenticated successfully');
    const adminToken = adminLogin.data.accessToken;
    const adminCompanyId = adminLogin.data.user.companyId;

    // -------------------------------------------------------------------------
    // 1. ADMIN creates EMPLOYEE -> triggers invitation
    // -------------------------------------------------------------------------
    console.log('\n--- Test 1: ADMIN creates EMPLOYEE triggers invitation flow ---');
    const empEmail = `new_emp_${testSuffix}@corp.test`;
    const createEmpRes = await request(
      'POST',
      '/employees',
      {
        firstName: 'Aarav',
        lastName: 'Sharma',
        email: empEmail,
        phone: `9825${String(testSuffix).slice(-6)}`,
        departmentId: 'dept-1',
        designationId: 'des-1',
      },
      { Authorization: `Bearer ${adminToken}` }
    );

    assert(createEmpRes.status === 201, `Employee created successfully (HTTP 201, ID: ${createEmpRes.data.id})`);
    assert(!!createEmpRes.data.invitation, 'Invitation object returned on employee creation');
    assert(!!createEmpRes.data.invitation.id, 'Invitation ID generated');
    const rawInvitationToken = createEmpRes.data.invitation.rawToken;
    assert(!!rawInvitationToken && rawInvitationToken.length === 64, `Generated cryptographically secure 32-byte hex token (len: ${rawInvitationToken?.length})`);

    // Verify token hash in MySQL
    await new Promise((r) => setTimeout(r, 800));
    const expectedHash = crypto.createHash('sha256').update(rawInvitationToken).digest('hex');
    const [dbRows] = await pool.query('SELECT * FROM employee_invitations WHERE tokenHash = ?', [expectedHash]);
    assert(dbRows.length === 1, 'Only SHA-256 hash of token is stored in MySQL employee_invitations');
    assert(dbRows[0] && dbRows[0].usedAt === null, 'Token is marked unused (usedAt is NULL)');
    assert(dbRows[0] && dbRows[0].revokedAt === null, 'Token is not revoked (revokedAt is NULL)');
    assert(dbRows[0] && dbRows[0].companyId === adminCompanyId, 'Invitation is strictly bound to companyId');

    // Verify raw token is NOT stored anywhere in the database table
    const [rawRows] = await pool.query('SELECT * FROM employee_invitations WHERE tokenHash = ?', [rawInvitationToken]);
    assert(rawRows.length === 0, 'Raw setup token is NEVER stored in MySQL');

    // -------------------------------------------------------------------------
    // 2. SUPER_ADMIN creates ADMIN -> does NOT trigger invitation
    // -------------------------------------------------------------------------
    console.log('\n--- Test 2: SUPER_ADMIN creates ADMIN does NOT trigger employee invitation ---');
    const newAdminEmail = `admin_created_${testSuffix}@corp.test`;
    const createAdminRes = await request(
      'POST',
      '/super-admin/admins',
      {
        firstName: 'Test',
        lastName: 'Administrator',
        email: newAdminEmail,
        password: 'AdminPassword@123',
        companyId: adminCompanyId,
      },
      { Authorization: `Bearer ${saToken}` }
    );
    assert(createAdminRes.status === 201, 'Super Admin created company admin successfully');
    assert(!createAdminRes.data.invitation, 'Employee invitation feature was NOT triggered for admin creation');

    // Verify 0 invitation records in DB for this admin
    const [adminInvRows] = await pool.query('SELECT * FROM employee_invitations WHERE email = ?', [newAdminEmail]);
    assert(adminInvRows.length === 0, 'Zero employee invitations created in DB for the provisioned admin');

    // -------------------------------------------------------------------------
    // 3 & 4. Valid token allows password setup
    // -------------------------------------------------------------------------
    console.log('\n--- Test 3 & 4: Valid token sets password via POST /auth/employee/set-password ---');
    const newEmployeePassword = 'MySecretPassword@2026';
    const setPasswordRes = await request('POST', '/auth/employee/set-password', {
      token: rawInvitationToken,
      password: newEmployeePassword,
    });
    assert(setPasswordRes.status === 200 || setPasswordRes.status === 201, `Password setup succeeded (HTTP ${setPasswordRes.status}: "${setPasswordRes.data.message}")`);

    // Verify token is now marked used in database
    await new Promise((r) => setTimeout(r, 800));
    const [usedDbRows] = await pool.query('SELECT * FROM employee_invitations WHERE tokenHash = ?', [expectedHash]);
    assert(usedDbRows[0].usedAt !== null, `Token is now marked used (usedAt: ${usedDbRows[0].usedAt})`);

    // -------------------------------------------------------------------------
    // 5. Expired token is rejected
    // -------------------------------------------------------------------------
    console.log('\n--- Test 5: Expired token is rejected ---');
    // Admin resends an invitation with expired duration (-60s) via API
    const expiredResendRes = await request(
      'POST',
      `/employees/${createEmpRes.data.id}/resend-invitation`,
      { expiresInSeconds: -60 },
      { Authorization: `Bearer ${adminToken}` }
    );
    const expiredRawToken = expiredResendRes.data.rawToken;

    const expiredRes = await request('POST', '/auth/employee/set-password', {
      token: expiredRawToken,
      password: 'AnotherPassword@123',
    });
    assert(expiredRes.status === 400, `Expired token returns 400 BadRequest (Got: ${expiredRes.status})`);
    assert(
      expiredRes.data.message && expiredRes.data.message.includes('expired'),
      `Expiration error verified: "${expiredRes.data.message}"`
    );

    // -------------------------------------------------------------------------
    // 6. Reused token is rejected
    // -------------------------------------------------------------------------
    console.log('\n--- Test 6: Reused token is rejected ---');
    const reuseRes = await request('POST', '/auth/employee/set-password', {
      token: rawInvitationToken,
      password: 'AttemptingReusedPassword@123',
    });
    assert(reuseRes.status === 400, `Reused token returns 400 BadRequest (Got: ${reuseRes.status})`);
    assert(
      reuseRes.data.message && reuseRes.data.message.includes('already been used'),
      `Reused token error verified: "${reuseRes.data.message}"`
    );

    // -------------------------------------------------------------------------
    // 7. Invalid/Forged token is rejected
    // -------------------------------------------------------------------------
    console.log('\n--- Test 7: Invalid / forged token is rejected ---');
    const invalidRes = await request('POST', '/auth/employee/set-password', {
      token: 'completely-fake-and-nonexistent-token-1234567890',
      password: 'Password@12345',
    });
    assert(invalidRes.status === 400, `Forged token returns 400 BadRequest (Got: ${invalidRes.status})`);
    assert(
      invalidRes.data.message && invalidRes.data.message.includes('Invalid or unknown'),
      `Invalid token message verified: "${invalidRes.data.message}"`
    );

    // -------------------------------------------------------------------------
    // 8. Concurrent requests cannot set password twice
    // -------------------------------------------------------------------------
    console.log('\n--- Test 8: Concurrent requests race condition prevention ---');
    const emp2Email = `emp_race_${testSuffix}@corp.test`;
    const emp2Res = await request(
      'POST',
      '/employees',
      {
        firstName: 'Priya',
        lastName: 'Patel',
        email: emp2Email,
        phone: `9826${String(testSuffix).slice(-6)}`,
        departmentId: 'dept-1',
        designationId: 'des-1',
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    const raceToken = emp2Res.data.invitation.rawToken;

    // Send two simultaneous requests with the same token
    const [raceRes1, raceRes2] = await Promise.all([
      request('POST', '/auth/employee/set-password', { token: raceToken, password: 'RacePassword@123' }),
      request('POST', '/auth/employee/set-password', { token: raceToken, password: 'RacePassword@123' }),
    ]);

    const raceStatuses = [raceRes1.status, raceRes2.status];
    const raceSuccessCount = raceStatuses.filter(s => s === 200 || s === 201).length;
    const raceFailCount = raceStatuses.filter(s => s === 400).length;

    assert(raceSuccessCount === 1, `Exactly ONE concurrent request succeeded (Got: ${raceSuccessCount})`);
    assert(raceFailCount === 1, `Competing concurrent request was rejected with 400 (Got: ${raceFailCount})`);

    // -------------------------------------------------------------------------
    // 9. ADMIN cannot create/resend invitation for another company's employee
    // -------------------------------------------------------------------------
    console.log('\n--- Test 9: Multi-company isolation on resend invitation ---');
    // Create a temporary Company B and Admin B using Super Admin
    const cmpBRes = await request('POST', '/super-admin/companies', {
      companyName: `Company B ${testSuffix}`,
      email: `compb_${testSuffix}@corp.test`,
      adminEmail: `admin_b_${testSuffix}@corp.test`,
      adminPassword: 'AdminPassword@123',
      adminFirstName: 'AdminB',
      adminLastName: 'Tester',
    }, { Authorization: `Bearer ${saToken}` });
    const cmpBCode = cmpBRes.data.companyCode;

    const adminBLogin = await request('POST', '/auth/login', {
      identifier: `admin_b_${testSuffix}@corp.test`,
      password: 'AdminPassword@123',
      companyCode: cmpBCode,
    });
    const adminBToken = adminBLogin.data.accessToken;

    // Call resend on Company A's employee using Company B's admin token
    const crossCompanyResend = await request(
      'POST',
      `/employees/${createEmpRes.data.id}/resend-invitation`,
      null,
      { Authorization: `Bearer ${adminBToken}` }
    );
    assert(crossCompanyResend.status === 403, `Cross-company invitation resend rejected with 403 Forbidden (Got: ${crossCompanyResend.status})`);
    assert(
      crossCompanyResend.data.message && crossCompanyResend.data.message.includes('own company'),
      `Tenant boundary enforced: "${crossCompanyResend.data.message}"`
    );

    // -------------------------------------------------------------------------
    // 10. Inactive employee cannot complete password setup
    // -------------------------------------------------------------------------
    console.log('\n--- Test 10: Inactive employee cannot complete password setup ---');
    const emp3Email = `emp_inactive_${testSuffix}@corp.test`;
    const emp3Res = await request(
      'POST',
      '/employees',
      {
        firstName: 'Inactive',
        lastName: 'Employee',
        email: emp3Email,
        phone: `9827${String(testSuffix).slice(-6)}`,
        departmentId: 'dept-1',
        designationId: 'des-1',
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    const emp3Token = emp3Res.data.invitation.rawToken;
    const emp3Id = emp3Res.data.id;

    // Admin deactivates employee
    await request('DELETE', `/employees/${emp3Id}`, null, {
      Authorization: `Bearer ${adminToken}`,
    });

    const inactiveSetupRes = await request('POST', '/auth/employee/set-password', {
      token: emp3Token,
      password: 'InactivePassword@123',
    });
    assert(inactiveSetupRes.status === 400, `Inactive employee password setup rejected with 400 (Got: ${inactiveSetupRes.status})`);
    assert(
      inactiveSetupRes.data.message && inactiveSetupRes.data.message.includes('inactive'),
      `Rejection message verified: "${inactiveSetupRes.data.message}"`
    );

    // -------------------------------------------------------------------------
    // 11. Existing login works after password setup
    // -------------------------------------------------------------------------
    console.log('\n--- Test 11: Employee logs in with newly configured password ---');
    const empLoginRes = await request('POST', '/auth/login', {
      identifier: empEmail,
      password: newEmployeePassword,
      companyCode: 'CMP-000001',
    });
    assert(empLoginRes.status === 200 || empLoginRes.status === 201, `Employee login succeeded with newly set password (HTTP ${empLoginRes.status})`);
    assert(!!empLoginRes.data.accessToken, 'Access token issued for the new employee');
    assert(empLoginRes.data.user.email.toLowerCase() === empEmail.toLowerCase(), 'Authenticated user matches employee email');
    assert(empLoginRes.data.user.role === 'EMPLOYEE', 'Role correctly assigned as EMPLOYEE');
    assert(empLoginRes.data.user.companyId === adminCompanyId, 'companyId matches tenant company');

    // Access protected API with employee's new token
    const profileRes = await request('GET', '/auth/me', null, {
      Authorization: `Bearer ${empLoginRes.data.accessToken}`,
    });
    assert(profileRes.status === 200, 'Employee accessed protected GET /auth/me with new token');

    // -------------------------------------------------------------------------
    // 12. Multi-Company & Existing functionality remains intact
    // -------------------------------------------------------------------------
    console.log('\n--- Test 12: Resend invitation within same company succeeds ---');
    const validResend = await request(
      'POST',
      `/employees/${createEmpRes.data.id}/resend-invitation`,
      null,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(validResend.status === 201 || validResend.status === 200, `Admin successfully resent invitation to own employee (HTTP ${validResend.status})`);
    assert(!!validResend.data.invitationId, 'Fresh invitation generated');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    await pool.end();
  }

  console.log('\n' + '='.repeat(80));
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('='.repeat(80));

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
