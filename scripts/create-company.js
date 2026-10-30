import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(backendDir, '.env') });

const companyId = `cmp-${Date.now()}`;
const companyCode = 'CMP-000002';
const companyName = 'Jatin Technologies Pvt Ltd';
const companyEmail = 'contact@jatintech.com';
const companyPhone = '+91 98765 43210';
const companyAddress = 'Surat, Gujarat, India';

const adminUserId = `user-${Date.now()}`;
const adminEmail = 'admin@jatintech.com';
const adminRawPassword = 'Password@123';
const hashedPassword = bcrypt.hashSync(adminRawPassword, 10);
const adminFirstName = 'Jatin';
const adminLastName = 'Kakadiya';
const adminPhone = '+91 98765 43210';

const adminEmpId = `emp-${Date.now()}`;
const adminEmpCode = 'EMP-000001';
const now = new Date().toISOString();

const newCompany = {
  id: companyId,
  companyCode,
  companyName,
  name: companyName,
  email: companyEmail,
  phone: companyPhone,
  address: companyAddress,
  status: 'Active',
  adminUserId,
  createdAt: now,
  updatedAt: now,
};

const newAdminUser = {
  id: adminUserId,
  email: adminEmail,
  phone: adminPhone,
  password: hashedPassword,
  firstName: adminFirstName,
  lastName: adminLastName,
  role: 'ADMIN',
  isSuperAdmin: false,
  status: 'Active',
  companyId,
  companyCode,
  employeeId: adminEmpId,
  avatarUrl: '',
  createdAt: now,
  updatedAt: now,
};

const newAdminEmployee = {
  id: adminEmpId,
  employeeCode: adminEmpCode,
  companyId,
  companyCode,
  firstName: adminFirstName,
  lastName: adminLastName,
  email: adminEmail,
  phone: adminPhone,
  avatarUrl: '',
  gender: 'Male',
  dateOfBirth: '1998-05-15',
  joiningDate: '2026-01-01',
  departmentId: 'dept-1',
  departmentName: 'Executive Leadership',
  designationId: 'des-1',
  designationTitle: 'Managing Director & HR Admin',
  employmentType: 'Full-time',
  status: 'Active',
  userId: adminUserId,
  workLocationId: 'loc-1',
  workLocationName: 'Headquarters',
  shift: 'General Shift (09:00 AM – 06:00 PM)',
  salary: {
    basic: 60000,
    hra: 25000,
    allowances: 15000,
    bonus: 10000,
    pf: 7200,
    tax: 5000,
    professionalTax: 200,
    gross: 110000,
    net: 97600,
  },
  bankDetails: {
    bankName: 'HDFC Bank',
    accountNumber: '50100234567890',
    ifscOrRouting: 'HDFC0001234',
    accountHolderName: `${adminFirstName} ${adminLastName}`,
  },
  taxInformation: {
    taxId: 'PAN1234567',
    panOrSsn: 'ABCDE1234F',
    taxRegime: 'New Regime',
  },
  emergencyContact: {
    name: 'Family Contact',
    relationship: 'Brother',
    phone: '+91 98765 00000',
  },
  education: [],
  previousExperience: [],
  skills: ['Management', 'Operations', 'Leadership'],
  createdAt: now,
  updatedAt: now,
};

// 1. Update data/database.json
const dbJsonPath = path.join(backendDir, 'data', 'database.json');
try {
  let dbData = { companies: [], users: [], employees: [], departments: [], designations: [], locations: [], leaveBalances: [] };
  if (fs.existsSync(dbJsonPath)) {
    dbData = JSON.parse(fs.readFileSync(dbJsonPath, 'utf8'));
  }
  dbData.companies = dbData.companies || [];
  dbData.users = dbData.users || [];
  dbData.employees = dbData.employees || [];

  // Remove any conflicting company or user with same email
  dbData.companies = dbData.companies.filter(c => c.companyCode !== companyCode && c.email !== companyEmail);
  dbData.users = dbData.users.filter(u => u.email.toLowerCase() !== adminEmail.toLowerCase());
  dbData.employees = dbData.employees.filter(e => e.email.toLowerCase() !== adminEmail.toLowerCase());

  dbData.companies.push(newCompany);
  dbData.users.push(newAdminUser);
  dbData.employees.push(newAdminEmployee);

  fs.writeFileSync(dbJsonPath, JSON.stringify(dbData, null, 2), 'utf8');
  console.log('[JSON] Successfully updated database.json with new company and admin!');
} catch (err) {
  console.error('[JSON ERROR]:', err);
}

