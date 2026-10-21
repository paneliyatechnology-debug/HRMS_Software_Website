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
      description: 'Comprehensive Postman collection for Paneliya HRMS Backend API covering all 19 modules, DTO validations, and endpoints.',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
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
    ],
    item: [],
  };

  const tagGroups = new Map();

  for (const tag of spec.tags || []) {
    tagGroups.set(tag.name, {
      name: tag.name,
      description: tag.description || '',
      item: [],
    });
  }

  // Pre-configured JSON request bodies for clean testing
  const sampleBodies = {
    'post_/api/auth/login': {
      email: 'keyur.sangani1234@gmail.com',
      password: 'AnyPasswordOrEmpty',
    },
    'post_/api/auth/switch-role': {
      role: 'SUPER_ADMIN',
    },
    'post_/api/employees': {
      employeeCode: 'EMP-105',
      firstName: 'David',
      lastName: 'Miller',
      email: 'david.miller@paneliya.com',
      phone: '+1 (555) 234-5678',
      gender: 'Male',
      dateOfBirth: '1992-06-15',
      departmentId: 'dept-1',
      designationId: 'des-1',
      workLocationId: 'loc-1',
      joiningDate: '2026-02-01',
      employmentType: 'Full-time',
      status: 'Active',
      skills: ['TypeScript', 'NestJS', 'PostgreSQL'],
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
      firstName: 'David',
      lastName: 'Miller Updated',
      phone: '+1 (555) 999-8888',
      salary: {
        basic: 6000,
      },
    },
    'post_/api/organization/departments': {
      name: 'Artificial Intelligence',
      code: 'AI',
      headName: 'Keyur Sangani',
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
      employeeId: 'emp-1',
      remarks: 'Morning shift clock-in',
    },
    'post_/api/attendance/check-out': {
      employeeId: 'emp-1',
      remarks: 'Evening clock-out',
    },
    'post_/api/attendance/regularize': {
      employeeId: 'emp-1',
      date: '2026-10-21',
      checkIn: '09:00 AM',
      checkOut: '06:00 PM',
      status: 'Present',
      remarks: 'Manual correction by HR',
    },
    'post_/api/attendance/biometric-sync': {
      deviceId: 'ZK-TERMINAL-01',
      logs: [
        {
          deviceId: 'ZK-DEV-01',
          employeeCode: 'EMP-1',
          punchTime: '2026-10-21T09:05:00',
          type: 'IN',
        },
      ],
    },
    'post_/api/leaves/apply': {
      employeeId: 'emp-1',
      leaveType: 'Casual Leave',
      startDate: '2026-11-01',
      endDate: '2026-11-03',
      isHalfDay: false,
      reason: 'Attending personal family commitments',
    },
    'put_/api/leaves/{id}/approve': {
      role: 'HR_ADMIN',
      approverName: 'Keyur Sangani',
      comments: 'Approved as per company leave policy',
    },
    'put_/api/leaves/{id}/reject': {
      approverName: 'Keyur Sangani',
      reason: 'Critical sprint delivery milestone during requested dates',
    },
    'post_/api/payroll/generate': {
      month: '2026-10',
      actorName: 'Keyur Sangani',
    },
    'put_/api/payroll/{id}/status': {
      status: 'Paid',
      actorName: 'Keyur Sangani',
    },
    'post_/api/recruitment/jobs': {
      title: 'Senior AI Engineer',
      departmentId: 'dept-1',
      departmentName: 'Administration & Management',
      designationTitle: 'Senior AI Engineer',
      location: 'Surat, Gujarat (Hybrid)',
      employmentType: 'Full-time',
      experienceLevel: 'Senior',
      openingsCount: 2,
      salaryRange: '$130,000 - $170,000',
      description: 'Build and deploy enterprise AI infrastructure.',
      skillsRequired: ['Python', 'PyTorch', 'NestJS'],
    },
    'post_/api/recruitment/candidates': {
      jobId: 'job-1',
      jobTitle: 'Senior Full Stack Engineer',
      fullName: 'Lucas Scott',
      email: 'lucas.scott@example.com',
      phone: '+1 (555) 789-0123',
      experienceYears: 5,
      currentCompany: 'Acme Corp',
      skills: ['React', 'Node.js', 'PostgreSQL'],
      source: 'LinkedIn',
      notes: 'Strong portfolio and open source contributor.',
    },
    'put_/api/recruitment/candidates/{id}/status': {
      status: 'Interview',
      actorName: 'Lead Recruiter',
    },
    'post_/api/recruitment/candidates/{id}/schedule-interview': {
      round: 'Technical Architecture Round',
      interviewerName: 'Keyur Sangani',
      scheduledAt: '2026-10-25 10:00 AM PST',
    },
    'post_/api/recruitment/candidates/{id}/convert': {
      actorName: 'Keyur Sangani',
    },
    'post_/api/performance/reviews/{id}/rate': {
      selfRating: 4.5,
      selfComments: 'Delivered core microservices ahead of sprint deadline',
      managerRating: 4.8,
      managerFeedback: 'Outstanding performance and team leadership',
      appraisalRecommended: 'Promotion to Lead Software Engineer recommended',
      role: 'MANAGER',
      actorName: 'Keyur Sangani',
    },
    'post_/api/training/programs': {
      title: 'Advanced System Design with NestJS',
      description: 'Master clean architecture, microservices, and distributed events',
      trainerName: 'Keyur Sangani',
      skillsCovered: ['NestJS', 'TypeScript', 'Clean Architecture'],
      startDate: '2026-11-10',
      endDate: '2026-11-20',
      durationHours: 16,
    },
    'post_/api/training/enroll': {
      trainingId: 'trn-1',
      employeeId: 'emp-1',
    },
    'put_/api/training/enrollments/{id}/progress': {
      progressPercent: 75,
    },
    'post_/api/assets': {
      assetCode: 'AST-101',
      name: 'MacBook Pro M3 Max 16"',
      category: 'Laptop',
      serialNumber: 'C02G879QMD6T',
      condition: 'Excellent',
      purchaseDate: '2026-01-15',
    },
    'put_/api/assets/{id}/assign': {
      employeeId: 'emp-1',
      actorName: 'Keyur Sangani',
    },
    'put_/api/assets/{id}/return': {
      condition: 'Good',
      actorName: 'Keyur Sangani',
    },
    'post_/api/resignations/submit': {
      employeeId: 'emp-1',
      noticePeriodDays: 30,
      reason: 'Relocating to another city for family reasons',
    },
    'put_/api/resignations/{id}/clearance': {
      clearance: {
        departmentClearance: true,
        assetReturned: true,
        financeSettlement: true,
        exitInterviewCompleted: true,
      },
      actorName: 'Keyur Sangani',
    },
    'post_/api/holidays': {
      name: 'Thanksgiving Day',
      date: '2026-11-26',
      dayOfWeek: 'Thursday',
      type: 'Public',
      description: 'Annual Thanksgiving celebration',
    },
    'post_/api/documents': {
      employeeId: 'emp-1',
      title: 'Offer Letter - Signed',
      category: 'Contracts',
      fileUrl: 'http://localhost:4000/uploads/documents/sample.pdf',
      fileSize: '1.2 MB',
      expiryDate: '2028-12-31',
    },
    'put_/api/documents/{id}/verify': {
      status: 'Verified',
      verifiedBy: 'Keyur Sangani',
    },
    'post_/api/announcements': {
      title: 'Annual Paneliya Tech Summit 2026',
      content: 'All team members are invited to register for keynote tracks.',
      targetAudience: 'All',
      priority: 'High',
      authorName: 'Keyur Sangani',
    },
    'put_/api/settings': {
      company: {
        name: 'Paneliya Technology Inc.',
        tagline: 'Enterprise Cloud & Next-Gen Software Engineering',
        currency: 'USD ($)',
      },
      workSchedule: {
        workingHoursPerDay: 8,
        defaultShift: '09:00 AM - 06:00 PM',
        gracePeriodMinutes: 15,
      },
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

      // Convert /api/employees/{id} to /api/employees/:id or leave as is
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
              value: p.name === 'employeeId' || p.name === 'id' ? 'emp-1' : '1',
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
          method: method.toUpperCase(),
          header: reqHeaders,
          body: reqBody,
          url: postmanUrl,
          description: op.description || op.summary || '',
        },
        response: [],
      };

      // Add auto-save script for login endpoint!
      if (pathStr === '/api/auth/login' && method === 'post') {
        postmanRequest.event = [
          {
            listen: 'test',
            script: {
              exec: [
                'var jsonData = pm.response.json();',
                'if (jsonData.accessToken) {',
                '    pm.collectionVariables.set("token", jsonData.accessToken);',
                '    console.log("Auth token saved:", jsonData.accessToken);',
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

  // Also create environment file
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
    ],
    _postman_variable_scope: 'environment',
  };

  const envPath = path.resolve(process.cwd(), 'postman/environments/Paneliya_HRMS_Local.postman_environment.json');
  fs.mkdirSync(path.dirname(envPath), { recursive: true });
  fs.writeFileSync(envPath, JSON.stringify(environment, null, 2), 'utf8');
  console.log(`Postman environment written to: ${envPath}`);
}

generate().catch(console.error);
