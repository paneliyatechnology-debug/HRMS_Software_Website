const mysql = require('mysql2/promise');
const { spawn } = require('child_process');
const http = require('http');

const PORT = 4000;
const BASE_URL = `http://127.0.0.1:${PORT}/api`;

function httpRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }
        resolve({ status: res.statusCode, data: json });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== HRMS AUTOMATED TAKE A BREAK TEST SUITE ===');

  // 1. Prepare MySQL Database
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'hrms',
  });
  console.log('✓ Connected to MySQL database');

  const testCompanyId = 'cmp-break-test-01';
  const testCompanyCode = 'CMP-BRK01';
  const testOfficeId = 'loc-break-office-01';
  const officeLat = 21.1702401;
  const officeLng = 72.8310607;
  const testEmpUserId = 'user-break-emp-01';
  const testEmpEmail = 'break.tester@test.com';

  // Ensure test company exists
  await conn.query(`
    INSERT INTO companies (id, companyCode, companyName, email, status, createdAt, updatedAt)
    VALUES (?, ?, 'Break Test Enterprise', 'break.company@test.com', 'Active', NOW(), NOW())
    ON DUPLICATE KEY UPDATE status='Active'
  `, [testCompanyId, testCompanyCode]);

  // Ensure test office location exists
  await conn.query(`
    INSERT INTO locations (id, companyId, companyCode, name, address, latitude, longitude, radiusMeters, isActive)
    VALUES (?, ?, ?, 'Break HQ Surat', 'Ring Road, Surat', ?, ?, 500, 1)
    ON DUPLICATE KEY UPDATE latitude=VALUES(latitude), longitude=VALUES(longitude), radiusMeters=500, isActive=1
  `, [testOfficeId, testCompanyId, testCompanyCode, officeLat, officeLng]);

  // Ensure test employee user exists
  const bcrypt = require('bcryptjs');
  const passwordHash = await bcrypt.hash('Test@1234', 10);
  await conn.query(`
    INSERT INTO users (id, companyId, companyCode, email, password, firstName, lastName, role, status, isSuperAdmin, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, 'Tester', 'BreakUser', 'EMPLOYEE', 'Active', 0, NOW(), NOW())
    ON DUPLICATE KEY UPDATE password=VALUES(password), status='Active', companyId=VALUES(companyId), companyCode=VALUES(companyCode)
  `, [testEmpUserId, testCompanyId, testCompanyCode, testEmpEmail, passwordHash]);

  // Clean prior test sessions/breaks for this employee
  await conn.query(`DELETE FROM attendance_breaks WHERE userId = ?`, [testEmpUserId]);
  await conn.query(`DELETE FROM work_sessions WHERE employeeId = ?`, [testEmpUserId]);
  console.log('✓ Test company, office location and employee user initialized in MySQL');
  await conn.end();

  // 2. Start NestJS Backend Server
  console.log('Starting NestJS server on port 4000...');
  const serverProc = spawn('node', ['dist/main.js'], {
    cwd: 'C:/HRMS backend/HRMS_Software_Website',
    env: { ...process.env, PORT: '4000' },
    stdio: 'pipe',
  });

  serverProc.stdout.on('data', (d) => {
    // process.stdout.write(d);
  });
  serverProc.stderr.on('data', (d) => {
    // process.stderr.write(d);
  });

  // Wait for server ready
  let serverReady = false;
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    try {
      const res = await httpRequest(`${BASE_URL}/system/health`);
      if (res.status === 200 || res.status === 404 || res.status === 401) {
        serverReady = true;
        break;
      }
    } catch {}
  }

  if (!serverReady) {
    console.error('✗ Server failed to start within 30 seconds');
    serverProc.kill();
    process.exit(1);
  }
  console.log('✓ Backend server is up and listening on port 4000');

  try {
    // 3. Login as Employee
    console.log('\n--- Step 1: Login as Employee ---');
    const loginRes = await httpRequest(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      email: testEmpEmail,
      password: 'Test@1234',
    });

    if (loginRes.status !== 200 && loginRes.status !== 201) {
      throw new Error(`Login failed with status ${loginRes.status}: ${JSON.stringify(loginRes.data)}`);
    }
    const token = loginRes.data.accessToken;
    console.log(`✓ Login successful. User: ${loginRes.data.user.email}, Role: ${loginRes.data.user.role}`);

    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    // Step 2: Check Initial Work Status
    console.log('\n--- Step 2: Initial Work Status ---');
    const initStatus = await httpRequest(`${BASE_URL}/attendance/work/status`, {
      method: 'GET',
      headers: authHeaders,
    });
    console.log(`✓ Initial status response (${initStatus.status}):`, initStatus.data);
    if (initStatus.data.hasActiveSession !== false || initStatus.data.isOnBreak !== false) {
      throw new Error('Initial status should have hasActiveSession=false and isOnBreak=false');
    }

    // Step 3: Test Geofence and Selfie validations
    console.log('\n--- Step 3: Geofence & Selfie Validations ---');
    // Test 3a: Out of geofence
    const outGeoRes = await httpRequest(`${BASE_URL}/attendance/work/start`, {
      method: 'POST',
      headers: authHeaders,
    }, {
      latitude: 0.0,
      longitude: 0.0,
      accuracy: 10,
      selfie: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    });
    console.log(`✓ Out-of-geofence check: status=${outGeoRes.status}, message="${outGeoRes.data.message}"`);
    if (outGeoRes.status !== 400) throw new Error('Out of geofence should return 400');

    // Test 3b: Missing selfie
    const noSelfieRes = await httpRequest(`${BASE_URL}/attendance/work/start`, {
      method: 'POST',
      headers: authHeaders,
    }, {
      latitude: officeLat,
      longitude: officeLng,
      accuracy: 10,
    });
    console.log(`✓ Missing selfie check: status=${noSelfieRes.status}, message="${noSelfieRes.data.message}"`);
    if (noSelfieRes.status !== 400) throw new Error('Missing selfie should return 400');

    // Step 4: Start Work Session (Check-in)
    console.log('\n--- Step 4: Check-in / Start Work Session ---');
    const validSelfie = 'data:image/jpeg;base64,' + Buffer.alloc(256, 'A').toString('base64');
    const startWorkRes = await httpRequest(`${BASE_URL}/attendance/work/start`, {
      method: 'POST',
      headers: authHeaders,
    }, {
      latitude: officeLat,
      longitude: officeLng,
      accuracy: 12,
      selfie: validSelfie,
      deviceInfo: 'Test Automated Chrome Client',
    });
    console.log(`✓ Start work response (${startWorkRes.status}):`, startWorkRes.data);
    if (startWorkRes.status !== 201) throw new Error(`Start work failed: ${JSON.stringify(startWorkRes.data)}`);
    const sessionId = startWorkRes.data.sessionId;

    // Step 5: Duplicate Start Work Rejection
    console.log('\n--- Step 5: Prevent Duplicate Start Work ---');
    const dupStartRes = await httpRequest(`${BASE_URL}/attendance/work/start`, {
      method: 'POST',
      headers: authHeaders,
    }, {
      latitude: officeLat,
      longitude: officeLng,
      accuracy: 10,
      selfie: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    });
    console.log(`✓ Duplicate start work rejected (${dupStartRes.status}): "${dupStartRes.data.message}"`);
    if (dupStartRes.status !== 400) throw new Error('Duplicate start work should be rejected with 400');

    // Step 6: Prevent Resume without active break
    console.log('\n--- Step 6: Prevent Resume Without Active Break ---');
    const badResume = await httpRequest(`${BASE_URL}/attendance/work/break/resume`, {
      method: 'POST',
      headers: authHeaders,
    });
    console.log(`✓ Resume without break rejected (${badResume.status}): "${badResume.data.message}"`);
    if (badResume.status !== 400) throw new Error('Resume without break should return 400');

    // Step 7: Take Break 1
    console.log('\n--- Step 7: Take Break 1 (Start Break) ---');
    const break1Start = await httpRequest(`${BASE_URL}/attendance/work/break/start`, {
      method: 'POST',
      headers: authHeaders,
    });
    console.log(`✓ Break 1 started (${break1Start.status}): breakId=${break1Start.data.breakId}, status=${break1Start.data.status}`);
    if (break1Start.status !== 201 || break1Start.data.status !== 'ON_BREAK') {
      throw new Error('Break 1 start failed');
    }

    // Step 8: Prevent Duplicate Break while on break
    console.log('\n--- Step 8: Prevent Duplicate Break While on Break ---');
    const dupBreakRes = await httpRequest(`${BASE_URL}/attendance/work/break/start`, {
      method: 'POST',
      headers: authHeaders,
    });
    console.log(`✓ Duplicate break rejected (${dupBreakRes.status}): "${dupBreakRes.data.message}"`);
    if (dupBreakRes.status !== 400) throw new Error('Duplicate break should be rejected with 400');

    // Step 9: Prevent Checkout / Stop Work while on break
    console.log('\n--- Step 9: Prevent Clock-out While on Break ---');
    const blockedStop = await httpRequest(`${BASE_URL}/attendance/work/stop`, {
      method: 'POST',
      headers: authHeaders,
    }, {
      latitude: officeLat,
      longitude: officeLng,
      accuracy: 10,
      selfie: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    });
    console.log(`✓ Clock-out on break blocked (${blockedStop.status}): "${blockedStop.data.message}"`);
    if (blockedStop.status !== 400 || !blockedStop.data.message.includes('Cannot clock out while on break')) {
      throw new Error('Clock-out on break should be blocked with 400');
    }

    // Step 10: Verify Status While On Break
    console.log('\n--- Step 10: Verify Status While On Break ---');
    await sleep(2000); // 2 seconds break duration
    const onBreakStatus = await httpRequest(`${BASE_URL}/attendance/work/status`, {
      method: 'GET',
      headers: authHeaders,
    });
    console.log(`✓ On-break status: isOnBreak=${onBreakStatus.data.isOnBreak}, sessionStatus=${onBreakStatus.data.activeSession.status}, breakElapsed=${onBreakStatus.data.currentBreak?.formattedElapsed}, totalBreak=${onBreakStatus.data.formattedTotalBreak}`);
    if (!onBreakStatus.data.isOnBreak || onBreakStatus.data.activeSession.status !== 'ON_BREAK') {
      throw new Error('Status should show isOnBreak=true');
    }

    // Step 11: Resume Break 1
    console.log('\n--- Step 11: Resume Break 1 ---');
    const resume1Res = await httpRequest(`${BASE_URL}/attendance/work/break/resume`, {
      method: 'POST',
      headers: authHeaders,
    });
    console.log(`✓ Break 1 resumed (${resume1Res.status}): duration=${resume1Res.data.formattedDuration} (${resume1Res.data.durationSeconds}s), status=${resume1Res.data.status}`);
    if (resume1Res.status !== 201 || resume1Res.data.status !== 'ACTIVE') {
      throw new Error('Resume 1 failed');
    }
    const break1Duration = resume1Res.data.durationSeconds;

    // Step 12: Work a bit, then Take Break 2 (Unlimited breaks test)
    console.log('\n--- Step 12: Take Break 2 (Unlimited Breaks Feature) ---');
    await sleep(1500);
    const break2Start = await httpRequest(`${BASE_URL}/attendance/work/break/start`, {
      method: 'POST',
      headers: authHeaders,
    });
    console.log(`✓ Break 2 started (${break2Start.status}): breakId=${break2Start.data.breakId}, status=${break2Start.data.status}`);
    if (break2Start.status !== 201 || break2Start.data.status !== 'ON_BREAK') {
      throw new Error('Break 2 start failed');
    }

    // Step 13: Resume Break 2
    console.log('\n--- Step 13: Resume Break 2 ---');
    await sleep(2000); // 2 seconds break duration
    const resume2Res = await httpRequest(`${BASE_URL}/attendance/work/break/resume`, {
      method: 'POST',
      headers: authHeaders,
    });
    console.log(`✓ Break 2 resumed (${resume2Res.status}): duration=${resume2Res.data.formattedDuration} (${resume2Res.data.durationSeconds}s), status=${resume2Res.data.status}`);
    if (resume2Res.status !== 201 || resume2Res.data.status !== 'ACTIVE') {
      throw new Error('Resume 2 failed');
    }
    const break2Duration = resume2Res.data.durationSeconds;
    const totalExpectedBreak = break1Duration + break2Duration;

    // Step 14: Stop Work / Check-out and verify working time calculation
    console.log('\n--- Step 14: Stop Work / Check-out & Time Calculation ---');
    await sleep(1500);
    const stopRes = await httpRequest(`${BASE_URL}/attendance/work/stop`, {
      method: 'POST',
      headers: authHeaders,
    }, {
      latitude: officeLat,
      longitude: officeLng,
      accuracy: 10,
      selfie: validSelfie,
      remarks: 'Completed 2 breaks successfully',
    });
    console.log(`✓ Work stopped successfully (${stopRes.status}):`);
    console.log(`  Session ID: ${stopRes.data.sessionId}`);
    console.log(`  Start Time: ${stopRes.data.startTime}`);
    console.log(`  End Time: ${stopRes.data.endTime}`);
    console.log(`  Actual Working Duration: ${stopRes.data.durationFormatted} (${stopRes.data.durationSeconds}s)`);

    const sessionStartMs = new Date(stopRes.data.startTime).getTime();
    const sessionEndMs = new Date(stopRes.data.endTime).getTime();
    const totalSessionSeconds = Math.floor((sessionEndMs - sessionStartMs) / 1000);
    const actualWorkSeconds = stopRes.data.durationSeconds;

    console.log(`  Total Session Time (Check-out - Check-in): ${totalSessionSeconds}s`);
    console.log(`  Total Break Time (Break 1 + Break 2): ${totalExpectedBreak}s`);
    console.log(`  Calculated Working Time (Session - Breaks): ${totalSessionSeconds - totalExpectedBreak}s`);
    console.log(`  Reported Actual Working Seconds: ${actualWorkSeconds}s`);

    const diff = Math.abs(actualWorkSeconds - (totalSessionSeconds - totalExpectedBreak));
    if (diff > 1) {
      throw new Error(`Time calculation discrepancy: actualWorkSeconds=${actualWorkSeconds}, expected=${totalSessionSeconds - totalExpectedBreak}`);
    }
    console.log(`✓ Time Calculation Formula Verified: Actual Working Time == Total Session Time - Total Break Time!`);

    // Step 15: Verify MySQL Persistence
    console.log('\n--- Step 15: Verify MySQL Persistence ---');
    const verifyConn = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: '',
      database: 'hrms',
    });

    const [dbBreaks] = await verifyConn.query(
      'SELECT id, attendanceSessionId, userId, breakStartTime, breakEndTime, durationSeconds FROM attendance_breaks WHERE attendanceSessionId = ? ORDER BY createdAt ASC',
      [sessionId]
    );
    console.log(`✓ attendance_breaks rows in MySQL (${dbBreaks.length} records):`);
    console.table(dbBreaks);
    if (dbBreaks.length !== 2) {
      throw new Error(`Expected 2 breaks in MySQL, found ${dbBreaks.length}`);
    }

    const [dbSessions] = await verifyConn.query(
      'SELECT id, employeeId, status, durationSeconds, durationFormatted FROM work_sessions WHERE id = ?',
      [sessionId]
    );
    console.log(`✓ work_sessions row in MySQL:`);
    console.table(dbSessions);
    if (dbSessions[0].status !== 'COMPLETED' || dbSessions[0].durationSeconds !== actualWorkSeconds) {
      throw new Error('work_sessions row mismatch in MySQL');
    }

    const [dbAttendance] = await verifyConn.query(
      'SELECT id, employeeId, date, checkIn, checkOut, breakDurationMinutes, workingHours FROM attendance_records WHERE employeeId = ? ORDER BY id DESC LIMIT 1',
      [testEmpUserId]
    );
    console.log(`✓ attendance_records row in MySQL:`);
    console.table(dbAttendance);

    await verifyConn.end();

    console.log('\n======================================================');
    console.log('✓ ALL TAKE A BREAK TESTS PASSED 100% SUCCESSFULLY!');
    console.log('======================================================');
  } finally {
    serverProc.kill();
    console.log('Server process terminated.');
  }
}

main().catch((err) => {
  console.error('\n✗ TEST FAILED:', err);
  process.exit(1);
});
