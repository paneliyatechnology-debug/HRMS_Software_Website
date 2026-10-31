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

async function run() {
  console.log('='.repeat(80));
  console.log(' COMPANY REGISTRATION & SUPER ADMIN APPROVAL WORKFLOW TEST');
  console.log('='.repeat(80));

  const suffix = Date.now();
  const testPayload = {
    companyLegalName: `Paneliya Infotech Pvt Ltd ${suffix}`,
    gstin: '24AAAAA0000A1Z5',
    industrySector: 'Information Technology & Software',
    officeAddress: '402, Ring Road',
    city: 'Surat',
    state: 'Gujarat',
    firstName: 'Ravi',
    lastName: 'Paneliya',
    officialEmail: `ravi.paneliya.${suffix}@gmail.com`,
    mobileNumber: `98765${String(suffix).slice(-5)}`,
    password: 'OwnerPassword@123',
    confirmPassword: 'OwnerPassword@123',
  };

  console.log('\n--- Step 1: Public Registration Submission (NO TOKEN) ---');
  const regRes = await request('POST', '/companies/register', testPayload);
  console.log('Registration Status:', regRes.status);
  console.log('Response Message:', regRes.data.message);
  console.log('Request ID:', regRes.data.requestId);
  console.log('Status in DB:', regRes.data.status);

  if (regRes.status !== 201 || regRes.data.status !== 'PENDING') {
    console.error('FAIL: Registration request was not created as PENDING!');
    process.exit(1);
  }

  const requestId = regRes.data.requestId;

  console.log('\n--- Step 2: Attempt Login BEFORE Approval (Should Fail) ---');
  const prematureLogin = await request('POST', '/auth/login', {
    identifier: testPayload.officialEmail,
    password: testPayload.password,
  });
  console.log('Premature Login Status (Expected 401):', prematureLogin.status);
  if (prematureLogin.status === 200 || prematureLogin.status === 201) {
    console.error('FAIL: User was able to login before Super Admin approval!');
    process.exit(1);
  }
  console.log('[PASS] Owner cannot login before approval.');

  console.log('\n--- Step 3: Super Admin Login (paneliya@gmail.com) ---');
  const saLogin = await request('POST', '/auth/login', {
    identifier: 'paneliya@gmail.com',
    password: 'Paneliya@123',
  });
  console.log('Super Admin Login Status:', saLogin.status);
  if (saLogin.status !== 200 && saLogin.status !== 201) {
    console.error('FAIL: Super Admin login failed!', saLogin.data);
    process.exit(1);
  }
  const saToken = saLogin.data.requestToken || saLogin.data.accessToken;
  console.log('[PASS] Super Admin authenticated successfully.');

  console.log('\n--- Step 4: Super Admin Lists Pending Requests ---');
  const listRes = await request('GET', '/super-admin/company-requests?status=PENDING', null, {
    Authorization: `Bearer ${saToken}`,
  });
  console.log('Pending Requests Count:', listRes.data.length);
  const found = listRes.data.find((r) => r.id === requestId);
  if (!found) {
    console.error('FAIL: Submitted request not found in pending list!');
    process.exit(1);
  }
  console.log('[PASS] Found pending request for:', found.companyLegalName);

  console.log('\n--- Step 5: Super Admin Approves Company Request ---');
  const approveRes = await request(
    'POST',
    `/super-admin/company-requests/${requestId}/approve`,
    {},
    { Authorization: `Bearer ${saToken}` }
  );
  console.log('Approval Status:', approveRes.status);
  console.log('Company Code Assigned:', approveRes.data.company?.companyCode);
  console.log('Company Name:', approveRes.data.company?.companyName);
  console.log('Admin User Created:', approveRes.data.adminUser?.email);

  if (approveRes.status !== 200 && approveRes.status !== 201) {
    console.error('FAIL: Approval failed!', approveRes.data);
    process.exit(1);
  }
  console.log('[PASS] Company approved and created successfully!');

  console.log('\n--- Step 6: Owner Logs in AFTER Approval ---');
  const ownerLogin = await request('POST', '/auth/login', {
    identifier: testPayload.officialEmail,
    password: testPayload.password,
  });
  console.log('Owner Login Status:', ownerLogin.status);
  console.log('Owner Role:', ownerLogin.data.user?.role);
  console.log('Owner Company Code:', ownerLogin.data.user?.companyCode);
  console.log('Request Token Received:', !!ownerLogin.data.requestToken);
  console.log('Refresh Token Received:', !!ownerLogin.data.refreshToken);

  if (ownerLogin.status !== 200 && ownerLogin.status !== 201) {
    console.error('FAIL: Owner could not login after approval!', ownerLogin.data);
    process.exit(1);
  }
  console.log('[PASS] Owner logged in successfully!');

  console.log('\n--- Step 7: Owner calls /api/auth/me with requestToken ---');
  const meRes = await request('GET', '/auth/me', null, {
    Authorization: `Bearer ${ownerLogin.data.requestToken}`,
  });
  console.log('Owner /auth/me Status:', meRes.status);
  console.log('Owner Email:', meRes.data.email);
  console.log('Owner Company ID:', meRes.data.companyId);

  if (meRes.status !== 200) {
    console.error('FAIL: Owner /auth/me failed!', meRes.data);
    process.exit(1);
  }
  console.log('[PASS] Owner verified with requestToken.');

  console.log('\n' + '='.repeat(80));
  console.log(' [SUCCESS] ALL 7 STEPS PASSED PERFECTLY!');
  console.log('='.repeat(80));
}

run().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
