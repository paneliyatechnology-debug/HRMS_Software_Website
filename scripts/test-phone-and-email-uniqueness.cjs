const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module.js');
const { AuthService } = require('../dist/modules/auth/auth.service.js');
const { EmployeesService } = require('../dist/modules/employees/employees.service.js');
const { AdminService } = require('../dist/modules/admin/admin.service.js');
const { SuperAdminService } = require('../dist/modules/super-admin/super-admin.service.js');
const { DatabaseService } = require('../dist/database/database.service.js');

async function runAllTests() {
  console.log('=== Initializing NestJS App Context for Uniqueness Testing ===');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const authService = app.get(AuthService);
  const employeesService = app.get(EmployeesService);
  const adminService = app.get(AdminService);
  const superAdminService = app.get(SuperAdminService);
  const db = app.get(DatabaseService);

  const timestamp = Date.now();
  const testPhoneBase = '98251' + String(timestamp).slice(-5); // Unique 10-digit base e.g. 98251xxxxx
  const initialPhone = `+91 ${testPhoneBase.slice(0, 5)} ${testPhoneBase.slice(5)}`;
  const emailA = `test.unique.a.${timestamp}@paneliya.com`;
  const emailB = `test.unique.b.${timestamp}@paneliya.com`;
  const emailC = `test.unique.c.${timestamp}@paneliya.com`;

  console.log(`Test Base Phone: ${initialPhone} (Digits: ${testPhoneBase})`);

  let testPassed = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      testPassed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
    }
  }

  try {
    // 1. Initial valid registration with fresh email and fresh phone
    console.log('\n--- Scenario 1: Initial valid user registration ---');
    const userA = await authService.register({
      email: emailA,
      password: 'Password@123',
      firstName: 'First',
      lastName: 'User',
      phone: initialPhone,
      role: 'EMPLOYEE',
    });
    assert(userA && userA.user && userA.user.email === emailA, 'User A registered successfully');

    // 2. Reject registration when SAME email is used (different phone)
    console.log('\n--- Scenario 2: Same email, different phone ---');
    let emailRejected = false;
    let emailErrorMessage = '';
    try {
      await authService.register({
        email: emailA,
        password: 'Password@123',
        firstName: 'Duplicate',
        lastName: 'Email',
        phone: '+91 91234 56789',
        role: 'EMPLOYEE',
      });
    } catch (err) {
      emailRejected = true;
      emailErrorMessage = err.message || err.response?.message;
    }
    assert(
      emailRejected && emailErrorMessage.includes('This email address is already registered'),
      `Same email rejected with 409 Conflict (${emailErrorMessage})`,
    );

    // 3. Reject registration when DIFFERENT email is used, but SAME phone
    console.log('\n--- Scenario 3: Different email, EXACT same phone ---');
    let phoneRejected1 = false;
    let phoneErrorMessage1 = '';
    try {
      await authService.register({
        email: emailB,
        password: 'Password@123',
        firstName: 'Duplicate',
        lastName: 'Phone',
        phone: initialPhone, // Exact match
        role: 'EMPLOYEE',
      });
    } catch (err) {
      phoneRejected1 = true;
      phoneErrorMessage1 = err.message || err.response?.message;
    }
    assert(
      phoneRejected1 && phoneErrorMessage1.includes('This phone/mobile number is already registered'),
      `Same exact phone rejected with 409 Conflict (${phoneErrorMessage1})`,
    );

    // 4. Reject registration when DIFFERENT email is used, but SAME phone in DIFFERENT format
    // e.g. registered with "+91 98251 12345", attempting with plain "9825112345"
    console.log('\n--- Scenario 4: Different email, same phone with different formatting (plain 10 digits) ---');
    let phoneRejected2 = false;
    let phoneErrorMessage2 = '';
    try {
      await authService.register({
        email: emailB,
        password: 'Password@123',
        firstName: 'Duplicate',
        lastName: 'PhoneFormat',
        phone: testPhoneBase, // Plain 10 digits without +91 or spaces
        role: 'EMPLOYEE',
      });
    } catch (err) {
      phoneRejected2 = true;
      phoneErrorMessage2 = err.message || err.response?.message;
    }
    assert(
      phoneRejected2 && phoneErrorMessage2.includes('This phone/mobile number is already registered'),
      `Different phone format rejected with 409 Conflict (${phoneErrorMessage2})`,
    );

    // 5. Reject across DIFFERENT roles: Attempt to create ADMIN using SuperAdminService with same phone
    console.log('\n--- Scenario 5: Duplicate phone across different roles (EMPLOYEE phone reused for ADMIN) ---');
    let adminRejected = false;
    let adminErrorMessage = '';
    try {
      await superAdminService.createAdmin({
        email: `admin.${timestamp}@company.com`,
        password: 'Password@123',
        firstName: 'Cross',
        lastName: 'RoleAdmin',
        phone: `+91-${testPhoneBase.slice(0, 5)}-${testPhoneBase.slice(5)}`, // Hyphenated format
        companyId: db.companies[0].id,
      });
    } catch (err) {
      adminRejected = true;
      adminErrorMessage = err.message || err.response?.message;
    }
    assert(
      adminRejected && adminErrorMessage.includes('This phone/mobile number is already registered'),
      `Reusing EMPLOYEE phone for ADMIN rejected with 409 Conflict (${adminErrorMessage})`,
    );

    // 6. Reject across DIFFERENT companies
    console.log('\n--- Scenario 6: Duplicate phone across different companies ---');
    let crossCompanyRejected = false;
    let crossCompanyError = '';
    try {
      await employeesService.create(
        {
          email: `worker2.${timestamp}@company2.com`,
          password: 'Password@123',
          firstName: 'Company2',
          lastName: 'Worker',
          phone: `0${testPhoneBase}`, // Leading zero format e.g. 098251xxxxx
        },
        'Admin',
        db.companies.length > 1 ? db.companies[1].id : db.companies[0].id,
      );
    } catch (err) {
      crossCompanyRejected = true;
      crossCompanyError = err.message || err.response?.message;
    }
    assert(
      crossCompanyRejected && crossCompanyError.includes('This phone/mobile number is already registered'),
      `Reusing phone across different companies rejected with 409 Conflict (${crossCompanyError})`,
    );

    // 7. Concurrent simultaneous registrations with same phone
    console.log('\n--- Scenario 7: Concurrent simultaneous registration requests with same phone ---');
    const concurrentPhone = `+91 97777 ${String(timestamp).slice(-5)}`;
    const results = await Promise.allSettled([
      authService.register({
        email: `conc1.${timestamp}@paneliya.com`,
        password: 'Password@123',
        firstName: 'Conc1',
        lastName: 'Test',
        phone: concurrentPhone,
        role: 'EMPLOYEE',
      }),
      authService.register({
        email: `conc2.${timestamp}@paneliya.com`,
        password: 'Password@123',
        firstName: 'Conc2',
        lastName: 'Test',
        phone: concurrentPhone,
        role: 'EMPLOYEE',
      }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    assert(
      fulfilled.length === 1 && rejected.length === 1,
      `Concurrent race condition safely handled: 1 succeeded, 1 rejected with 409 Conflict`,
    );

    // 8. Registering with unique email AND unique phone succeeds
    console.log('\n--- Scenario 8: Registration with fresh email AND fresh phone succeeds ---');
    const freshPhone = `+91 96666 ${String(timestamp).slice(-5)}`;
    const userSuccess = await authService.register({
      email: emailC,
      password: 'Password@123',
      firstName: 'Fresh',
      lastName: 'User',
      phone: freshPhone,
      role: 'EMPLOYEE',
    });
    assert(
      userSuccess && userSuccess.user && userSuccess.user.email === emailC,
      'User with fresh email & unique phone successfully created',
    );

    console.log(`\n=================================================`);
    console.log(`ALL TESTS COMPLETED: ${testPassed}/${totalTests} Passed!`);
    console.log(`=================================================`);
  } catch (err) {
    console.error('Unexpected test failure:', err);
  } finally {
    await app.close();
  }
}

runAllTests();
