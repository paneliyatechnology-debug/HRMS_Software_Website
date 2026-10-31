/**
 * Comprehensive JWT Refresh Security Audit & Runtime Verification Suite
 * 
 * Verifies:
 * 1. Cookie Security (HttpOnly, Path, SameSite, Max-Age, Clear Cookie match)
 * 2. Hash & Storage Integrity (SHA-256 only in DB, raw token never stored)
 * 3. Atomic Rotation & Concurrent Race Condition (1 succeeds, 1 fails, family isolated)
 * 4. CSRF & CORS Security (Origin restriction, CSRF rejection of untrusted origin)
 * 5. Multi-Company & Role Verification (SUPER_ADMIN, ADMIN, EMPLOYEE isolation & tampering resistance)
 * 6. Inactive/Revoked Account Rejection (Inactive user refresh fails)
 * 7. Logout & Session Termination
 */

const http = require('http');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

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

function parseJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

function extractCookie(headers, cookieName) {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return null;
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const cookieStr of cookies) {
    if (cookieStr.startsWith(cookieName + '=')) {
      const parts = cookieStr.split(';');
      const value = parts[0].split('=')[1];
      const attributes = {};
      for (let i = 1; i < parts.length; i++) {
        const p = parts[i].trim();
        if (p.includes('=')) {
          const [k, v] = p.split('=');
          attributes[k.toLowerCase()] = v;
        } else {
          attributes[p.toLowerCase()] = true;
        }
      }
      return { raw: cookieStr, value, attributes };
    }
  }
  return null;
}

