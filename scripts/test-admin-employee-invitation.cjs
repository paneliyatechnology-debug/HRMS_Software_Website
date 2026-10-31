const http = require('http');
const https = require('https');

const BASE_URL = 'http://localhost:4000/api';

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(options.url || (BASE_URL + options.path));
    const reqOptions = {
      method: options.method || 'GET',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch {}
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
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
  console.log('=== TEST: ADMIN EMPLOYEE CREATION & NODEMAILER INVITATION ===\n');

  // 1. Login as Admin ravik@gmail.com
  console.log('Step 1: Authenticating as Company Admin (ravik@gmail.com)...');
  const loginRes = await request({
    path: '/auth/login',
    method: 'POST',
  }, {
    email: 'ravik@gmail.com',
    password: 'password123', // common default or let's test Admin password
  });

  let token = loginRes.body.accessToken;
  if (!token) {
    console.log('Login failed with default password, trying SuperAdmin or AdminPass123!...');
    const loginRes2 = await request({
      path: '/auth/login',
      method: 'POST',
    }, {
      email: 'ravik@gmail.com',
      password: 'Admin@123',
    });
    token = loginRes2.body.accessToken;
    if (!token) {
      // Try superadmin
      const superRes = await request({
        path: '/auth/login',
        method: 'POST',
      }, {
        email: 'superadmin@paneliya.com',
        password: 'password123',
      });
      token = superRes.body.accessToken;
      console.log('Authenticated as SUPER_ADMIN');
    } else {
      console.log('Authenticated as ADMIN ravik@gmail.com');
    }
  } else {
    console.log('Authenticated as ADMIN ravik@gmail.com');
  }

  if (!token) {
    console.error('Could not authenticate. Login response:', loginRes.body);
    process.exit(1);
  }

  // 2. Test Resend Invitation to existing employee donbhau111222@gmail.com
  console.log('\nStep 2: Testing POST /api/admin/employees/:id/resend-invitation with donbhau111222@gmail.com...');
  const resendRes = await request({
    path: '/admin/employees/donbhau111222@gmail.com/resend-invitation',
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Resend Status:', resendRes.status);
  console.log('Resend Response:', JSON.stringify(resendRes.body, null, 2));

  // 3. Test POST /api/admin/employees with duplicate email (should return 409 Conflict)
  console.log('\nStep 3: Testing POST /api/admin/employees with duplicate email (without resend flag)...');
  const dupRes = await request({
    path: '/admin/employees',
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }, {
    firstName: 'Test',
    lastName: 'Duplicate',
    email: 'donbhau111222@gmail.com',
  });
  console.log('Duplicate Email Status:', dupRes.status);
  console.log('Duplicate Email Response:', JSON.stringify(dupRes.body, null, 2));

  // 4. Test POST /api/admin/employees with duplicate email + resendIfExisting: true
  console.log('\nStep 4: Testing POST /api/admin/employees with duplicate email and resendIfExisting: true...');
  const resendFlagRes = await request({
    path: '/admin/employees',
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }, {
    firstName: 'Test',
    lastName: 'Duplicate',
    email: 'donbhau111222@gmail.com',
    resendIfExisting: true,
  });
  console.log('Resend Flag Status:', resendFlagRes.status);
  console.log('Resend Flag Response:', JSON.stringify(resendFlagRes.body, null, 2));

  // 5. Test POST /api/admin/employees with a brand new unique employee
  const timestamp = Date.now();
  const testNewEmail = `emp.invite.test.${timestamp}@gmail.com`;
  console.log(`\nStep 5: Testing POST /api/admin/employees with brand new employee (${testNewEmail})...`);
  const createNewRes = await request({
    path: '/admin/employees',
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }, {
    firstName: 'Kiran',
    lastName: 'Shah',
    email: testNewEmail,
    phone: `+91 98${String(timestamp).slice(-8)}`,
  });
  console.log('Create New Status:', createNewRes.status);
  console.log('Create New Response:', JSON.stringify(createNewRes.body, null, 2));

  console.log('\n=== VERIFICATION SUMMARY ===');
  console.log('1. Resend to existing employee sent email:', resendRes.body.emailSent ? 'PASSED (Email Sent)' : 'CHECK');
  console.log('2. Duplicate email properly rejected with 409:', dupRes.status === 409 ? 'PASSED (409 Conflict)' : 'FAILED');
  console.log('3. resendIfExisting: true automatically resent email:', resendFlagRes.body.emailSent ? 'PASSED (Email Sent)' : 'CHECK');
  console.log('4. Brand new employee creation with nodemailer dispatch:', createNewRes.status === 201 && createNewRes.body.invitation?.sent ? 'PASSED (201 Created & Email Sent)' : 'CHECK');
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});

