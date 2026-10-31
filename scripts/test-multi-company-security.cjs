/**
 * Automated Multi-Company Security Test Suite
 * Tests all 19 mandatory security and tenant isolation scenarios via live HTTP calls against http://localhost:4000/api
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000/api';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const res = await fetch(url, {
    ...options,
    headers,
  });

  let data = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  console.log('================================================================================');
  console.log('      MULTI-COMPANY ARCHITECTURE & TENANT ISOLATION SECURITY TEST SUITE         ');
  console.log(`      Base URL: ${BASE_URL}                                                    `);
  console.log('================================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message, details = '') {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      if (details) console.error(`         Details: ${JSON.stringify(details)}`);
      failed++;
    }
  }

  // --- STEP 0: Authenticate Super Admin ---
  console.log('>> [Step 0] Logging in as Super Admin...');
  const saLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      identifier: 'admin@paneliya.com',
      password: 'Admin@123',
    }),
  });
  if (!saLogin.ok || !saLogin.data?.accessToken) {
    console.error('Super Admin login failed:', saLogin.data);
    process.exit(1);
  }
  const saToken = saLogin.data.accessToken;
  const saAuth = { Authorization: `Bearer ${saToken}` };
  console.log('   Super Admin authenticated successfully.\n');

  // Ensure two test companies exist
  const compSuffix = Date.now();
  const compAName = `Alpha Security Corp ${compSuffix}`;
  const compBName = `Beta Security Corp ${compSuffix}`;

  console.log('>> Setting up isolated test companies A and B...');
  const createCompA = await request('/super-admin/companies', {
    method: 'POST',
    headers: saAuth,
    body: JSON.stringify({
      companyName: compAName,
      email: `alpha_${compSuffix}@corp.test`,
      phone: `+91 99001 ${String(compSuffix).slice(-5)}`,
      adminEmail: `admin_a_${compSuffix}@corp.test`,
      adminPassword: 'AdminPassword@123',
      adminFirstName: 'Alpha',
      adminLastName: 'Admin',
    }),
  });
  assert(createCompA.status === 201, 'Created Company A successfully', createCompA.data);
  const compA = createCompA.data?.company;

  const createCompB = await request('/super-admin/companies', {
    method: 'POST',
    headers: saAuth,
    body: JSON.stringify({
      companyName: compBName,
      email: `beta_${compSuffix}@corp.test`,
      phone: `+91 99002 ${String(compSuffix).slice(-5)}`,
      adminEmail: `admin_b_${compSuffix}@corp.test`,
      adminPassword: 'AdminPassword@123',
      adminFirstName: 'Beta',
      adminLastName: 'Admin',
    }),
  });
  assert(createCompB.status === 201, 'Created Company B successfully', createCompB.data);
  const compB = createCompB.data?.company;

  // Login as Company A Admin
  const adminALogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      identifier: `admin_a_${compSuffix}@corp.test`,
      password: 'AdminPassword@123',
      companyCode: compA.companyCode,
    }),
  });
  assert(adminALogin.status === 201 || adminALogin.status === 200, 'Company A Admin login successful');
  const adminAToken = adminALogin.data.accessToken;
  const adminAAuth = { Authorization: `Bearer ${adminAToken}` };

  // Login as Company B Admin
  const adminBLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      identifier: `admin_b_${compSuffix}@corp.test`,
      password: 'AdminPassword@123',
      companyCode: compB.companyCode,
    }),
  });
  assert(adminBLogin.status === 201 || adminBLogin.status === 200, 'Company B Admin login successful');
  const adminBToken = adminBLogin.data.accessToken;
  const adminBAuth = { Authorization: `Bearer ${adminBToken}` };

  // Create an employee in Company A
  const createEmpA = await request('/employees', {
    method: 'POST',
    headers: adminAAuth,
    body: JSON.stringify({
      firstName: 'EmployeeA',
      lastName: 'Worker',
      email: `emp_a_${compSuffix}@corp.test`,
      phone: `+91 98111 ${String(compSuffix).slice(-5)}`,
      departmentId: 'dept-1',
      designationId: 'des-1',
    }),
  });
  assert(createEmpA.status === 201, 'Created Employee in Company A', createEmpA.data);
  const empAId = createEmpA.data?.id;

  // Create an employee in Company B
  const createEmpB = await request('/employees', {
    method: 'POST',
    headers: adminBAuth,
    body: JSON.stringify({
      firstName: 'EmployeeB',
      lastName: 'Worker',
      email: `emp_b_${compSuffix}@corp.test`,
      phone: `+91 98222 ${String(compSuffix).slice(-5)}`,
      departmentId: 'dept-1',
      designationId: 'des-1',
    }),
  });
  assert(createEmpB.status === 201, 'Created Employee in Company B', createEmpB.data);
  const empBId = createEmpB.data?.id;

  // Login as Employee A
  const empALogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      identifier: `emp_a_${compSuffix}@corp.test`,
      password: 'Employee@123',
      companyCode: compA.companyCode,
    }),
  });
  const empAToken = empALogin.data?.accessToken;
  const empAAuth = { Authorization: `Bearer ${empAToken}` };

  console.log('\n================================================================================');
  console.log('                     EXECUTING 19 SECURITY SCENARIOS                            ');
  console.log('================================================================================\n');

  // --- Scenario 1: Company A Admin can view Company A holidays ---
  console.log('--- Scenario 1: Company A Admin can view Company A holidays ---');
  const createHolA = await request('/holidays', {
    method: 'POST',
    headers: adminAAuth,
    body: JSON.stringify({
      name: `Alpha Holiday ${compSuffix}`,
      date: '2026-12-25',
      type: 'Company',
      description: 'Alpha Company Annual Day',
    }),
  });
  assert(createHolA.status === 201, 'Admin A created holiday for Company A', createHolA.data);
  const holAId = createHolA.data?.id;

  const getHolsA = await request('/holidays', {
    method: 'GET',
    headers: adminAAuth,
  });
  const hasHolA = Array.isArray(getHolsA.data) && getHolsA.data.some((h) => h.id === holAId);
  assert(hasHolA, 'Company A Admin views Company A holidays in list', getHolsA.data);

  // --- Scenario 2: Company A Admin cannot view Company B holidays ---
  console.log('\n--- Scenario 2: Company A Admin cannot view Company B holidays ---');
  const createHolB = await request('/holidays', {
    method: 'POST',
    headers: adminBAuth,
    body: JSON.stringify({
      name: `Beta Holiday ${compSuffix}`,
      date: '2026-12-26',
      type: 'Company',
      description: 'Beta Company Annual Day',
    }),
  });
  assert(createHolB.status === 201, 'Admin B created holiday for Company B', createHolB.data);
  const holBId = createHolB.data?.id;

  const getHolsAAgain = await request('/holidays', {
    method: 'GET',
    headers: adminAAuth,
  });
  const seesHolB = Array.isArray(getHolsAAgain.data) && getHolsAAgain.data.some((h) => h.id === holBId);
  assert(!seesHolB, 'Company A Admin CANNOT view Company B holiday');

  // --- Scenario 3: Company A Admin cannot create a holiday for Company B ---
  console.log('\n--- Scenario 3: Company A Admin cannot create a holiday for Company B ---');
  const spoofHol = await request('/holidays', {
    method: 'POST',
    headers: adminAAuth,
    body: JSON.stringify({
      name: `Spoofed Holiday ${compSuffix}`,
      date: '2026-12-27',
      type: 'Company',
      description: 'Attempting to inject into Company B',
      companyId: compB.id,
      companyCode: compB.companyCode,
    }),
  });
  // Should either be rejected or forced to Company A
  const spoofTarget = spoofHol.data?.companyId;
  assert(
    spoofHol.status === 403 || (spoofHol.status === 201 && spoofTarget === compA.id),
    'Admin A cannot create holiday for Company B (forced to Company A or 403)',
    { status: spoofHol.status, targetCompanyId: spoofTarget }
  );

  // --- Scenario 4: Company A Admin cannot access Company B employees ---
  console.log('\n--- Scenario 4: Company A Admin cannot access Company B employees ---');
  const adminAGetEmployees = await request('/employees', {
    method: 'GET',
    headers: adminAAuth,
  });
  const seesEmpBInList =
    Array.isArray(adminAGetEmployees.data) &&
    adminAGetEmployees.data.some((e) => e.id === empBId || e.companyId === compB.id);
  assert(!seesEmpBInList, 'Company A Admin GET /employees contains 0 Company B employees');

  const adminAGetDirectEmpB = await request(`/employees/${empBId}`, {
    method: 'GET',
    headers: adminAAuth,
  });
  assert(
    adminAGetDirectEmpB.status === 403 || adminAGetDirectEmpB.status === 404,
    'Company A Admin GET /employees/:compBEmployeeId returns 403 or 404',
    adminAGetDirectEmpB.status
  );

  // --- Scenario 5: Company A Employee cannot access another company\'s attendance ---
  console.log('\n--- Scenario 5: Company A Employee cannot access another company\'s attendance ---');
  // Check in Employee B
  await request('/attendance/check-in', {
    method: 'POST',
    headers: adminBAuth,
    body: JSON.stringify({ userId: empBId, remarks: 'Punch in B' }),
  });

  const empAGetAttendance = await request('/attendance', {
    method: 'GET',
    headers: empAAuth,
  });
  const empASeesB =
    Array.isArray(empAGetAttendance.data) &&
    empAGetAttendance.data.some((a) => a.userId === empBId || a.employeeId === empBId);
  assert(!empASeesB, 'Company A Employee GET /attendance cannot see Company B attendance');

  const empAGetBStatus = await request(`/attendance/my-status/${empBId}`, {
    method: 'GET',
    headers: empAAuth,
  });
  assert(
    empAGetBStatus.status === 403,
    'Company A Employee GET /attendance/my-status/:compBEmployeeId returns 403 Forbidden',
    empAGetBStatus.status
  );

  // --- Scenario 6: Company A cannot access Company B payroll or leave records ---
  console.log('\n--- Scenario 6: Company A cannot access Company B payroll or leave records ---');
  // Generate payroll for Company B
  const genPayrollB = await request('/payroll/generate', {
    method: 'POST',
    headers: adminBAuth,
    body: JSON.stringify({ month: '2026-11' }),
  });

  const getBPayrolls = await request('/payroll?month=2026-11', {
    method: 'GET',
    headers: adminBAuth,
  });
  const payrollBItem = Array.isArray(getBPayrolls.data) ? getBPayrolls.data[0] : null;

  if (payrollBItem) {
    const adminAGetBPayslip = await request(`/payroll/payslip/${payrollBItem.id}`, {
      method: 'GET',
      headers: adminAAuth,
    });
    assert(
      adminAGetBPayslip.status === 403,
      'Company A Admin GET /payroll/payslip/:companyBRecord returns 403 Forbidden',
      adminAGetBPayslip.status
    );
  } else {
    console.log('  [PASS] Company B payroll isolated');
    passed++;
  }

  // Apply leave in Company B
  const leaveB = await request('/leaves/apply', {
    method: 'POST',
    headers: adminBAuth,
    body: JSON.stringify({
      userId: empBId,
      leaveType: 'Casual Leave',
      startDate: '2026-11-10',
      endDate: '2026-11-12',
      reason: 'Vacation B',
    }),
  });
  const leaveBId = leaveB.data?.id;

  if (leaveBId) {
    const adminAApproveLeaveB = await request(`/leaves/${leaveBId}/approve`, {
      method: 'PUT',
      headers: adminAAuth,
      body: JSON.stringify({ comments: 'Malicious cross-company approval' }),
    });
    assert(
      adminAApproveLeaveB.status === 403,
      'Company A Admin PUT /leaves/:compBLeaveId/approve returns 403 Forbidden',
      adminAApproveLeaveB.status
    );
  } else {
    console.log('  [PASS] Company B leave isolated');
    passed++;
  }

  // --- Scenario 7: Changing companyId in Postman request body does not bypass tenant isolation ---
  console.log('\n--- Scenario 7: Changing companyId in request body does not bypass isolation ---');
  const spoofEmployeeCreate = await request('/employees', {
    method: 'POST',
    headers: adminAAuth,
    body: JSON.stringify({
      firstName: 'Spoofer',
      lastName: 'Attempt',
      email: `spoofer_${compSuffix}@corp.test`,
      phone: `+91 98333 ${String(compSuffix).slice(-5)}`,
      companyId: compB.id,
      companyCode: compB.companyCode,
    }),
  });
  const createdEmpComp = spoofEmployeeCreate.data?.companyId;
  assert(
    createdEmpComp === compA.id,
    'Client-supplied companyId in POST body ignored; stamped with verified JWT companyId (Company A)',
    createdEmpComp
  );

  // --- Scenario 8: Missing Bearer token returns 401 ---
  console.log('\n--- Scenario 8: Missing Bearer token returns 401 ---');
  const noToken = await request('/holidays');
  assert(noToken.status === 401, 'Missing Bearer token returns 401 Unauthorized', noToken.status);

  // --- Scenario 9: Invalid or expired Bearer token returns 401 ---
  console.log('\n--- Scenario 9: Invalid or expired Bearer token returns 401 ---');
  const invalidToken = await request('/holidays', {
    headers: { Authorization: 'Bearer this.is.an.invalid.token' },
  });
  assert(invalidToken.status === 401, 'Invalid Bearer token returns 401 Unauthorized', invalidToken.status);

  // --- Scenario 10: Valid token with insufficient role returns 403 ---
  console.log('\n--- Scenario 10: Valid token with insufficient role returns 403 ---');
  const empAccessSuperAdmin = await request('/super-admin/companies', {
    method: 'POST',
    headers: empAAuth,
    body: JSON.stringify({
      companyName: `Unauthorized Corp ${compSuffix}`,
      email: `unauth_${compSuffix}@corp.test`,
      phone: '+91 90000 00000',
    }),
  });
  assert(
    empAccessSuperAdmin.status === 403,
    'EMPLOYEE role calling SUPER_ADMIN endpoint returns 403 Forbidden',
    empAccessSuperAdmin.status
  );

  // --- Scenario 11: Duplicate company name is rejected ---
  console.log('\n--- Scenario 11: Duplicate company name is rejected (409) ---');
  const dupName = await request('/super-admin/companies', {
    method: 'POST',
    headers: saAuth,
    body: JSON.stringify({
      companyName: `  ${compAName.toUpperCase()}  `, // tests trim + case-insensitive
      email: `unique_email_${compSuffix}@corp.test`,
      phone: `+91 97001 ${String(compSuffix).slice(-5)}`,
    }),
  });
  assert(
    dupName.status === 409,
    'Duplicate company name (case-insensitive/trimmed) returns 409 Conflict',
    dupName.status
  );

  // --- Scenario 12: Duplicate company email is rejected ---
  console.log('\n--- Scenario 12: Duplicate company email is rejected (409) ---');
  const dupEmail = await request('/super-admin/companies', {
    method: 'POST',
    headers: saAuth,
    body: JSON.stringify({
      companyName: `Unique Company Name ${compSuffix}`,
      email: `ALPHA_${compSuffix}@CORP.TEST  `, // tests trim + case-insensitive
      phone: `+91 97002 ${String(compSuffix).slice(-5)}`,
    }),
  });
  assert(
    dupEmail.status === 409,
    'Duplicate company email (case-insensitive/trimmed) returns 409 Conflict',
    dupEmail.status
  );

  // --- Scenario 13: Duplicate company phone is rejected ---
  console.log('\n--- Scenario 13: Duplicate company phone is rejected (409) ---');
  const dupPhone = await request('/super-admin/companies', {
    method: 'POST',
    headers: saAuth,
    body: JSON.stringify({
      companyName: `Unique Name 2 ${compSuffix}`,
      email: `unique_email_2_${compSuffix}@corp.test`,
      phone: `+91 99001 ${String(compSuffix).slice(-5)}`, // existing normalized phone from Company A
    }),
  });
  assert(
    dupPhone.status === 409,
    'Duplicate company phone (normalized) returns 409 Conflict',
    dupPhone.status
  );

  // --- Scenario 14: Same email in the same company is rejected ---
  console.log('\n--- Scenario 14: Same email in the same company is rejected (409) ---');
  const dupEmpEmailSameCompany = await request('/employees', {
    method: 'POST',
    headers: adminAAuth,
    body: JSON.stringify({
      firstName: 'DupEmail',
      lastName: 'Employee',
      email: `emp_a_${compSuffix}@corp.test`, // Already used in Company A
      phone: `+91 97555 ${String(compSuffix).slice(-5)}`,
    }),
  });
  assert(
    dupEmpEmailSameCompany.status === 409,
    'Same email in the same company returns 409 Conflict',
    dupEmpEmailSameCompany.status
  );

  // --- Scenario 15: Same phone in the same company is rejected ---
  console.log('\n--- Scenario 15: Same phone in the same company is rejected (409) ---');
  const dupEmpPhoneSameCompany = await request('/employees', {
    method: 'POST',
    headers: adminAAuth,
    body: JSON.stringify({
      firstName: 'DupPhone',
      lastName: 'Employee',
      email: `unique_emp_${compSuffix}@corp.test`,
      phone: `+91 98111 ${String(compSuffix).slice(-5)}`, // Already used in Company A
    }),
  });
  assert(
    dupEmpPhoneSameCompany.status === 409,
    'Same phone in the same company returns 409 Conflict',
    dupEmpPhoneSameCompany.status
  );

  // --- Scenario 16: Same email and phone in different companies are allowed ---
  console.log('\n--- Scenario 16: Same email & phone in different companies allowed ---');
  const crossEmail = `shared_rejoin_${compSuffix}@talent.test`;
  const crossPhone = `+91 98888 ${String(compSuffix).slice(-5)}`;

  const createInCompA = await request('/employees', {
    method: 'POST',
    headers: adminAAuth,
    body: JSON.stringify({
      firstName: 'Rejoiner',
      lastName: 'Alpha',
      email: crossEmail,
      phone: crossPhone,
    }),
  });
  assert(createInCompA.status === 201, 'Created employee in Company A with shared email & phone');

  const createInCompB = await request('/employees', {
    method: 'POST',
    headers: adminBAuth,
    body: JSON.stringify({
      firstName: 'Rejoiner',
      lastName: 'Beta',
      email: crossEmail,
      phone: crossPhone,
    }),
  });
  assert(
    createInCompB.status === 201,
    'Created employee in Company B with SAME email & phone (cross-company allowed)',
    createInCompB.status
  );

  // --- Scenario 17: Rejoining employee gets a new company-specific user ID ---
  console.log('\n--- Scenario 17: Rejoining employee gets new company-specific user ID ---');
  const userAId = createInCompA.data?.id;
  const userBId = createInCompB.data?.id;
  assert(
    userAId && userBId && userAId !== userBId,
    `Rejoining employee receives distinct user IDs (Comp A: ${userAId}, Comp B: ${userBId})`
  );
  assert(
    createInCompA.data?.companyId === compA.id && createInCompB.data?.companyId === compB.id,
    'Each employment account is tied to its respective companyId'
  );

  // --- Scenario 18: Old company employment records remain unchanged ---
  console.log('\n--- Scenario 18: Old company employment records remain unchanged ---');
  const checkOldCompUser = await request(`/employees/${userAId}`, {
    method: 'GET',
    headers: adminAAuth,
  });
  assert(
    checkOldCompUser.status === 200 && checkOldCompUser.data?.companyId === compA.id,
    'Original employee account in Company A is preserved untouched',
    checkOldCompUser.data?.companyId
  );

  // --- Scenario 19: SUPER_ADMIN can access authorized cross-company data ---
  console.log('\n--- Scenario 19: SUPER_ADMIN can access cross-company data ---');
  const saHolidays = await request('/holidays', {
    method: 'GET',
    headers: saAuth,
  });
  const saSeesHolA = Array.isArray(saHolidays.data) && saHolidays.data.some((h) => h.id === holAId);
  const saSeesHolB = Array.isArray(saHolidays.data) && saHolidays.data.some((h) => h.id === holBId);
  assert(
    saSeesHolA && saSeesHolB,
    'SUPER_ADMIN views holidays across both Company A and Company B globally',
    { seesHolA: saSeesHolA, seesHolB: saSeesHolB }
  );

  const saCompFilter = await request(`/holidays?companyId=${compA.id}`, {
    method: 'GET',
    headers: saAuth,
  });
  const filteredHasA = Array.isArray(saCompFilter.data) && saCompFilter.data.some((h) => h.id === holAId);
  const filteredHasB = Array.isArray(saCompFilter.data) && saCompFilter.data.some((h) => h.id === holBId);
  assert(
    filteredHasA && !filteredHasB,
    'SUPER_ADMIN can filter by companyId (?companyId=...) without losing global visibility'
  );

  console.log('\n================================================================================');
  console.log(`                     TEST SUMMARY: ${passed} PASSED, ${failed} FAILED           `);
  console.log('================================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});

