const http = require('http');

async function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  console.log('--- 1. Testing Login ---');
  const loginRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'sk@gmail.com', password: 'Sk@123' });

  console.log('Login status:', loginRes.status);
  const token = loginRes.body?.accessToken;
  if (!token) {
    console.error('Failed to get token:', loginRes.body);
    return;
  }
  console.log('Login successful! Token acquired.');

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  console.log('\n--- 2. GET /api/attendance/work/status ---');
  const statusBefore = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/attendance/work/status',
    method: 'GET',
    headers: authHeaders
  });
  console.log('Status before:', statusBefore.status, JSON.stringify(statusBefore.body, null, 2));

  // If there's an active session from before, stop it first or resume and stop
  if (statusBefore.body?.hasActiveSession) {
    console.log('Found active session from previous run, cleaning up...');
    if (statusBefore.body?.isOnBreak) {
      await request({
        hostname: 'localhost',
        port: 4000,
        path: '/api/attendance/work/break/resume',
        method: 'POST',
        headers: authHeaders
      }, {});
    }
    await request({
      hostname: 'localhost',
      port: 4000,
      path: '/api/attendance/work/stop',
      method: 'POST',
      headers: authHeaders
    }, {});
  }

  console.log('\n--- 3. POST /api/attendance/work/start with EMPTY body {} ---');
  const startRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/attendance/work/start',
    method: 'POST',
    headers: authHeaders
  }, {});
  console.log('Start work response status:', startRes.status);
  console.log('Start work response:', JSON.stringify(startRes.body, null, 2));

  console.log('\nWaiting 2 seconds...');
  await new Promise(r => setTimeout(r, 2000));

  console.log('\n--- 4. POST /api/attendance/work/break/start with EMPTY body {} ---');
  const breakStartRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/attendance/work/break/start',
    method: 'POST',
    headers: authHeaders
  }, {});
  console.log('Break start status:', breakStartRes.status);
  console.log('Break start response:', JSON.stringify(breakStartRes.body, null, 2));

  console.log('\n--- 5. Attempt stop while ON_BREAK (Must be blocked) ---');
  const prematureStop = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/attendance/work/stop',
    method: 'POST',
    headers: authHeaders
  }, {});
  console.log('Premature stop status (should be 400):', prematureStop.status);
  console.log('Premature stop message:', prematureStop.body?.message);

  console.log('\nWaiting 2 seconds on break...');
  await new Promise(r => setTimeout(r, 2000));

  console.log('\n--- 6. POST /api/attendance/work/break/resume with EMPTY body {} ---');
  const breakResumeRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/attendance/work/break/resume',
    method: 'POST',
    headers: authHeaders
  }, {});
  console.log('Break resume status:', breakResumeRes.status);
  console.log('Break resume response:', JSON.stringify(breakResumeRes.body, null, 2));

  console.log('\nWaiting 2 seconds working...');
  await new Promise(r => setTimeout(r, 2000));

  console.log('\n--- 7. POST /api/attendance/work/stop with EMPTY body {} ---');
  const stopRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/attendance/work/stop',
    method: 'POST',
    headers: authHeaders
  }, {});
  console.log('Stop work status:', stopRes.status);
  console.log('Stop work response:', JSON.stringify(stopRes.body, null, 2));

  console.log('\n--- 8. Final Status check ---');
  const finalStatus = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/attendance/work/status',
    method: 'GET',
    headers: authHeaders
  });
  console.log('Final work status:', JSON.stringify(finalStatus.body, null, 2));
}

run().catch(console.error);