// 2. Insert into MySQL if available
(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DATABASE_HOST || 'localhost',
      port: Number(process.env.DATABASE_PORT) || 3306,
      user: process.env.DATABASE_USER || 'root',
      password: process.env.DATABASE_PASSWORD || '',
      database: process.env.DATABASE_NAME || 'hrms',
      connectTimeout: 4000,
    });

    await conn.query('DELETE FROM companies WHERE companyCode = ? OR email = ?', [companyCode, companyEmail]);
    await conn.query('DELETE FROM users WHERE email = ?', [adminEmail]);
    await conn.query('DELETE FROM employees WHERE email = ?', [adminEmail]);

    await conn.query(
      `INSERT INTO companies (id, companyCode, companyName, email, phone, address, status, adminUserId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newCompany.id, newCompany.companyCode, newCompany.companyName, newCompany.email, newCompany.phone, newCompany.address, newCompany.status, newCompany.adminUserId, newCompany.createdAt, newCompany.updatedAt]
    );

    await conn.query(
      `INSERT INTO users (id, email, phone, password, firstName, lastName, role, isSuperAdmin, status, companyId, companyCode, employeeId, avatarUrl, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newAdminUser.id, newAdminUser.email, newAdminUser.phone, newAdminUser.password, newAdminUser.firstName, newAdminUser.lastName, newAdminUser.role, 0, newAdminUser.status, newAdminUser.companyId, newAdminUser.companyCode, newAdminUser.employeeId, '', newAdminUser.createdAt, newAdminUser.updatedAt]
    );

    await conn.query(
      `INSERT INTO employees (id, employeeCode, companyId, companyCode, firstName, lastName, email, phone, avatarUrl, gender, dateOfBirth, joiningDate, departmentId, departmentName, designationId, designationTitle, employmentType, status, workLocationId, workLocationName, shift, salary, bankDetails, taxInformation, emergencyContact, education, previousExperience, skills, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newAdminEmployee.id, newAdminEmployee.employeeCode, newAdminEmployee.companyId, newAdminEmployee.companyCode,
        newAdminEmployee.firstName, newAdminEmployee.lastName, newAdminEmployee.email, newAdminEmployee.phone, '',
        newAdminEmployee.gender, newAdminEmployee.dateOfBirth, newAdminEmployee.joiningDate,
        newAdminEmployee.departmentId, newAdminEmployee.departmentName, newAdminEmployee.designationId, newAdminEmployee.designationTitle,
        newAdminEmployee.employmentType, newAdminEmployee.status,
        newAdminEmployee.workLocationId, newAdminEmployee.workLocationName, newAdminEmployee.shift,
        JSON.stringify(newAdminEmployee.salary), JSON.stringify(newAdminEmployee.bankDetails), JSON.stringify(newAdminEmployee.taxInformation), JSON.stringify(newAdminEmployee.emergencyContact),
        JSON.stringify(newAdminEmployee.education), JSON.stringify(newAdminEmployee.previousExperience), JSON.stringify(newAdminEmployee.skills),
        newAdminEmployee.createdAt, newAdminEmployee.updatedAt
      ]
    );

    await conn.end();
    console.log('[MySQL] Successfully synced to MySQL database "hrms"!');
  } catch (mysqlErr) {
    console.log('[MySQL Notice] MySQL sync skipped or offline:', mysqlErr.message);
  }

  console.log('\n=============================================');
  console.log('   COMPANY & ADMIN CREATED SUCCESSFULLY!     ');
  console.log('=============================================');
  console.log('Company Name : ' + companyName);
  console.log('Company Code : ' + companyCode);
  console.log('Login Email  : ' + adminEmail);
  console.log('Password     : ' + adminRawPassword);
  console.log('Phone        : ' + adminPhone);
  console.log('Role         : ADMIN (Full Access)');
  console.log('=============================================\n');
  process.exit(0);
})();

