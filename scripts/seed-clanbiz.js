import fs from 'fs';
import path from 'path';

const dataDir = path.resolve('backend/data');
const dbFilePath = path.join(dataDir, 'database.json');

const attendanceRecords = [];
// 13 days absent in October 2026 (Oct 1 to Oct 13)
for (let d = 1; d <= 13; d++) {
  const dayStr = String(d).padStart(2, '0');
  attendanceRecords.push({
    id: `att-oct-${d}`,
    employeeId: 'emp-1',
    employeeName: 'Keyur Sangani',
    date: `2026-10-${dayStr}`,
    checkIn: '',
    checkOut: '',
    breakDurationMinutes: 0,
    workingHours: 0,
    overtimeHours: 0,
    status: 'Absent',
    remarks: 'Absent',
    createdAt: `2026-10-${dayStr}T09:00:00Z`
  });
}

const db = {
  locations: [
    {
      id: 'loc-1',
      name: 'Corporate HQ',
      city: 'Surat',
      country: 'India',
      address: 'paneliya technology, Surat, Gujarat, India',
      isHeadquarter: true
    }
  ],
  departments: [
    {
      id: 'dept-1',
      name: 'Administration & Management',
      code: 'ADM',
      headEmployeeId: 'emp-1',
      headName: 'Keyur Sangani',
      employeeCount: 1,
      description: 'Core Executive & Operations Management',
      createdAt: '2026-10-19T00:00:00Z'
    }
  ],
  designations: [
    {
      id: 'des-1',
      title: 'App Administrator',
      departmentId: 'dept-1',
      departmentName: 'Administration & Management',
      minSalary: 0,
      maxSalary: 0,
      createdAt: '2026-10-19T00:00:00Z'
    }
  ],
  users: [
    {
      id: 'user-1',
      email: 'keyur.sangani1234@gmail.com',
      firstName: 'Keyur',
      lastName: 'Sangani',
      role: 'SUPER_ADMIN',
      employeeId: 'emp-1',
      avatarUrl: '',
      createdAt: '2026-10-19T00:00:00Z',
      updatedAt: '2026-10-19T00:00:00Z'
    }
  ],
  employees: [
    {
      id: 'emp-1',
      employeeCode: 'EMP-1',
      userId: 'user-1',
      firstName: 'Keyur',
      lastName: 'Sangani',
      email: 'keyur.sangani1234@gmail.com',
      phone: '6352486893',
      avatarUrl: '',
      gender: 'Male',
      dateOfBirth: '1996-05-15',
      address: 'Surat, Gujarat',
      emergencyContact: { name: '', relationship: '', phone: '' },
      joiningDate: '2026-10-19',
      employmentType: 'Full-time',
      status: 'Active',
      departmentId: 'dept-1',
      departmentName: '--',
      designationId: 'des-1',
      designationTitle: 'App Administrator',
      reportingManagerId: '',
      reportingManagerName: '—',
      workLocationId: 'loc-1',
      workLocationName: '--',
      shift: 'General Shift (09:00 AM – 06:00 PM)',
      bankDetails: {
        bankName: '',
        accountNumber: '',
        ifscOrRouting: '',
        accountHolderName: 'Keyur Sangani'
      },
      taxInformation: {
        taxId: '',
        panOrSsn: '',
        taxRegime: 'New Regime'
      },
      education: [],
      previousExperience: [],
      skills: ['App Administrator', 'Project Management'],
      salary: {
        basic: 50000,
        hra: 20000,
        allowances: 10000,
        bonus: 5000,
        pf: 6000,
        tax: 8000,
        professionalTax: 200,
        gross: 85000,
        net: 70800
      },
      createdAt: '2026-10-19T09:00:00Z',
      updatedAt: '2026-10-19T00:00:00Z'
    }
  ],
  holidays: [
    {
      id: 'hol-1',
      name: 'Diwali',
      date: '2026-11-08',
      dayOfWeek: 'Sunday',
      type: 'Public',
      description: 'Festival of Lights'
    },
    {
      id: 'hol-2',
      name: 'Christmas Day',
      date: '2026-12-25',
      dayOfWeek: 'Friday',
      type: 'Public',
      description: 'Christmas'
    }
  ],
  leaveBalances: [
    {
      id: 'bal-emp-1',
      employeeId: 'emp-1',
      year: 2026,
      casualLeave: { total: 3.12, used: 0, remaining: 3.12 },
      sickLeave: { total: 0, used: 0, remaining: 0 },
      paidLeave: { total: 3.12, used: 0, remaining: 3.12 }
    }
  ],
  leaveRequests: [],
  attendanceRecords: attendanceRecords,
  payrollRecords: [],
  jobs: [],
  candidates: [],
  assets: [],
  trainingPrograms: [],
  employeeTrainings: [],
  performanceCycles: [],
  performanceReviews: [],
  resignations: [],
  announcements: [
    {
      id: 'ann-1',
      title: 'Welcome to paneliya technology Portal',
      content: 'HR & Project Management OS setup completed. Manage attendance, leave, and tasks in real-time.',
      authorId: 'user-1',
      authorName: 'Keyur Sangani (App Administrator)',
      priority: 'HIGH',
      category: 'General',
      publishedAt: '2026-10-19T09:00:00Z',
      expiryDate: '2026-12-31T23:59:59Z',
      targetAudience: 'All Employees'
    }
  ],
  notifications: [
    {
      id: 'notif-1',
      title: 'Welcome to paneliya technology',
      message: 'New here? Read the Employee Guide to learn how to use attendance, leave, and your profile.',
      type: 'SYSTEM',
      read: false,
      createdAt: '2026-10-19T09:00:00Z',
      link: '/account/dashboard'
    }
  ],
  documents: [],
  auditLogs: [
    {
      id: 'audit-1',
      userId: 'user-1',
      userName: 'Keyur Sangani',
      userRole: 'App Administrator',
      action: 'LOGIN',
      module: 'Auth',
      recordId: 'user-1',
      details: 'Signed into paneliya technology HR & Project Management OS',
      ipAddress: '127.0.0.1',
      createdAt: '2026-10-19T18:00:00Z'
    }
  ]
};

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

fs.writeFileSync(dbFilePath, JSON.stringify(db, null, 2), 'utf8');
console.log('Successfully reseeded database.json with Keyur Sangani real Clan.biz data.');
