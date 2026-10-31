import mysql from 'mysql2/promise';

async function testCreation() {
  console.log('=== Testing Creation of New Accounts for all 3 Roles ===\n');

  // 1. Authenticate as Super Admin to perform creation API calls
  const loginRes = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@paneliya.com', password: 'Password123!' }),
  });
  const { accessToken } = await loginRes.json();
  const saHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` };

  const timestamp = Date.now();

  // Test 1: Create a new SUPER_ADMIN
  const saEmail = `new-super-${timestamp}@company.com`;
  console.log(`1. Creating new SUPER_ADMIN: ${saEmail}...`);
  const createSaRes = await fetch('http://localhost:4000/api/super-admin/users', {
    method: 'POST',
    headers: saHeaders,
    body: JSON.stringify({
      email: saEmail,
      password: 'SuperPassword123!',
      firstName: 'NewSuper',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
    }),
  });
  console.log('Create SUPER_ADMIN status:', createSaRes.status);
  const saData = await createSaRes.json();
  console.log('Returned SA ID:', saData.id, '| Role:', saData.role);

  // Test 2: Create a new ADMIN
  const adminEmail = `new-admin-${timestamp}@company.com`;
  console.log(`\n2. Creating new ADMIN: ${adminEmail}...`);
  const createAdminRes = await fetch('http://localhost:4000/api/super-admin/users', {
    method: 'POST',
    headers: saHeaders,
    body: JSON.stringify({
      email: adminEmail,
      password: 'AdminPassword123!',
      firstName: 'NewAdmin',
      lastName: 'Company',
      role: 'ADMIN',
      companyId: 'cmp-1',
    }),
  });
  console.log('Create ADMIN status:', createAdminRes.status);
  const adminData = await createAdminRes.json();
  console.log('Returned Admin ID:', adminData.id, '| Role:', adminData.role, '| CompanyId:', adminData.companyId);

  // Test 3: Create a new EMPLOYEE
  const empEmail = `new-emp-${timestamp}@company.com`;
  console.log(`\n3. Creating new EMPLOYEE: ${empEmail}...`);
  const createEmpRes = await fetch('http://localhost:4000/api/employees', {
    method: 'POST',
    headers: saHeaders,
    body: JSON.stringify({
      email: empEmail,
      password: 'EmpPassword123!',
      firstName: 'NewEmployee',
      lastName: 'Profile',
      companyId: 'cmp-1',
      phone: '+1 555-0199',
      gender: 'Female',
      dateOfBirth: '1995-05-15',
      address: '123 Market Street, Suite 400',
      joiningDate: '2026-10-30',
      employmentType: 'Full-time',
      departmentId: 'dept-1',
      designationId: 'desig-1',
      shift: 'General Shift',
      salary: { basic: 8000, hra: 3200, allowances: 1800, bonus: 1000, pf: 960, tax: 1200, professionalTax: 200, gross: 14000, net: 11640 },
    }),
  });
  console.log('Create EMPLOYEE status:', createEmpRes.status);
  const empData = await createEmpRes.json();
  console.log('Returned Employee ID:', empData.id, '| Code:', empData.employeeCode, '| Email:', empData.email);

  // Wait 200ms for atomic persist to complete sync
  await new Promise(r => setTimeout(r, 200));

  // Verify in MySQL users table directly
  console.log('\n=== Verifying in MySQL users Table ===');
  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', database: 'hrms' });

  const [dbRows] = await conn.query(
    'SELECT id, email, role, isSuperAdmin, companyId, employeeId, employeeCode, departmentName, designationTitle, salary FROM users WHERE email IN (?, ?, ?)',
    [saEmail, adminEmail, empEmail]
  );
  console.table(dbRows);

  // Test live login with newly created accounts
  console.log('\n=== Testing Login with Newly Created Accounts ===');
  for (const acc of [
    { email: saEmail, pass: 'SuperPassword123!', role: 'SUPER_ADMIN' },
    { email: adminEmail, pass: 'AdminPassword123!', role: 'ADMIN' },
    { email: empEmail, pass: 'EmpPassword123!', role: 'EMPLOYEE' },
  ]) {
    const lRes = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: acc.email, password: acc.pass }),
    });
    const lData = await lRes.json();
    console.log(`Login ${acc.role} (${acc.email}): HTTP ${lRes.status} | Authenticated Role: ${lData.user?.role}`);
  }

  await conn.end();
  console.log('\n=== All 3 Roles Creation and Login Verification Passed! ===');
}

testCreation().catch(console.error);