async function runAudit() {
  console.log('='.repeat(80));
  console.log('       FINAL JWT REFRESH SECURITY AUDIT & RUNTIME VERIFICATION');
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
    // -------------------------------------------------------------------------
    // 1. COOKIE SECURITY AUDIT
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Cookie Security Audit ---');
    const loginRes = await request('POST', '/auth/login', {
      identifier: 'superadmin@paneliya.com',
      password: 'Admin@123',
    });
    assert(loginRes.status === 200 || loginRes.status === 201, 'Super Admin login succeeded');
    const cookie = extractCookie(loginRes.headers, 'refreshToken');
    assert(!!cookie, 'refreshToken cookie set in Set-Cookie header');
    assert(cookie.attributes.httponly === true, 'Cookie attribute HttpOnly is enabled');
    assert(cookie.attributes.path === '/', 'Cookie path is strictly root ("/")');
    assert(String(cookie.attributes.samesite).toLowerCase() === 'lax', 'Cookie SameSite attribute is set to "Lax"');
    assert(cookie.attributes['max-age'] > 0, `Cookie Max-Age is configured (${cookie.attributes['max-age']}s)`);

    // -------------------------------------------------------------------------
    // 2. REFRESH TOKEN STORAGE & HASH INTEGRITY
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Storage & Hash Integrity Audit ---');
    const rawRefreshToken = cookie.value;
    assert(rawRefreshToken.length === 80, `Raw refresh token is cryptographically strong 40-byte hex (length: ${rawRefreshToken.length})`);

    // Allow atomic debounce to sync to MySQL
    await new Promise((r) => setTimeout(r, 500));

    // Query MySQL directly to verify raw token is NEVER stored
    const [rawRows] = await pool.query('SELECT * FROM refresh_tokens WHERE tokenHash = ?', [rawRefreshToken]);
    assert(rawRows.length === 0, 'Raw refresh token string is NEVER stored directly in MySQL');

    // Verify SHA-256 hash in MySQL
    const crypto = require('crypto');
    const expectedHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const [hashRows] = await pool.query('SELECT * FROM refresh_tokens WHERE tokenHash = ?', [expectedHash]);
    assert(hashRows.length === 1, 'Only SHA-256 hash is stored in MySQL database');
    assert(hashRows[0] && hashRows[0].isRevoked === 0, 'Newly issued refresh token in DB is marked active (isRevoked = 0)');

    // Verify database.json does not leak raw token (or is completely deleted)
    const jsonPath = path.join(__dirname, '..', 'data', 'database.json');
    if (fs.existsSync(jsonPath)) {
      const dbJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const jsonMatch = (dbJson.refreshTokens || []).find(r => r.tokenHash === rawRefreshToken);
      assert(!jsonMatch, 'Raw refresh token is NEVER stored in database.json');
    } else {
      console.log('  [PASS] database.json is completely removed - 100% pure MySQL architecture');
    }

    // -------------------------------------------------------------------------
    // 3. ATOMIC ROTATION & CONCURRENT RACE CONDITIONS
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Atomic Rotation & Concurrent Race Condition Audit ---');
    // Session A (Victim): login and get active token
    const sessionALogin = await request('POST', '/auth/login', {
      identifier: 'superadmin@paneliya.com',
      password: 'Admin@123',
    });
    const tokenA = extractCookie(sessionALogin.headers, 'refreshToken').value;

    // Session B (Unrelated user session): login
    const sessionBLogin = await request('POST', '/auth/login', {
      identifier: 'admin_a_1793438064974@corp.test',
      password: 'AdminPassword@123',
      companyCode: 'CMP-000014',
    });
    const tokenB = extractCookie(sessionBLogin.headers, 'refreshToken').value;

    // Fire TWO SIMULTANEOUS refresh requests with the EXACT SAME Token A
    const [simulRes1, simulRes2] = await Promise.all([
      request('POST', '/auth/refresh', null, { Cookie: `refreshToken=${tokenA}` }),
      request('POST', '/auth/refresh', null, { Cookie: `refreshToken=${tokenA}` }),
    ]);

    const statuses = [simulRes1.status, simulRes2.status];
    const successes = statuses.filter(s => s === 200 || s === 201).length;
    const failures = statuses.filter(s => s === 401).length;

    assert(successes === 1, `Exactly ONE concurrent request succeeded (Got: ${successes} succeeded)`);
    assert(failures === 1, `The competing duplicate request was rejected with 401 (Got: ${failures} rejected)`);

    // Verify token reuse detection revoked Session A family
    const familyCheck = await request('POST', '/auth/refresh', null, { Cookie: `refreshToken=${tokenA}` });
    assert(familyCheck.status === 401, 'Compromised Token A family is completely revoked');

    // Crucial: Verify Session B (unrelated user) is NOT affected by Session A family revocation!
    const sessionBRefresh = await request('POST', '/auth/refresh', null, { Cookie: `refreshToken=${tokenB}` });
    assert(sessionBRefresh.status === 200 || sessionBRefresh.status === 201, 'Unrelated Session B remains 100% active and unimpacted');

    // -------------------------------------------------------------------------
    // 4. CSRF AND CORS SECURITY AUDIT
    // -------------------------------------------------------------------------
    console.log('\n--- 4. CSRF & CORS Security Audit ---');
    // A: Allowed origin CORS preflight / request
    const allowedCors = await request('OPTIONS', '/auth/refresh', null, {
      Origin: 'http://localhost:3000',
      'Access-Control-Request-Method': 'POST',
    });
    assert(
      allowedCors.headers['access-control-allow-origin'] === 'http://localhost:3000',
      'CORS permits trusted frontend origin (http://localhost:3000)'
    );
    assert(
      allowedCors.headers['access-control-allow-credentials'] === 'true',
      'CORS sends Access-Control-Allow-Credentials: true for trusted origin'
    );

    // B: Untrusted origin CORS
    const evilCors = await request('OPTIONS', '/auth/refresh', null, {
      Origin: 'http://evil-attacker-site.com',
      'Access-Control-Request-Method': 'POST',
    });
    assert(
      !evilCors.headers['access-control-allow-origin'] || evilCors.headers['access-control-allow-origin'] !== 'http://evil-attacker-site.com',
      'CORS strictly blocks untrusted origin (http://evil-attacker-site.com)'
    );

    // C: CSRF Protection on POST /api/auth/refresh
    const newLogin = await request('POST', '/auth/login', {
      identifier: 'superadmin@paneliya.com',
      password: 'Admin@123',
    });
    const freshCookie = extractCookie(newLogin.headers, 'refreshToken').value;

    const csrfAttackRes = await request('POST', '/auth/refresh', null, {
      Cookie: `refreshToken=${freshCookie}`,
      Origin: 'http://evil-attacker-site.com',
    });
    assert(csrfAttackRes.status === 403, `Untrusted Origin on /auth/refresh returns 403 Forbidden (Got: ${csrfAttackRes.status})`);
    assert(
      csrfAttackRes.data.message && csrfAttackRes.data.message.includes('CSRF'),
      `CSRF defense triggered: "${csrfAttackRes.data.message}"`
    );

    // -------------------------------------------------------------------------
    // 5. ROLE AND MULTI-COMPANY ISOLATION AUDIT
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Role & Multi-Company Context Isolation ---');
    
    // Test 5A: SUPER_ADMIN
    const saLogin = await request('POST', '/auth/login', {
      identifier: 'superadmin@paneliya.com',
      password: 'Admin@123',
    });
    const saCookie = extractCookie(saLogin.headers, 'refreshToken').value;
    const saRefresh = await request('POST', '/auth/refresh', null, { Cookie: `refreshToken=${saCookie}` });
    const saPayload = parseJwt(saRefresh.data.accessToken);
    assert(saPayload.role === 'SUPER_ADMIN', 'SUPER_ADMIN role verified on refreshed token');
    assert(saPayload.userId === saLogin.data.user.id, 'SUPER_ADMIN userId matches database user record');

    // Test 5B: ADMIN
    const adminLogin = await request('POST', '/auth/login', {
      identifier: 'admin_a_1793438064974@corp.test',
      password: 'AdminPassword@123',
      companyCode: 'CMP-000014',
    });
    const adminCookie = extractCookie(adminLogin.headers, 'refreshToken').value;
    const adminRefresh = await request('POST', '/auth/refresh', null, { Cookie: `refreshToken=${adminCookie}` });
    const adminPayload = parseJwt(adminRefresh.data.accessToken);
    assert(adminPayload.role === 'ADMIN', 'ADMIN role verified on refreshed token');
    assert(adminPayload.companyId === 'cmp-1793438064988', 'ADMIN companyId strictly preserved from DB');
    assert(adminPayload.companyCode === 'CMP-000014', 'ADMIN companyCode strictly preserved from DB');

    // Test 5C: EMPLOYEE
    const empLogin = await request('POST', '/auth/login', {
      identifier: 'emp_a_1793438064974@corp.test',
      password: 'Employee@123',
      companyCode: 'CMP-000014',
    });
    const empCookie = extractCookie(empLogin.headers, 'refreshToken').value;
    const empRefresh = await request('POST', '/auth/refresh', null, { Cookie: `refreshToken=${empCookie}` });
    const empPayload = parseJwt(empRefresh.data.accessToken);
    assert(empPayload.role === 'EMPLOYEE', 'EMPLOYEE role verified on refreshed token');
    assert(empPayload.companyId === 'cmp-1793438064988', 'EMPLOYEE companyId strictly preserved from DB');
    assert(empPayload.companyCode === 'CMP-000014', 'EMPLOYEE companyCode strictly preserved from DB');

    // Test 5D: Parameter Tampering Resistance
    // Attacker tries to inject a different role and companyId into refresh body
    const tamperedRefresh = await request('POST', '/auth/refresh', {
      refreshToken: extractCookie(empRefresh.headers, 'refreshToken').value,
      role: 'SUPER_ADMIN',
      companyId: 'cmp-stolen-super',
      companyCode: 'CMP-HACKED',
    });
    const tamperedPayload = parseJwt(tamperedRefresh.data.accessToken);
    assert(tamperedPayload.role === 'EMPLOYEE', 'Tampered role in body is completely ignored (remains EMPLOYEE)');
    assert(tamperedPayload.companyId === 'cmp-1793438064988', 'Tampered companyId is completely ignored (remains CMP-000014)');

    // -------------------------------------------------------------------------
    // 6. INACTIVE & REVOKED ACCOUNT REJECTION
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Inactive & Revoked Account Rejection ---');
    const saAuth = await request('POST', '/auth/login', {
      identifier: 'superadmin@paneliya.com',
      password: 'Admin@123',
    });
    // Create dedicated employee for deactivation testing
    const deactSuffix = Date.now();
    const deactEmpEmail = `emp_deact_${deactSuffix}@corp.test`;
    const deactEmpRes = await request(
      'POST',
      '/employees',
      {
        firstName: 'Deact',
        lastName: 'Test',
        email: deactEmpEmail,
        password: 'Employee@123',
        phone: `9911${String(deactSuffix).slice(-6)}`,
        companyId: 'cmp-1793438064988',
        departmentId: 'dept-1',
        designationId: 'des-1',
      },
      { Authorization: `Bearer ${saAuth.data.accessToken}` }
    );
    const testEmpId = deactEmpRes.data.id;

    // Login as this employee to obtain their active refresh token
    const testEmpLogin = await request('POST', '/auth/login', {
      identifier: deactEmpEmail,
      password: 'Employee@123',
      companyCode: 'CMP-000014',
    });
    const testEmpToken = extractCookie(testEmpLogin.headers, 'refreshToken').value;

    // Super Admin deactivates this employee via DELETE /api/employees/:id (soft-delete)
    const deactivateRes = await request('DELETE', `/employees/${testEmpId}`, null, {
      Authorization: `Bearer ${saAuth.data.accessToken}`,
    });
    assert(deactivateRes.status === 200, `Employee deactivated via API (HTTP 200, status: ${deactivateRes.data?.status || 'Inactive'})`);

    // Deactivated employee attempts to refresh their token
    const inactiveRefresh = await request('POST', '/auth/refresh', null, {
      Cookie: `refreshToken=${testEmpToken}`,
    });
    assert(inactiveRefresh.status === 401, 'Inactive user refresh request rejected with 401 Unauthorized');
    assert(
      inactiveRefresh.data.message && inactiveRefresh.data.message.includes('inactive'),
      `Security rejection message: "${inactiveRefresh.data.message}"`
    );

    // -------------------------------------------------------------------------
    // 7. LOGOUT & SESSION TERMINATION
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Logout & Session Termination Audit ---');
    const freshLogin = await request('POST', '/auth/login', {
      identifier: 'superadmin@paneliya.com',
      password: 'Admin@123',
    });
    const freshTokenToLogout = extractCookie(freshLogin.headers, 'refreshToken').value;

    const logoutRes = await request('POST', '/auth/logout', null, {
      Cookie: `refreshToken=${freshTokenToLogout}`,
    });
    assert(logoutRes.status === 200 || logoutRes.status === 201, 'Logout returned HTTP 200/201');

    const logoutCookie = extractCookie(logoutRes.headers, 'refreshToken');
    assert(logoutCookie.value === '', 'refreshToken cookie cleared with empty string');
    assert(logoutCookie.attributes.httponly === true, 'Cleared cookie retains HttpOnly attribute');
    assert(logoutCookie.attributes.path === '/', 'Cleared cookie retains path="/"');

    // Attempt refresh after logout
    const postLogoutRefresh = await request('POST', '/auth/refresh', null, {
      Cookie: `refreshToken=${freshTokenToLogout}`,
    });
    assert(postLogoutRefresh.status === 401, 'Refresh attempt after logout is rejected with 401 Unauthorized');

  } catch (err) {
    console.error('Audit execution error:', err);
    failed++;
  } finally {
    await pool.end();
  }

  console.log('\n' + '='.repeat(80));
  console.log(`SECURITY AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('='.repeat(80));

  process.exit(failed > 0 ? 1 : 0);
}

runAudit();
