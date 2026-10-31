/**
 * Automated Test Suite: Automatic JWT Token Refresh & 30-Minute Rotation System
 * 
 * Verifies:
 * 1. Login returns accessToken (30m expiry) and refreshToken (7d expiry, HttpOnly cookie)
 * 2. Token payload verification: exp - iat === 1800 seconds (30 minutes)
 * 3. Successful token refresh via POST /api/auth/refresh (cookie-based & body-based)
 * 4. Token rotation: new refresh token issued, old refresh token revoked
 * 5. Reuse detection: using an already rotated token revokes the entire family and returns 401
 * 6. Protection against invalid/tampered refresh tokens (401)
 * 7. Protected endpoints accept the newly refreshed access token
 * 8. User context (userId, role, companyId, companyCode) preserved across refreshes
 * 9. POST /api/auth/logout revokes refresh tokens and clears the cookie
 */

const http = require('http');

const BASE_URL = 'http://localhost:4000/api';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
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
    const base64Url = token.split('.')[1];
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
      return parts[0].split('=')[1];
    }
  }
  return null;
}

async function runTests() {
  console.log('='.repeat(80));
  console.log('       AUTOMATIC JWT TOKEN REFRESH & 30-MINUTE ROTATION TEST SUITE');
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

  try {
    // 1. Super Admin Login
    console.log('\n--- Scenario 1: Login generates 30m Access Token & Refresh Token ---');
    const loginRes = await request('POST', '/auth/login', {
      identifier: 'admin@paneliya.com',
      password: 'Admin@123',
    });

    assert(loginRes.status === 201 || loginRes.status === 200, 'Login succeeded (HTTP 200/201)');
    assert(!!loginRes.data.accessToken, 'Access token returned in response body');
    assert(!!loginRes.data.refreshToken, 'Refresh token returned in response body');

    const rawCookie = extractCookie(loginRes.headers, 'refreshToken');
    assert(!!rawCookie, 'HttpOnly refreshToken cookie set in response headers');

    // 2. Token payload and 30-minute expiration check
    console.log('\n--- Scenario 2: Access Token Expiry is exactly 30 minutes ---');
    const tokenPayload = parseJwt(loginRes.data.accessToken);
    assert(!!tokenPayload, 'JWT payload successfully decoded');
    const tokenDurationSeconds = tokenPayload.exp - tokenPayload.iat;
    assert(tokenDurationSeconds === 1800, `Access token lifespan is exactly 30 minutes (1800s, got: ${tokenDurationSeconds}s)`);
    assert(tokenPayload.role === 'SUPER_ADMIN', 'Role is correctly embedded in JWT');
    assert(tokenPayload.userId === loginRes.data.user.id, 'userId matches authenticated user');

    // 3. Background Refresh using Cookie
    console.log('\n--- Scenario 3: Automatic Background Refresh via HttpOnly Cookie ---');
    const refreshRes = await request('POST', '/auth/refresh', null, {
      Cookie: `refreshToken=${rawCookie}`,
    });

    assert(refreshRes.status === 201 || refreshRes.status === 200, 'Refresh endpoint returned 200/201');
    assert(!!refreshRes.data.accessToken, 'New rotated access token returned');
    assert(refreshRes.data.accessToken !== loginRes.data.accessToken, 'New access token is distinct from previous token');

    const newJwtPayload = parseJwt(refreshRes.data.accessToken);
    assert(newJwtPayload.exp - newJwtPayload.iat === 1800, 'New access token also has 30m expiry (1800s)');
    assert(newJwtPayload.userId === tokenPayload.userId, 'Tenant/User identity preserved in refreshed token');
    assert(newJwtPayload.role === tokenPayload.role, 'Role preserved in refreshed token');

    const rotatedCookie = extractCookie(refreshRes.headers, 'refreshToken');
    assert(!!rotatedCookie, 'New rotated refreshToken cookie set');
    assert(rotatedCookie !== rawCookie, 'Refresh token rotated to a new cryptographically secure token');

    // 4. Using the newly refreshed access token for protected API calls
    console.log('\n--- Scenario 4: Access protected endpoints with renewed token ---');
    const profileRes = await request('GET', '/auth/me', null, {
      Authorization: `Bearer ${refreshRes.data.accessToken}`,
    });
    assert(profileRes.status === 200, 'Protected GET /auth/me succeeds with refreshed token');
    assert(profileRes.data.id === tokenPayload.userId, 'Profile matches authenticated user');

    // 5. Token Reuse Detection
    console.log('\n--- Scenario 5: Refresh Token Reuse Detection & Family Revocation ---');
    // Try to re-use the OLD rawCookie (which was already rotated)
    const reuseAttemptRes = await request('POST', '/auth/refresh', null, {
      Cookie: `refreshToken=${rawCookie}`,
    });
    assert(reuseAttemptRes.status === 401, 'Reusing previous refresh token was rejected with 401 Unauthorized');
    assert(
      reuseAttemptRes.data.message && reuseAttemptRes.data.message.includes('reuse detected'),
      `Security response identifies reuse: "${reuseAttemptRes.data.message}"`
    );

    // Now try to use the rotatedCookie from the same family - it should also be revoked!
    const familyCheckRes = await request('POST', '/auth/refresh', null, {
      Cookie: `refreshToken=${rotatedCookie}`,
    });
    assert(familyCheckRes.status === 401, 'Whole token family revoked: subsequent token in same family also fails (401)');

    // 6. Non-existent / forged refresh token
    console.log('\n--- Scenario 6: Malformed or forged refresh token ---');
    const fakeTokenRes = await request('POST', '/auth/refresh', {
      refreshToken: 'completely-fake-and-invalid-token-12345',
    });
    assert(fakeTokenRes.status === 401, 'Forged refresh token returns 401 Unauthorized');

    // 7. Multi-Company Admin Refresh Test
    console.log('\n--- Scenario 7: Company Admin Refresh & Context Isolation ---');
    // Login as a company admin
    const adminLoginRes = await request('POST', '/auth/login', {
      identifier: 'sarah.hr@paneliya.com',
      password: 'Admin@123',
      companyCode: 'CMP-000001',
    });
    assert(adminLoginRes.status === 200 || adminLoginRes.status === 201, 'Company Admin login successful');
    const adminToken = adminLoginRes.data.accessToken;
    const adminCookie = extractCookie(adminLoginRes.headers, 'refreshToken');
    const adminPayload = parseJwt(adminToken);

    assert(adminPayload.companyId === adminLoginRes.data.user.companyId, 'Admin token has valid companyId');
    assert(adminPayload.companyCode === adminLoginRes.data.user.companyCode, 'Admin token has valid companyCode');

    // Refresh company admin token
    const adminRefreshRes = await request('POST', '/auth/refresh', null, {
      Cookie: `refreshToken=${adminCookie}`,
    });
    assert(adminRefreshRes.status === 200 || adminRefreshRes.status === 201, 'Company Admin token refresh succeeded');
    const refreshedAdminPayload = parseJwt(adminRefreshRes.data.accessToken);

    assert(refreshedAdminPayload.companyId === adminPayload.companyId, 'Company ID strictly preserved across refresh');
    assert(refreshedAdminPayload.companyCode === adminPayload.companyCode, 'Company Code strictly preserved across refresh');
    assert(refreshedAdminPayload.role === 'ADMIN', 'Admin role preserved across refresh');

    // 8. Logout revokes refresh token and clears cookie
    console.log('\n--- Scenario 8: Logout revokes session and clears cookie ---');
    const adminRotatedCookie = extractCookie(adminRefreshRes.headers, 'refreshToken');
    const logoutRes = await request('POST', '/auth/logout', null, {
      Cookie: `refreshToken=${adminRotatedCookie}`,
    });
    assert(logoutRes.status === 200 || logoutRes.status === 201, 'Logout endpoint returned 200/201');

    const logoutCookie = extractCookie(logoutRes.headers, 'refreshToken');
    assert(logoutCookie === '', 'HttpOnly cookie explicitly cleared on logout');

    // Verify token can no longer be refreshed
    const postLogoutRefresh = await request('POST', '/auth/refresh', null, {
      Cookie: `refreshToken=${adminRotatedCookie}`,
    });
    assert(postLogoutRefresh.status === 401, 'Refresh attempt after logout returns 401 Unauthorized');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n' + '='.repeat(80));
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('='.repeat(80));

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
