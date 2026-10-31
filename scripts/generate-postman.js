import fs from 'fs';
import path from 'path';

async function generate() {
  const port = process.env.PORT || 4000;
  const host = process.env.DOCS_HOST || '127.0.0.1';
  const res = await fetch(`http://${host}:${port}/api/docs-json`);
  const spec = await res.json();

  const collection = {
    info: {
      _postman_id: 'a9b8c7d6-e5f4-4321-b123-9876543210ab',
      name: 'Paneliya Enterprise HRMS API',
      description:
        'Professional Postman collection for Paneliya Multi-Company HRMS Backend API.\n\n' +
        '### Roles Hierarchy:\n' +
        '- **SUPER_ADMIN**: Platform software owner, manages companies, assigns admins, cross-company reporting\n' +
        '- **ADMIN**: Company administrator, strictly isolated to own company, creates/manages company employees\n' +
        '- **EMPLOYEE**: Company employee, read-only permissions for organizational data\n\n' +
        '### Getting Started:\n' +
        '1. Run request **"1. Super Admin Login"** in the **"⭐ 0. Multi-Company Walkthrough"** folder.\n' +
        '2. The login test script will automatically save the `token` variable.\n' +
        '3. All subsequent requests in this collection automatically inherit the `{{token}}` bearer token.',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    auth: {
      type: 'bearer',
      bearer: [
        {
          key: 'token',
          value: '{{token}}',
          type: 'string',
        },
      ],
    },
    variable: [
      {
        key: 'baseUrl',
        value: process.env.API_BASE_URL || `http://${host}:${port}/api`,
        type: 'string',
      },
      {
        key: 'token',
        value: '',
        type: 'string',
      },
      {
        key: 'companyId',
        value: '',
        type: 'string',
      },
      {
        key: 'companyCode',
        value: '',
        type: 'string',
      },
      {
        key: 'adminToken',
        value: '',
        type: 'string',
      },
      {
        key: 'employeeToken',
        value: '',
        type: 'string',
      },
    ],
    item: [],
  };

  // ─────────────────────────────────────────────────────────────────
  // Special Walkthrough Folder (Ready to Run Sequence)
  // ─────────────────────────────────────────────────────────────────
  const walkthroughFolder = {
    name: '⭐ 0. Multi-Company Walkthrough (Step-by-Step Flow)',
    description:
      'Run these 10 requests in sequence to verify complete Multi-Company architecture, token authentication, code generation, and cross-company isolation.',
    item: [
      {
        name: 'Step 1: Super Admin Login (Auto-saves {{token}})',
        event: [
          {
            listen: 'test',
            script: {
              exec: [
                'var jsonData = pm.response.json();',
                'if (jsonData.accessToken) {',
                '    pm.collectionVariables.set("token", jsonData.accessToken);',
                '    pm.environment.set("token", jsonData.accessToken);',
                '    console.log("Super Admin Token Saved:", jsonData.accessToken);',
                '}',
                'pm.test("Status is 200/201", function () {',
                '    pm.expect(pm.response.code).to.be.oneOf([200, 201]);',
                '});',
              ],
              type: 'text/javascript',
            },
          },
        ],
        request: {
          auth: { type: 'noauth' },
          method: 'POST',
          header: [{ key: 'Content-Type', value: 'application/json' }],
          body: {
            mode: 'raw',
            raw: JSON.stringify(
              {
                email: 'superadmin@paneliya.com',
                password: 'Admin@123',
              },
              null,
              2,
            ),
          },
          url: {
            raw: '{{baseUrl}}/auth/login',
            host: ['{{baseUrl}}'],
            path: ['auth', 'login'],
          },
          description: 'Login with platform Super Admin credentials.',
        },
      },
      {
        name: 'Step 2: Super Admin - List All Companies',
        request: {
          method: 'GET',
          header: [{ key: 'Accept', value: 'application/json' }],
          url: {
            raw: '{{baseUrl}}/super-admin/companies',
            host: ['{{baseUrl}}'],
            path: ['super-admin', 'companies'],
          },
          description: 'Lists all companies currently registered on the platform.',
        },
      },
      {
        name: 'Step 3: Super Admin - Create Company (Auto-saves {{companyId}} & CMP-Code)',
        event: [
          {
            listen: 'test',
            script: {
              exec: [
                'var jsonData = pm.response.json();',
                'if (jsonData.company) {',
                '    pm.collectionVariables.set("companyId", jsonData.company.id);',
                '    pm.collectionVariables.set("companyCode", jsonData.company.companyCode);',
                '    pm.environment.set("companyId", jsonData.company.id);',
                '    pm.environment.set("companyCode", jsonData.company.companyCode);',
                '    console.log("Created Company Code:", jsonData.company.companyCode);',
                '}',
                'pm.test("Status code is 201", function () {',
                '    pm.response.to.have.status(201);',
                '});',
              ],
              type: 'text/javascript',
            },
          },
        ],
        request: {
          method: 'POST',
          header: [{ key: 'Content-Type', value: 'application/json' }],
          body: {
            mode: 'raw',
            raw: JSON.stringify(
              {
                companyName: 'ABC Technologies Pvt Ltd',
                email: 'contact@abctechnologies.com',
                phone: '+91 98765 43210',
                address: 'Ring Road, Surat, Gujarat, India',
                status: 'Active',
              },
              null,
              2,
            ),
          },
          url: {
            raw: '{{baseUrl}}/super-admin/companies',
            host: ['{{baseUrl}}'],
            path: ['super-admin', 'companies'],
          },
          description:
            'Super Admin registers a new company. The backend automatically generates a unique Company Code (e.g. CMP-000002).',
        },
      },
      {
        name: 'Step 4: Super Admin - Create Admin for Company',
        request: {
          method: 'POST',
          header: [{ key: 'Content-Type', value: 'application/json' }],
          body: {
            mode: 'raw',
            raw: JSON.stringify(
              {
                email: 'admin.abctech@gmail.com',
                password: 'AdminPassword@123',
                firstName: 'Ravi',
                lastName: 'Admin',
                role: 'ADMIN',
                companyId: '{{companyId}}',
                status: 'Active',
              },
              null,
              2,
            ),
          },
          url: {
            raw: '{{baseUrl}}/super-admin/users',
            host: ['{{baseUrl}}'],
            path: ['super-admin', 'users'],
          },
          description: 'Super Admin provisions a company administrator linked to the newly created company.',
        },
      },
      {
        name: 'Step 5: Login as Company Admin (Auto-saves {{token}} as Admin)',
        event: [
          {
            listen: 'test',
            script: {
              exec: [
                'var jsonData = pm.response.json();',
                'if (jsonData.accessToken) {',
                '    pm.collectionVariables.set("token", jsonData.accessToken);',
                '    pm.collectionVariables.set("adminToken", jsonData.accessToken);',
                '    pm.environment.set("token", jsonData.accessToken);',
                '    pm.environment.set("adminToken", jsonData.accessToken);',
                '    console.log("Logged in as Company Admin:", jsonData.user.email);',
                '}',
                'pm.test("Admin Login Successful", function () {',
                '    pm.expect(jsonData.user.role).to.eql("ADMIN");',
                '});',
              ],
              type: 'text/javascript',
            },
          },
        ],
        request: {
          auth: { type: 'noauth' },
          method: 'POST',
          header: [{ key: 'Content-Type', value: 'application/json' }],
          body: {
            mode: 'raw',
            raw: JSON.stringify(
              {
                email: 'admin.abctech@gmail.com',
                password: 'AdminPassword@123',
              },
              null,
              2,
            ),
          },
          url: {
            raw: '{{baseUrl}}/auth/login',
            host: ['{{baseUrl}}'],
            path: ['auth', 'login'],
          },
          description: 'Login as the newly assigned company administrator.',
        },
      },
      {
        name: 'Step 6: Company Admin - Get Next Employee Code (Scoped)',
        request: {
          method: 'GET',
          header: [{ key: 'Accept', value: 'application/json' }],
          url: {
            raw: '{{baseUrl}}/employees/next-code',
            host: ['{{baseUrl}}'],
            path: ['employees', 'next-code'],
          },
          description:
            'Retrieves the next auto-generated sequential Employee Code scoped to this Admin company (e.g. EMP-000001 or EMP-000002).',
        },
      },
      {
        name: 'Step 7: Company Admin - Create Employee for Company',
        request: {
          method: 'POST',
          header: [{ key: 'Content-Type', value: 'application/json' }],
          body: {
            mode: 'raw',
            raw: JSON.stringify(
              {
                firstName: 'Amit',
                lastName: 'Shah',
                email: 'amit.shah@abctech.com',
                password: 'Employee@123',
                phone: '+91 99887 76655',
                employmentType: 'Full-time',
                status: 'Active',
              },
              null,
              2,
            ),
          },
          url: {
            raw: '{{baseUrl}}/employees',
            host: ['{{baseUrl}}'],
            path: ['employees'],
          },
          description:
            'Company Admin creates an employee. The backend automatically associates the employee with this Admin company and generates the scoped Employee Code.',
        },
      },
      {
        name: 'Step 8: Company Admin - List Company Employees (Isolated)',
        request: {
          method: 'GET',
          header: [{ key: 'Accept', value: 'application/json' }],
          url: {
            raw: '{{baseUrl}}/employees',
            host: ['{{baseUrl}}'],
            path: ['employees'],
          },
          description:
            'Retrieves employee directory. Returns only employees belonging to this Admin company (Zero cross-company data leakage).',
        },
      },
      {
        name: 'Step 9: Company Admin - View Own Company Details',
        request: {
          method: 'GET',
          header: [{ key: 'Accept', value: 'application/json' }],
          url: {
            raw: '{{baseUrl}}/companies/my-company',
            host: ['{{baseUrl}}'],
            path: ['companies', 'my-company'],
          },
          description: 'Returns profile details for the authenticated user assigned company.',
        },
      },
      {
        name: 'Step 10: Cross-Company Access Denied Test (Should return 403)',
        event: [
          {
            listen: 'test',
            script: {
              exec: [
                'pm.test("Expect 403 Forbidden on Cross-Company Access", function () {',
                '    pm.response.to.have.status(403);',
                '});',
              ],
              type: 'text/javascript',
            },
          },
        ],
        request: {
          method: 'GET',
          header: [{ key: 'Accept', value: 'application/json' }],
          url: {
            raw: '{{baseUrl}}/employees/user-1793009147556',
            host: ['{{baseUrl}}'],
            path: ['employees', 'user-1793009147556'],
          },
          description:
            'Attempts to access an employee record from Company A while authenticated as Admin of Company B. Verified to reject with 403 Forbidden.',
        },
      },
    ],
  };

  collection.item.push(walkthroughFolder);

  // ─────────────────────────────────────────────────────────────────
  // Tag-Based Module Organization
  // ─────────────────────────────────────────────────────────────────
  const tagGroups = new Map();

  for (const tag of spec.tags || []) {
    tagGroups.set(tag.name, {
      name: tag.name,
      description: tag.description || '',
      item: [],
    });
  }

  // Pre-configured JSON request bodies for clean, ready-to-test execution
  const sampleBodies = {
    'post_/api/auth/register': {
      email: 'new.employee@paneliya.com',
      password: 'SecurePassword@123',
      firstName: 'Ramesh',
      lastName: 'Patel',
      role: 'EMPLOYEE',
      phone: '+1 (555) 789-0123',
    },
    'post_/api/auth/login': {
      email: 'superadmin@paneliya.com',
      password: 'Admin@123',
    },
    'post_/api/auth/switch-role': {
      role: 'SUPER_ADMIN',
    },
    'post_/api/super-admin/companies': {
      companyName: 'ABC Technologies',
      email: 'contact@abctech.com',
      phone: '+91 98765 43210',
      address: 'Ring Road, Surat, Gujarat',
      status: 'Active',
      adminEmail: 'admin@abctech.com',
      adminPassword: 'AdminPassword@123',
      adminFirstName: 'Ravi',
      adminLastName: 'Patel',
    },
    'put_/api/super-admin/companies/{id}': {
      companyName: 'ABC Technologies Pvt Ltd',
      phone: '+91 99999 88888',
      status: 'Active',
    },
    'post_/api/super-admin/companies/{id}/assign-admin': {
      userId: 'user-1793009147556',
    },
    'post_/api/super-admin/users': {
      email: 'ravi.admin@abctech.com',
      password: 'Password@123',
      firstName: 'Ravi',
      lastName: 'Admin',
      role: 'ADMIN',
      companyId: 'cmp-1',
      status: 'Active',
    },
    'put_/api/super-admin/users/{id}': {
      firstName: 'Ravi Updated',
      lastName: 'Admin',
      status: 'Active',
    },
    'put_/api/super-admin/users/{id}/role': {
      role: 'ADMIN',
    },
    'put_/api/super-admin/users/{id}/status': {
      status: 'Active',
    },
    'put_/api/super-admin/users/{id}/password': {
      newPassword: 'NewPassword@123',
    },
    'put_/api/companies/{id}': {
      companyName: 'Paneliya Technologies Pvt Ltd',
      phone: '+91 98765 43210',
      address: 'Surat, Gujarat, India',
    },
    'post_/api/employees': {
      firstName: 'Amit',
      lastName: 'Shah',
      email: 'amit.shah@paneliya.com',
      password: 'Employee@123',
      phone: '+91 98765 43210',
      employmentType: 'Full-time',
      status: 'Active',
      salary: {
        basic: 5000,
        hra: 2000,
        allowances: 1200,
        bonus: 500,
        pf: 600,
        tax: 750,
      },
    },
    'put_/api/employees/{id}': {
      firstName: 'Amit',
      lastName: 'Shah Updated',
      phone: '+91 99999 88888',
    },
    'post_/api/organization/departments': {
      name: 'Artificial Intelligence',
      code: 'AI',
      description: 'Research and deployment of machine learning systems.',
    },
    'put_/api/organization/departments/{id}': {
      name: 'Artificial Intelligence & Robotics',
      description: 'Updated department description.',
    },
    'post_/api/organization/designations': {
      title: 'Senior Staff Engineer',
      departmentId: 'dept-1',
      minSalary: 85000,
      maxSalary: 140000,
    },
    'post_/api/attendance/check-in': {
      userId: 'user-1793009147556',
      remarks: 'Morning shift clock-in',
    },
    'post_/api/attendance/check-out': {
      userId: 'user-1793009147556',
      remarks: 'Evening clock-out',
    },
    'post_/api/attendance/regularize': {
      userId: 'user-1793009147556',
      date: '2026-10-26',
      checkIn: '09:00 AM',
      checkOut: '06:00 PM',
      status: 'Present',
      remarks: 'Manual correction by HR',
    },
    'post_/api/leaves/apply': {
      userId: 'user-1793009147556',
      leaveType: 'Casual Leave',
      startDate: '2026-11-01',
      endDate: '2026-11-03',
      isHalfDay: false,
      reason: 'Attending family function',
    },
    'put_/api/assets/{id}/assign': {
      userId: 'user-1793009147556',
      actorName: 'IT Admin',
    },
    'post_/api/resignations/submit': {
      userId: 'user-1793009147556',
      noticePeriodDays: 30,
      reason: 'Relocating for family reasons',
    },
    'post_/api/training/enroll': {
      trainingId: 'trn-1',
      userId: 'user-1793009147556',
    },
    'put_/api/leaves/{id}/approve': {
      approverName: 'Admin',
      comments: 'Approved as per leave policy',
    },
    'put_/api/leaves/{id}/reject': {
      approverName: 'Admin',
      reason: 'Milestone delivery scheduled during requested dates',
    },
    'post_/api/payroll/generate': {
      month: '2026-10',
    },
    'put_/api/payroll/{id}/status': {
      status: 'Paid',
    },
  };

  for (const [pathStr, pathItem] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(pathItem)) {
      if (['get', 'post', 'put', 'delete', 'patch'].indexOf(method) === -1) continue;

      const tag = (op.tags && op.tags[0]) || 'General';
      if (!tagGroups.has(tag)) {
        tagGroups.set(tag, {
          name: tag,
          description: '',
          item: [],
        });
      }

      const urlSegments = pathStr.replace(/^\/api\//, '').split('/');
      const postmanUrl = {
        raw: `{{baseUrl}}/${pathStr.replace(/^\/api\//, '')}`,
        host: ['{{baseUrl}}'],
        path: urlSegments,
        query: [],
        variable: [],
      };

      if (op.parameters) {
        for (const p of op.parameters) {
          if (p.in === 'path') {
            postmanUrl.variable.push({
              key: p.name,
              value: p.name === 'id' ? 'cmp-1' : (p.name === 'employeeId' || p.name === 'userId') ? 'user-1793009147556' : '1',
              description: p.description || '',
            });
          } else if (p.in === 'query') {
            postmanUrl.query.push({
              key: p.name,
              value: '',
              disabled: true,
              description: p.description || '',
            });
          }
        }
      }

      const reqHeaders = [
        {
          key: 'Accept',
          value: 'application/json',
          type: 'text',
        },
      ];

      let reqBody = undefined;
      const keyLookup = `${method}_${pathStr}`;

      if (['post', 'put', 'patch'].includes(method)) {
        reqHeaders.push({
          key: 'Content-Type',
          value: 'application/json',
          type: 'text',
        });

        const sample = sampleBodies[keyLookup];
        reqBody = {
          mode: 'raw',
          raw: JSON.stringify(sample || {}, null, 2),
          options: {
            raw: {
              language: 'json',
            },
          },
        };
      }

      const postmanRequest = {
        name: op.summary || `${method.toUpperCase()} ${pathStr}`,
        request: {
          method: method.toUpperCase(),
          header: reqHeaders,
          body: reqBody,
          url: postmanUrl,
          description: op.description || op.summary || '',
        },
        response: [],
      };

      // Add auto-save script for login and register endpoints
      if ((pathStr === '/api/auth/login' || pathStr === '/api/auth/register') && method === 'post') {
        postmanRequest.request.auth = { type: 'noauth' };
        postmanRequest.event = [
          {
            listen: 'test',
            script: {
              exec: [
                'var jsonData = pm.response.json();',
                'if (jsonData.accessToken) {',
                '    pm.collectionVariables.set("token", jsonData.accessToken);',
                '    pm.environment.set("token", jsonData.accessToken);',
                '    console.log("Auth token auto-saved:", jsonData.accessToken);',
                '}',
                'if (jsonData.user && jsonData.user.companyId) {',
                '    pm.collectionVariables.set("companyId", jsonData.user.companyId);',
                '    pm.environment.set("companyId", jsonData.user.companyId);',
                '}',
              ],
              type: 'text/javascript',
            },
          },
        ];
      }

      tagGroups.get(tag).item.push(postmanRequest);
    }
  }

  for (const group of tagGroups.values()) {
    if (group.item.length > 0) {
      collection.item.push(group);
    }
  }

  const outputPaths = [
    path.resolve(process.cwd(), 'Paneliya_HRMS_API.postman_collection.json'),
    path.resolve(process.cwd(), 'postman/collections/Paneliya_HRMS_API.postman_collection.json'),
  ];

  for (const p of outputPaths) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(collection, null, 2), 'utf8');
    console.log(`Postman collection written to: ${p}`);
  }

  // Environment file
  const environment = {
    id: 'e1d2c3b4-a5f6-4789-9876-543210fedcba',
    name: 'Paneliya HRMS - Local Environment',
    values: [
      {
        key: 'baseUrl',
        value: 'http://localhost:4000/api',
        type: 'default',
        enabled: true,
      },
      {
        key: 'token',
        value: '',
        type: 'secret',
        enabled: true,
      },
      {
        key: 'companyId',
        value: 'cmp-1',
        type: 'default',
        enabled: true,
      },
      {
        key: 'companyCode',
        value: 'CMP-000001',
        type: 'default',
        enabled: true,
      },
    ],
    _postman_variable_scope: 'environment',
  };

  const envPath = path.resolve(process.cwd(), 'postman/environments/Paneliya_HRMS_Local.postman_environment.json');
  fs.mkdirSync(path.dirname(envPath), { recursive: true });
  fs.writeFileSync(envPath, JSON.stringify(environment, null, 2), 'utf8');
  console.log(`Postman environment written to: ${envPath}`);
}

generate().catch(console.error);
