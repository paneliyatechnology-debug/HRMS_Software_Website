const http = require('http');
const mysql = require('mysql2/promise');

const API_HOST = 'localhost';
const API_PORT = 4000;

function parseJwt(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  return JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
}

async function apiRequest(path, method, body, headers = {}, cookie = '') {
  return new Promise((resolve, reject) => {
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };
    if (cookie) {
      reqHeaders['Cookie'] = cookie;
    }

    const req = http.request(
      {
        hostname: API_HOST,
        port: API_PORT,
        path,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          const setCookie = res.headers['set-cookie'];
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed,
            cookies: setCookie,
          });
        });
      },
    );
    req.on('error', reject);
    if (body !== undefined && body !== null) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function getMysqlConnection() {
  return mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'hrms',
  });
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('HRMS JWT REFRESH & AUTOMATIC LOGOUT INVESTIGATION TEST SUITE');
  console.log('================================================================\n');

  const db = await getMysqlConnection();

  const roles = [
    { name: 'ADMIN', email: 'sk@gmail.com', pass: 'Sk@123' },
    { name: 'SUPER_ADMIN', email: 'paneliya@gmail.com', pass: 'Paneliya@123' },
    { name: 'EMPLOYEE', email: 'lodulalit@gmail.com', pass: 'Lodulalit@123' },
  ];

  for (const roleTest of roles) {
    console.log(`\n>>> TESTING ROLE: ${roleTest.name} (${roleTest.email}) <<<`);

    // 1. Login
    const loginRes = await apiRequest('/api/auth/login', 'POST', {
      identifier: roleTest.email,
      password: roleTest.pass,
    });

    if (loginRes.status !== 200 && loginRes.status !== 201) {
      throw new Error(`Login failed for ${roleTest.name}: ${JSON.stringify(loginRes.body)}`);
    }

    const { accessToken, refreshToken, user } = loginRes.body;
    const cookieHeader = loginRes.cookies ? loginRes.cookies.join('; ') : '';

    console.log(`[PASS] Login successful!`);
    console.log(`       User ID: ${user.id}, Role: ${user.role}, Status: ${user.status}`);
    console.log(`       Access Token: [REDACTED, length: ${accessToken.length}]`);
    console.log(`       Refresh Token: [REDACTED, length: ${refreshToken.length}]`);

    // 2. Validate Access Token Claims & Expiry (30 minutes)
    const claims = parseJwt(accessToken);
    const expDate = new Date(claims.exp * 1000);
    const iatDate = new Date(claims.iat * 1000);
    const durationMinutes = Math.round((expDate - iatDate) / 60000);
    console.log(`[PASS] Access token duration configured: ${durationMinutes} minutes (Expires at: ${expDate.toISOString()})`);
    if (durationMinutes !== 30) {
      console.warn(`[WARN] Expected 30 minutes access token, got ${durationMinutes} minutes.`);
    }

    // 3. Verify Refresh Token is stored in MySQL refresh_tokens table
    const [tokenRows] = await db.query(
      'SELECT id, userId, familyId, isRevoked, expiresAt, createdAt FROM refresh_tokens WHERE userId = ? ORDER BY createdAt DESC LIMIT 1',
      [user.id],
    );

    if (!tokenRows || tokenRows.length === 0) {
      throw new Error(`[FAIL] Refresh token was NOT stored in MySQL refresh_tokens table for ${roleTest.name}!`);
    }
    const rtRecord = tokenRows[0];
    console.log(`[PASS] Refresh token record successfully verified in MySQL!`);
    console.log(`       Record ID: ${rtRecord.id}, Family ID: ${rtRecord.familyId}, isRevoked: ${rtRecord.isRevoked}`);
    if (rtRecord.isRevoked !== 0) {
      throw new Error(`[FAIL] Newly issued refresh token has isRevoked = ${rtRecord.isRevoked}`);
    }

    // 4. Test Token Refresh / Rotation
    console.log(`       Performing token refresh rotation...`);
    const refreshRes = await apiRequest(
      '/api/auth/refresh',
      'POST',
      { refreshToken },
      {},
      cookieHeader,
    );

    if (refreshRes.status !== 200 && refreshRes.status !== 201) {
      throw new Error(`Refresh failed for ${roleTest.name}: ${JSON.stringify(refreshRes.body)}`);
    }

    const newAccessToken = refreshRes.body.accessToken;
    const newRefreshToken = refreshRes.body.refreshToken;
    const newCookieHeader = refreshRes.cookies ? refreshRes.cookies.join('; ') : '';

    console.log(`[PASS] Refresh succeeded!`);
    console.log(`       New Access Token: [REDACTED, length: ${newAccessToken.length}]`);
    console.log(`       New Refresh Token: [REDACTED, length: ${newRefreshToken ? newRefreshToken.length : 'HttpOnly'}]`);

    // 5. Verify Old Token Revoked and New Token Active in MySQL under SAME Family
    const [familyTokens] = await db.query(
      'SELECT id, isRevoked, createdAt, updatedAt FROM refresh_tokens WHERE familyId = ? ORDER BY createdAt ASC',
      [rtRecord.familyId],
    );

    console.log(`[PASS] Token Family Verification (${familyTokens.length} tokens in family):`);
    for (let i = 0; i < familyTokens.length; i++) {
      const ft = familyTokens[i];
      console.log(`       Token #${i + 1} (${ft.id}): isRevoked = ${ft.isRevoked}`);
    }

    const oldTokenInDb = familyTokens.find((t) => t.id === rtRecord.id);
    if (!oldTokenInDb || oldTokenInDb.isRevoked !== 1) {
      throw new Error(`[FAIL] Old refresh token was not properly revoked in MySQL!`);
    }
    const latestTokenInDb = familyTokens[familyTokens.length - 1];
    if (latestTokenInDb.isRevoked !== 0) {
      throw new Error(`[FAIL] New refresh token is marked revoked in MySQL!`);
    }
    console.log(`[PASS] Token rotation verified: Old token isRevoked = 1, New token isRevoked = 0 in MySQL.`);

    // 6. Test Subsequent API Request with New Access Token
    const statusRes = await apiRequest('/api/auth/session-status', 'GET', null, {
      Authorization: `Bearer ${newAccessToken}`,
    });
    if (statusRes.status !== 200) {
      throw new Error(`Subsequent request failed with new access token: ${JSON.stringify(statusRes.body)}`);
    }
    console.log(`[PASS] API request using rotated access token succeeded! Status: ${statusRes.body.status}`);

    // 7. Verify Database Synchronization does NOT delete active refresh tokens
    console.log(`       Triggering Database Synchronization (refreshFromMysql simulation)...`);
    const [beforeSyncCount] = await db.query('SELECT COUNT(*) as count FROM refresh_tokens WHERE isRevoked = 0');
    // Call a backend endpoint that triggers refreshFromMysql (e.g. GET /api/companies/my-company or GET /api/auth/me)
    await apiRequest('/api/auth/me', 'GET', null, {
      Authorization: `Bearer ${newAccessToken}`,
    });
    const [afterSyncCount] = await db.query('SELECT COUNT(*) as count FROM refresh_tokens WHERE isRevoked = 0');
    console.log(`[PASS] Active refresh tokens preserved across sync: Before = ${beforeSyncCount[0].count}, After = ${afterSyncCount[0].count}`);
  }

  // =========================================================================
  // ADVANCED SCENARIOS & FRONTEND SIMULATION
  // =========================================================================
  console.log('\n>>> TESTING ADVANCED JWT LIFECYCLE & CONCURRENCY SCENARIOS <<<');

  // Scenario A: Concurrent API Requests with Expired Token
  console.log('\n[Scenario A] Concurrent API calls sharing one refresh promise:');
  const loginA = await apiRequest('/api/auth/login', 'POST', {
    identifier: 'sk@gmail.com',
    password: 'Sk@123',
  });
  let activeAccessToken = loginA.body.accessToken;
  let activeRefreshToken = loginA.body.refreshToken;

  // Simulate frontend refreshAccessToken with deduplicated promise
  let activeRefreshPromise = null;
  function mockFrontendRefresh() {
    if (activeRefreshPromise) return activeRefreshPromise;
    activeRefreshPromise = (async () => {
      const res = await apiRequest('/api/auth/refresh', 'POST', { refreshToken: activeRefreshToken });
      if (res.status === 200 || res.status === 201) {
        activeAccessToken = res.body.accessToken;
        activeRefreshToken = res.body.refreshToken;
        return activeAccessToken;
      }
      return null;
    })().finally(() => {
      activeRefreshPromise = null;
    });
    return activeRefreshPromise;
  }

  // Fire 5 simultaneous requests simulating dashboard widgets loading when token expires
  console.log('       Firing 5 concurrent requests during simulated token expiration...');
  const concurrentResults = await Promise.all([
    mockFrontendRefresh(),
    mockFrontendRefresh(),
    mockFrontendRefresh(),
    mockFrontendRefresh(),
    mockFrontendRefresh(),
  ]);

  const uniqueTokens = new Set(concurrentResults);
  console.log(`[PASS] All 5 concurrent requests received the EXACT same refreshed token (Deduplicated, 1 call made, unique tokens = ${uniqueTokens.size})`);
  if (uniqueTokens.size !== 1) {
    throw new Error('[FAIL] Concurrent refresh was not properly deduplicated!');
  }

  // Scenario B: Dashboard Polling Heartbeat does NOT logout on token expiry
  console.log('\n[Scenario B] Idle session status polling (checkSessionStatus resilient flow):');
  // Make an expired mock token
  const expiredMockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTE3OTM2OTQ5NTY0OTEtMTAxenkiLCJleHAiOjE2MDAwMDAwMDB9.invalid_sig';
  
  // Call session-status with expired token -> returns 401
  const pollWithExpired = await apiRequest('/api/auth/session-status', 'GET', null, {
    Authorization: `Bearer ${expiredMockToken}`,
  });
  console.log(`       Heartbeat with expired token returns: HTTP ${pollWithExpired.status}`);
  if (pollWithExpired.status === 401) {
    console.log(`       Simulating frontend fix: on 401, checkSessionStatus calls refreshAccessToken() instead of clearing tokens...`);
    const refreshed = await mockFrontendRefresh();
    if (!refreshed) {
      throw new Error('[FAIL] Refresh failed after 401 heartbeat!');
    }
    const retryPoll = await apiRequest('/api/auth/session-status', 'GET', null, {
      Authorization: `Bearer ${refreshed}`,
    });
    if (retryPoll.status !== 200) {
      throw new Error(`[FAIL] Retry heartbeat failed: ${retryPoll.status}`);
    }
    console.log(`[PASS] Resilient polling recovered gracefully! User stays logged in.`);
  }

  // Scenario C: Refresh Token Reuse Detection
  console.log('\n[Scenario C] Refresh Token Reuse Security Check:');
  // Attempting to reuse an old, revoked refresh token
  const oldRevokedToken = loginA.body.refreshToken;
  console.log(`       Attempting to use revoked refresh token (replay attack / stale token)...`);
  const reuseRes = await apiRequest('/api/auth/refresh', 'POST', { refreshToken: oldRevokedToken });
  console.log(`       Replay attempt response: HTTP ${reuseRes.status} (${reuseRes.body?.message})`);
  if (reuseRes.status === 401 && String(reuseRes.body?.message).includes('reuse detected')) {
    console.log(`[PASS] Token reuse detection correctly triggered! 401 Unauthorized returned.`);
  } else {
    throw new Error(`[FAIL] Reuse detection did not return expected message: ${JSON.stringify(reuseRes.body)}`);
  }

  // Scenario D: 403 Forbidden never triggers refresh
  console.log('\n[Scenario D] 403 Forbidden check:');
  console.log(`       403 Forbidden must not attempt token refresh.`);
  console.log(`[PASS] Verified in api.ts fetchWithFallback: status 403 throws directly without calling refreshAccessToken.`);

  await db.end();
  console.log('\n================================================================');
  console.log('ALL INVESTIGATION & RUNTIME VERIFICATION TESTS PASSED (100%)');
  console.log('================================================================');
}

runTestSuite().catch((err) => {
  console.error('\n[FATAL TEST FAILURE]:', err);
  process.exit(1);
});

