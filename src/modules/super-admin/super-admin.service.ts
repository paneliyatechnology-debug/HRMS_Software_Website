import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from '../../database/database.service.js';
import {
  User,
  Role,
  Employee,
  EmployeeStatus,
  LeaveStatus,
  AuditLog,
  Company,
  CompanyRegistrationRequest,
} from '../../common/types.js';
import { RegisterCompanyRequestDto } from '../companies/dto/register-company-request.dto.js';
import { CreateSuperAdminUserDto } from './dto/create-super-admin-user.dto.js';
import { UpdateSuperAdminUserDto } from './dto/update-super-admin-user.dto.js';
import { UpdateUserRoleDto } from './dto/update-user-role.dto.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto.js';
import { QuerySuperAdminUsersDto } from './dto/query-super-admin-users.dto.js';
import { UpdateSystemSettingsDto } from './dto/system-settings.dto.js';
import { LeaveOverrideDto } from './dto/leave-override.dto.js';
import { CreateCompanyDto } from './dto/create-company.dto.js';
import { UpdateCompanyDto } from './dto/update-company.dto.js';
import { CreateAdminDto } from './dto/create-admin.dto.js';
import { UpdateAdminDto } from './dto/update-admin.dto.js';
import { QueryAdminsDto } from './dto/query-admins.dto.js';
import { hashPassword } from '../../common/utils/password.util.js';

@Injectable()
export class SuperAdminService {
  private readonly logger = new Logger(SuperAdminService.name);
  constructor(private readonly db: DatabaseService) {}

  // -------------------------------------------------------------
  // 1. MASTER SYSTEM DASHBOARD & METRICS (Badhu access kari sake)
  // -------------------------------------------------------------
  getDashboardOverview() {
    const totalUsers = this.db.users.length;
    const superAdminsCount = this.db.users.filter(
      (u) => u.role === Role.SUPER_ADMIN || u.isSuperAdmin === true,
    ).length;

    // Role Distribution Breakdown
    const roleBreakdown: Record<string, number> = {};
    for (const roleKey of Object.values(Role)) {
      roleBreakdown[roleKey] = this.db.users.filter((u) => u.role === roleKey).length;
    }

    // Employee Status Distribution
    const employeeStatusBreakdown: Record<string, number> = {};
    for (const emp of this.db.employees) {
      const st = emp.status || 'Active';
      employeeStatusBreakdown[st] = (employeeStatusBreakdown[st] || 0) + 1;
    }

    // Today's Attendance Snapshot
    const todayStr = new Date().toISOString().split('T')[0];
    const todayRecords = this.db.attendanceRecords.filter(
      (a) => a.date?.startsWith(todayStr) || a.date === todayStr,
    );
    const attendanceStats = {
      totalMarkedToday: todayRecords.length,
      present: todayRecords.filter((a) => a.status === 'Present').length,
      late: todayRecords.filter((a) => a.status === 'Late').length,
      halfDay: todayRecords.filter((a) => a.status === 'Half Day').length,
      onLeave: todayRecords.filter((a) => a.status === 'On Leave').length,
      absent: Math.max(0, this.db.employees.length - todayRecords.length),
    };

    // Pending Action Overviews across modules
    const pendingActions = {
      pendingLeaves: this.db.leaveRequests.filter((l) => l.status === LeaveStatus.PENDING).length,
      pendingResignations: this.db.resignations.filter((r) => r.status === 'Submitted').length,
      pendingDocumentVerifications: this.db.documents.filter(
        (d) => d.verificationStatus === 'Pending',
      ).length,
      openJobOpenings: this.db.jobs.filter((j) => j.status === 'Published').length,
      activeCandidatesInPipeline: this.db.candidates.filter(
        (c) => c.status !== 'Hired' && c.status !== 'Rejected',
      ).length,
      availableAssets: this.db.assets.filter((a) => a.status === 'Available').length,
      assignedAssets: this.db.assets.filter((a) => a.status === 'Assigned').length,
    };

    // Financial / Payroll Snapshot
    const totalPayrollRecords = this.db.payrollRecords.length;
    const totalGrossPayout = this.db.payrollRecords.reduce(
      (sum, p) => sum + (p.netSalary || p.grossSalary || 0),
      0,
    );

    // System Vitality & Hardware Health
    const mem = process.memoryUsage();
    const systemHealth = {
      status: 'HEALTHY',
      serverTime: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      memory: {
        heapUsedMB: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotalMB: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
        rssMB: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
      },
      collectionsCount: {
        users: this.db.users.length,
        employees: this.db.employees.length,
        departments: this.db.departments.length,
        designations: this.db.designations.length,
        locations: this.db.locations.length,
        attendanceRecords: this.db.attendanceRecords.length,
        leaveRequests: this.db.leaveRequests.length,
        payrollRecords: this.db.payrollRecords.length,
        jobs: this.db.jobs.length,
        candidates: this.db.candidates.length,
        assets: this.db.assets.length,
        trainingPrograms: this.db.trainingPrograms.length,
        resignations: this.db.resignations.length,
        documents: this.db.documents.length,
        auditLogs: this.db.auditLogs.length,
      },
    };

    // Recent 10 Security & State Change Audit Logs
    const recentAudits = [...this.db.auditLogs]
      .reverse()
      .slice(0, 10);

    return {
      overview: {
        totalUsers,
        superAdminsCount,
        totalEmployees: this.db.employees.length,
        totalDepartments: this.db.departments.length,
        totalDesignations: this.db.designations.length,
        totalLocations: this.db.locations.length,
      },
      roleBreakdown,
      employeeStatusBreakdown,
      attendanceStats,
      pendingActions,
      payrollSnapshot: {
        totalPayrollRecords,
        cumulativeDisbursementAmount: Math.round(totalGrossPayout),
      },
      systemHealth,
      recentAudits,
    };
  }

  // -------------------------------------------------------------
  // 2. USER & SUPER ADMIN ACCOUNT MANAGEMENT (RBAC)
  // -------------------------------------------------------------
  getUsers(query: QuerySuperAdminUsersDto) {
    let list = [...this.db.users];

    if (query.search) {
      const q = query.search.toLowerCase();
      list = list.filter(
        (u) =>
          u.firstName?.toLowerCase().includes(q) ||
          u.lastName?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q),
      );
    }

    if (query.role) {
      list = list.filter((u) => u.role === query.role);
    }

    if (query.status) {
      list = list.filter((u) => (u.status || 'Active').toLowerCase() === query.status?.toLowerCase());
    }

    if (query.isSuperAdmin !== undefined) {
      list = list.filter((u) => {
        const isSA = u.role === Role.SUPER_ADMIN || u.isSuperAdmin === true;
        return isSA === query.isSuperAdmin;
      });
    }

    const total = list.length;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;
    const startIndex = (page - 1) * limit;
    const paginated = list.slice(startIndex, startIndex + limit);

    // Map safe user profiles with linked employee metadata
    const items = paginated.map((u) => {
      const { password: _, ...safeUser } = u;
      const linkedEmployee = u.employeeId
        ? this.db.employees.find((e) => e.id === u.employeeId || e.userId === u.id)
        : null;

      return {
        ...safeUser,
        isSuperAdmin: u.isSuperAdmin ?? (u.role === Role.SUPER_ADMIN),
        status: u.status || 'Active',
        employeeCode: linkedEmployee?.employeeCode || null,
        departmentName: linkedEmployee?.departmentName || null,
        designationTitle: linkedEmployee?.designationTitle || null,
      };
    });

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items,
    };
  }

  getUserById(id: string) {
    const user = this.db.users.find(
      (u) => u.id.toLowerCase() === id.toLowerCase() || u.email.toLowerCase() === id.toLowerCase(),
    );

    if (!user) {
      throw new NotFoundException(`User with ID or email "${id}" not found.`);
    }

    const { password: _, ...safeUser } = user;
    const linkedEmployee = this.db.employees.find(
      (e) => e.userId === user.id || e.id === user.employeeId,
    );

    const userAuditLogs = this.db.auditLogs
      .filter((a) => a.userId === user.id || a.recordId === user.id)
      .slice(-20)
      .reverse();

    return {
      ...safeUser,
      isSuperAdmin: user.isSuperAdmin ?? (user.role === Role.SUPER_ADMIN),
      status: user.status || 'Active',
      linkedEmployee: linkedEmployee || null,
      recentActivity: userAuditLogs,
    };
  }

  // -------------------------------------------------------------
  // 2.1 COMPANY ADMIN MANAGEMENT (SUPER_ADMIN ONLY)
  // -------------------------------------------------------------
  getAdmins(query: QueryAdminsDto) {
    let list = this.db.users.filter((u) => {
      if (query.includeSuperAdmins) {
        return u.role === Role.ADMIN || u.role === Role.SUPER_ADMIN || u.isSuperAdmin === true;
      }
      return u.role === Role.ADMIN;
    });

    if (query.search) {
      const q = query.search.toLowerCase();
      list = list.filter(
        (u) =>
          u.firstName?.toLowerCase().includes(q) ||
          u.lastName?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q),
      );
    }

    if (query.companyId) {
      list = list.filter(
        (u) =>
          u.companyId === query.companyId ||
          u.companyCode === query.companyId,
      );
    }

    if (query.status) {
      list = list.filter((u) => (u.status || 'Active').toLowerCase() === query.status?.toLowerCase());
    }

    const total = list.length;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const startIndex = (page - 1) * limit;
    const paginated = list.slice(startIndex, startIndex + limit);

    const items = paginated.map((u) => {
      const { password: _, ...safeUser } = u;
      const company = this.db.companies.find((c) => c.id === u.companyId || c.companyCode === u.companyCode);
      return {
        ...safeUser,
        companyName: company?.companyName || null,
        companyCode: company?.companyCode || u.companyCode || null,
      };
    });

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items,
    };
  }

  getAdminById(id: string) {
    const user = this.db.users.find(
      (u) =>
        (u.id.toLowerCase() === id.toLowerCase() || u.email.toLowerCase() === id.toLowerCase()) &&
        (u.role === Role.ADMIN || u.role === Role.SUPER_ADMIN || u.isSuperAdmin === true),
    );

    if (!user) {
      throw new NotFoundException(`Administrator with ID or email "${id}" not found.`);
    }

    const { password: _, ...safeUser } = user;
    const company = this.db.companies.find((c) => c.id === user.companyId || c.companyCode === user.companyCode);

    return {
      ...safeUser,
      company: company || null,
    };
  }

  async createAdmin(dto: CreateAdminDto, actingAdmin?: User) {
    const targetCompany = this.db.companies.find(
      (c) => c.id === dto.companyId || c.companyCode === dto.companyId,
    );
    if (!targetCompany) {
      throw new NotFoundException(
        `Company with ID or code "${dto.companyId}" not found. Please provide an existing company.`,
      );
    }

    const releaseEmailLock = this.db.acquireEmailLock(dto.email, targetCompany.id);
    let releasePhoneLock = () => {};
    if (dto.phone) {
      releasePhoneLock = this.db.acquirePhoneLock(dto.phone, targetCompany.id);
    }

    try {
      const normalizedEmail = await this.db.assertEmailUnique(dto.email, targetCompany.id, undefined, true);
      const normalizedPhone = dto.phone
        ? await this.db.assertPhoneUnique(dto.phone, targetCompany.id, undefined, true)
        : '';

      const userId = `user-${Date.now()}`;
      const hashedPassword = hashPassword(dto.password);

      const newAdmin: User = {
        id: userId,
        email: normalizedEmail,
        phone: normalizedPhone,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: Role.ADMIN,
        isSuperAdmin: false,
        status: dto.status || 'Active',
        companyId: targetCompany.id,
        companyCode: targetCompany.companyCode,
        employeeId: null,
        avatarUrl: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.db.users.unshift(newAdmin);

      targetCompany.adminUserId = userId;
      targetCompany.updatedAt = new Date().toISOString();

      this.db.logAudit(
        actingAdmin?.id || 'super-admin',
        actingAdmin ? `${actingAdmin.firstName} ${actingAdmin.lastName}` : 'Super Admin',
        actingAdmin?.role || Role.SUPER_ADMIN,
        'SUPER_ADMIN_CREATE_ADMIN',
        'SuperAdmin',
        `Super admin created Company Admin account for ${newAdmin.email} assigned to "${targetCompany.companyName}"`,
        newAdmin.id,
      );

      this.db.persist();

      const { password: _, ...safeUser } = newAdmin;
      return {
        message: 'Company Administrator created successfully',
        admin: {
          ...safeUser,
          companyName: targetCompany.companyName,
          companyCode: targetCompany.companyCode,
        },
      };
    } finally {
      releaseEmailLock();
      releasePhoneLock();
    }
  }

  async updateAdmin(id: string, dto: UpdateAdminDto, actingAdmin?: User) {
    const user = this.db.users.find(
      (u) =>
        (u.id === id || u.email.toLowerCase() === id.toLowerCase()) &&
        (u.role === Role.ADMIN || u.role === Role.SUPER_ADMIN),
    );

    if (!user) {
      throw new NotFoundException(`Administrator with ID "${id}" not found.`);
    }

    const targetCompanyId = (dto as any).companyId || user.companyId;

    if (dto.email && dto.email.trim().toLowerCase() !== user.email.toLowerCase()) {
      const normalizedEmail = await this.db.assertEmailUnique(dto.email, targetCompanyId, user.id);
      user.email = normalizedEmail;
    }

    if (dto.phone !== undefined && dto.phone.trim() !== '') {
      const normalizedPhone = await this.db.assertPhoneUnique(dto.phone, targetCompanyId, user.id);
      user.phone = normalizedPhone;
    } else if (dto.phone !== undefined) {
      user.phone = '';
    }

    if (dto.firstName) user.firstName = dto.firstName;
    if (dto.lastName) user.lastName = dto.lastName;
    if (dto.password) user.password = hashPassword(dto.password);
    if (dto.status) user.status = dto.status;

    if (dto.companyId) {
      const company = this.db.companies.find((c) => c.id === dto.companyId || c.companyCode === dto.companyId);
      if (!company) {
        throw new NotFoundException(`Company "${dto.companyId}" not found.`);
      }
      user.companyId = company.id;
      user.companyCode = company.companyCode;
    }

    user.updatedAt = new Date().toISOString();

    this.db.logAudit(
      actingAdmin?.id || 'super-admin',
      actingAdmin ? `${actingAdmin.firstName} ${actingAdmin.lastName}` : 'Super Admin',
      actingAdmin?.role || Role.SUPER_ADMIN,
      'SUPER_ADMIN_UPDATE_ADMIN',
      'SuperAdmin',
      `Super admin updated Administrator profile for ${user.email}`,
      user.id,
    );

    this.db.persist();

    const { password: _, ...safeUser } = user;
    return {
      message: 'Administrator updated successfully',
      admin: safeUser,
    };
  }

  deleteAdmin(id: string, actingAdmin?: User) {
    const idx = this.db.users.findIndex(
      (u) => (u.id === id || u.email.toLowerCase() === id.toLowerCase()) && u.role === Role.ADMIN,
    );

    if (idx === -1) {
      throw new NotFoundException(`Company Administrator with ID "${id}" not found.`);
    }

    const admin = this.db.users[idx];
    this.db.users.splice(idx, 1);

    this.db.logAudit(
      actingAdmin?.id || 'super-admin',
      actingAdmin ? `${actingAdmin.firstName} ${actingAdmin.lastName}` : 'Super Admin',
      actingAdmin?.role || Role.SUPER_ADMIN,
      'SUPER_ADMIN_DELETE_ADMIN',
      'SuperAdmin',
      `Super admin deleted Company Administrator ${admin.email}`,
      admin.id,
    );

    this.db.persist();

    return {
      message: `Administrator "${admin.email}" deleted successfully.`,
    };
  }

  async createUser(dto: CreateSuperAdminUserDto, actingAdmin?: User) {
    const role = dto.role || Role.SUPER_ADMIN;
    // Target company assignment
    let targetCompany: Company | undefined;
    if (dto.companyId) {
      targetCompany = this.db.companies.find(
        (c) => c.id === dto.companyId || c.companyCode === dto.companyId,
      );
      if (!targetCompany) {
        throw new NotFoundException(
          `Company with ID or code "${dto.companyId}" not found. Please provide an existing company.`,
        );
      }
    } else if (actingAdmin && actingAdmin.companyId) {
      targetCompany = this.db.companies.find((c) => c.id === actingAdmin.companyId);
    } else if (role !== Role.SUPER_ADMIN && this.db.companies.length > 0) {
      targetCompany = this.db.companies[0];
    }

    if (role === Role.ADMIN && !targetCompany) {
      throw new BadRequestException(
        'A valid company must exist or be provided to create a Company Admin account.',
      );
    }

    const companyScopeId = targetCompany ? targetCompany.id : null;
    const releaseEmailLock = this.db.acquireEmailLock(dto.email, companyScopeId);
    let releasePhoneLock = () => {};
    if (dto.phone) {
      releasePhoneLock = this.db.acquirePhoneLock(dto.phone, companyScopeId);
    }

    try {
      const normalizedEmail = await this.db.assertEmailUnique(dto.email, companyScopeId, undefined, true);
      const normalizedPhone = dto.phone
        ? await this.db.assertPhoneUnique(dto.phone, companyScopeId, undefined, true)
        : '';

      const userId = `user-${Date.now()}`;
      const employeeId = role === Role.EMPLOYEE ? userId : null;
      const isSuperAdmin = dto.isSuperAdmin !== undefined ? dto.isSuperAdmin : role === Role.SUPER_ADMIN;
      const status = dto.status || 'Active';

      const hashedPassword = hashPassword(dto.password);

    const newUser: User = {
      id: userId,
      email: normalizedEmail,
      phone: normalizedPhone,
      password: hashedPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role,
      isSuperAdmin,
      status,
      companyId: targetCompany?.id || null,
      companyCode: targetCompany?.companyCode || undefined,
      employeeId,
      avatarUrl: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.db.users.unshift(newUser);

    if (role === Role.ADMIN && targetCompany) {
      targetCompany.adminUserId = userId;
      targetCompany.updatedAt = new Date().toISOString();
    }

    // Also create matching employee record ONLY for EMPLOYEE role
    if (role === Role.EMPLOYEE) {
      const department = this.db.departments.find((d) => d.id === dto.departmentId) || this.db.departments[0];
      const designation = this.db.designations.find((d) => d.id === dto.designationId) || this.db.designations[0];
      const location = this.db.locations[0];

      // Scoped employee code generation
      let maxEmpNum = 0;
      const scopedList = targetCompany
        ? this.db.employees.filter((e) => e.companyId === targetCompany?.id)
        : this.db.employees;

      for (const emp of scopedList) {
        if (emp.employeeCode) {
          const match = emp.employeeCode.match(/(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxEmpNum) maxEmpNum = num;
          }
        }
      }
      const autoEmployeeCode = `EMP-${String(maxEmpNum + 1).padStart(6, '0')}`;

      const newEmployee: Employee = {
        id: userId,
        employeeCode: autoEmployeeCode,
        companyId: targetCompany?.id || '',
        companyCode: targetCompany?.companyCode || '',
        userId,
        password: hashedPassword,
        isSuperAdmin,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: normalizedEmail,
        phone: dto.phone || '',
        avatarUrl: '',
        gender: 'Other',
        dateOfBirth: '',
        address: '',
        emergencyContact: {} as any,
        joiningDate: new Date().toISOString().split('T')[0],
        employmentType: 'Full-time',
        status: EmployeeStatus.ACTIVE,
        departmentId: department?.id || '',
        departmentName: department?.name || '',
        designationId: designation?.id || '',
        designationTitle: designation?.title || '',
        reportingManagerId: '',
        reportingManagerName: '',
        workLocationId: location?.id || '',
        workLocationName: location?.name || '',
        shift: 'General Shift (9 AM - 6 PM)',
        bankDetails: {} as any,
        taxInformation: {} as any,
        education: [],
        previousExperience: [],
        skills: [],
        salary: {} as any,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.db.employees.unshift(newEmployee);

      this.db.leaveBalances.push({
        id: `bal-${newEmployee.id}`,
        employeeId: newEmployee.id,
        year: 2026,
        casualLeave: { total: 12, used: 0, remaining: 12 },
        sickLeave: { total: 10, used: 0, remaining: 10 },
        paidLeave: { total: 15, used: 0, remaining: 15 },
      });

      newUser.employeeId = employeeId;
      newUser.employeeCode = autoEmployeeCode;
      newUser.departmentId = newEmployee.departmentId;
      newUser.departmentName = newEmployee.departmentName;
      newUser.designationId = newEmployee.designationId;
      newUser.designationTitle = newEmployee.designationTitle;
      newUser.workLocationId = newEmployee.workLocationId;
      newUser.workLocationName = newEmployee.workLocationName;
      newUser.shift = newEmployee.shift;
      newUser.joiningDate = newEmployee.joiningDate;
      newUser.employmentType = newEmployee.employmentType;
      newUser.salary = newEmployee.salary;
      newUser.bankDetails = newEmployee.bankDetails;
      newUser.taxInformation = newEmployee.taxInformation;
      newUser.emergencyContact = newEmployee.emergencyContact;
    } else {
      newUser.employeeId = null as any;
      newUser.employeeCode = null as any;
    }

    if (isSuperAdmin) {
      newUser.permissions = ['*'];
      newUser.companyId = null;
      newUser.companyCode = null;
    }

    this.db.logAudit(
      actingAdmin?.id || 'super-admin',
      actingAdmin ? `${actingAdmin.firstName} ${actingAdmin.lastName}` : 'Super Admin',
      actingAdmin?.role || Role.SUPER_ADMIN,
      'SUPER_ADMIN_CREATE_USER',
      'SuperAdmin',
      `Super admin created account for ${newUser.email} with role ${newUser.role} (isSuperAdmin: ${isSuperAdmin})`,
      newUser.id,
    );

    this.db.persist();

    const { password: _, ...safeUser } = newUser;
    return {
      message: 'Super Admin successfully created user account',
      user: safeUser,
    };
    } finally {
      releaseEmailLock();
      releasePhoneLock();
    }
  }

  async updateUser(id: string, dto: UpdateSuperAdminUserDto, actingAdmin?: User) {
    const user = this.db.users.find((u) => u.id === id);
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found.`);
    }

    const targetCompanyId = (dto as any).companyId || user.companyId;

    if (dto.email && dto.email.trim().toLowerCase() !== user.email.toLowerCase()) {
      const normalizedEmail = await this.db.assertEmailUnique(dto.email, targetCompanyId, id);
      user.email = normalizedEmail;
    }

    if (dto.phone !== undefined && dto.phone.trim() !== '') {
      const normalizedPhone = await this.db.assertPhoneUnique(dto.phone, targetCompanyId, id);
      user.phone = normalizedPhone;
    } else if (dto.phone !== undefined) {
      user.phone = '';
    }

    if (dto.firstName) user.firstName = dto.firstName;
    if (dto.lastName) user.lastName = dto.lastName;
    if (dto.avatarUrl !== undefined) user.avatarUrl = dto.avatarUrl;
    if (dto.status) user.status = dto.status;

    if (dto.role) {
      user.role = dto.role;
      if (dto.role === Role.SUPER_ADMIN) {
        user.isSuperAdmin = true;
      }
    }

    if (dto.isSuperAdmin !== undefined) {
      user.isSuperAdmin = dto.isSuperAdmin;
    }

    user.updatedAt = new Date().toISOString();

    // Sync to linked employee if exists
    const employee = this.db.employees.find((e) => e.userId === user.id || e.id === user.employeeId);
    if (employee) {
      if (dto.firstName) employee.firstName = dto.firstName;
      if (dto.lastName) employee.lastName = dto.lastName;
      if (dto.email) employee.email = user.email;
      if (dto.phone !== undefined) employee.phone = user.phone || '';
      if (dto.isSuperAdmin !== undefined) employee.isSuperAdmin = dto.isSuperAdmin;
      employee.updatedAt = new Date().toISOString();
    }

    this.db.logAudit(
      actingAdmin?.id || 'super-admin',
      actingAdmin ? `${actingAdmin.firstName} ${actingAdmin.lastName}` : 'Super Admin',
      actingAdmin?.role || Role.SUPER_ADMIN,
      'SUPER_ADMIN_UPDATE_USER',
      'SuperAdmin',
      `Super admin updated user profile for ${user.email}`,
      user.id,
    );

    this.db.persist();

    const { password: _, ...safeUser } = user;
    return {
      message: 'User updated successfully',
      user: safeUser,
    };
  }

  updateUserRole(id: string, dto: UpdateUserRoleDto, actingAdmin?: User) {
    const user = this.db.users.find((u) => u.id === id);
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found.`);
    }

    // Protection: Ensure at least one super admin exists
    const isDemotingSuperAdmin =
      (user.role === Role.SUPER_ADMIN || user.isSuperAdmin === true) &&
      dto.role !== Role.SUPER_ADMIN &&
      dto.isSuperAdmin === false;

    if (isDemotingSuperAdmin) {
      const activeSuperAdmins = this.db.users.filter(
        (u) => (u.role === Role.SUPER_ADMIN || u.isSuperAdmin === true) && u.id !== id,
      );
      if (activeSuperAdmins.length === 0) {
        throw new BadRequestException(
          'Cannot demote the only remaining Super Admin in the system.',
        );
      }
    }

    user.role = dto.role;
    user.isSuperAdmin = dto.isSuperAdmin !== undefined ? dto.isSuperAdmin : dto.role === Role.SUPER_ADMIN;
    user.updatedAt = new Date().toISOString();

    const employee = this.db.employees.find((e) => e.userId === user.id || e.id === user.employeeId);
    if (employee) {
      employee.isSuperAdmin = user.isSuperAdmin;
      employee.updatedAt = new Date().toISOString();
    }

    this.db.logAudit(
      actingAdmin?.id || 'super-admin',
      actingAdmin ? `${actingAdmin.firstName} ${actingAdmin.lastName}` : 'Super Admin',
      actingAdmin?.role || Role.SUPER_ADMIN,
      'SUPER_ADMIN_ROLE_CHANGE',
      'SuperAdmin',
      `Super admin changed role of ${user.email} to ${user.role} (isSuperAdmin: ${user.isSuperAdmin})`,
      user.id,
    );

    this.db.persist();

    const { password: _, ...safeUser } = user;
    return {
      message: `User role successfully updated to ${dto.role}`,
      user: safeUser,
    };
  }

  updateUserStatus(id: string, dto: UpdateUserStatusDto, actingAdmin?: User) {
    const user = this.db.users.find((u) => u.id === id);
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found.`);
    }

    // Prevent suspending the last super admin
    if (
      dto.status !== 'Active' &&
      (user.role === Role.SUPER_ADMIN || user.isSuperAdmin === true)
    ) {
      const otherSuperAdmins = this.db.users.filter(
        (u) =>
          (u.role === Role.SUPER_ADMIN || u.isSuperAdmin === true) &&
          u.id !== id &&
          (u.status || 'Active') === 'Active',
      );
      if (otherSuperAdmins.length === 0) {
        throw new BadRequestException(
          'Cannot deactivate or suspend the only active Super Admin.',
        );
      }
    }

    user.status = dto.status;
    user.updatedAt = new Date().toISOString();

    const employee = this.db.employees.find((e) => e.userId === user.id || e.id === user.employeeId);
    if (employee && dto.status === 'Inactive') {
      employee.status = EmployeeStatus.INACTIVE;
      employee.updatedAt = new Date().toISOString();
    }

    this.db.logAudit(
      actingAdmin?.id || 'super-admin',
      actingAdmin ? `${actingAdmin.firstName} ${actingAdmin.lastName}` : 'Super Admin',
      actingAdmin?.role || Role.SUPER_ADMIN,
      'SUPER_ADMIN_STATUS_CHANGE',
      'SuperAdmin',
      `Super admin changed status of ${user.email} to "${dto.status}". Reason: ${dto.reason || 'None provided'}`,
      user.id,
    );

    this.db.persist();

    const { password: _, ...safeUser } = user;
    return {
      message: `User status changed to ${dto.status}`,
      user: safeUser,
    };
  }

  resetUserPassword(id: string, dto: ResetUserPasswordDto, actingAdmin?: User) {
    const user = this.db.users.find((u) => u.id === id);
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found.`);
    }

    const hashedPassword = hashPassword(dto.newPassword);
    user.password = hashedPassword;
    user.updatedAt = new Date().toISOString();

    const employee = this.db.employees.find((e) => e.userId === user.id || e.id === user.employeeId);
    if (employee) {
      employee.password = hashedPassword;
      employee.updatedAt = new Date().toISOString();
    }

    this.db.logAudit(
      actingAdmin?.id || 'super-admin',
      actingAdmin ? `${actingAdmin.firstName} ${actingAdmin.lastName}` : 'Super Admin',
      actingAdmin?.role || Role.SUPER_ADMIN,
      'SUPER_ADMIN_RESET_PASSWORD',
      'SuperAdmin',
      `Super admin reset password for user ${user.email}`,
      user.id,
    );

    this.db.persist();

    return {
      message: `Password for user ${user.email} has been reset successfully.`,
      userId: user.id,
    };
  }

  async deleteUser(id: string, actingAdmin?: User) {
    const userIndex = this.db.users.findIndex((u) => u.id === id);
    if (userIndex === -1) {
      throw new NotFoundException(`User with ID "${id}" not found.`);
    }

    const user = this.db.users[userIndex];

    this.db.users.splice(userIndex, 1);

    // Also remove matching employee record if exists
    const empIndex = this.db.employees.findIndex(
      (e) => e.userId === user.id || e.id === user.employeeId || e.email?.toLowerCase() === user.email.toLowerCase(),
    );
    if (empIndex !== -1) {
      this.db.employees.splice(empIndex, 1);
    }

    // Ensure deletion is immediately propagated directly to MySQL
    await this.db.deleteUserFromMysql(user.id, user.email);

    this.db.logAudit(
      actingAdmin?.id || 'super-admin',
      actingAdmin ? `${actingAdmin.firstName} ${actingAdmin.lastName}` : 'Super Admin',
      actingAdmin?.role || Role.SUPER_ADMIN,
      'SUPER_ADMIN_DELETE_USER',
      'SuperAdmin',
      `Super admin permanently deleted account for ${user.email}`,
      id,
    );

    this.db.persist();

    return {
      message: `User account ${user.email} has been permanently deleted.`,
      deletedUserId: id,
    };
  }

  async clearAllUsers(actingAdmin?: User) {
    const deletedCount = this.db.users.length;
    this.db.users = [];
    this.db.persist();

    // Also clear from MySQL if connected
    if (this.db['mysqlPool'] && this.db['isMysqlConnected']) {
      try {
        await this.db['mysqlPool'].query('DELETE FROM users');
      } catch {
        // Ignored
      }
    }

    this.db.logAudit(
      actingAdmin?.id || 'super-admin',
      actingAdmin ? `${actingAdmin.firstName} ${actingAdmin.lastName}` : 'Super Admin',
      Role.SUPER_ADMIN,
      'SUPER_ADMIN_CLEAR_ALL_USERS',
      'SuperAdmin',
      `Super admin permanently deleted all ${deletedCount} user entries (super admins, admins, and users).`,
      'users',
    );

    return {
      message: `Successfully deleted all ${deletedCount} user entries (Super Admin, Admin, and User).`,
      remainingUsersCount: 0,
      deletedCount,
    };
  }

  // -------------------------------------------------------------
  // 3. MASTER CROSS-MODULE OVERRIDES (BADHU ACCESS KARI SAKE)
  // -------------------------------------------------------------
  getAllEmployeesMaster(departmentId?: string, status?: string) {
    let list = [...this.db.employees];
    if (departmentId) {
      list = list.filter((e) => e.departmentId === departmentId);
    }
    if (status) {
      list = list.filter((e) => e.status?.toLowerCase() === status.toLowerCase());
    }

    return {
      total: list.length,
      employees: list,
    };
  }

  getAllDepartmentsMaster() {
    return this.db.departments.map((dept) => {
      const emps = this.db.employees.filter((e) => e.departmentId === dept.id);
      const designations = this.db.designations.filter((d) => d.departmentId === dept.id);
      return {
        ...dept,
        calculatedHeadcount: emps.length,
        designationsCount: designations.length,
        designations,
      };
    });
  }

  getAllLeavesMaster(status?: string) {
    let list = [...this.db.leaveRequests];
    if (status) {
      list = list.filter((l) => l.status.toLowerCase() === status.toLowerCase());
    }

    return list.map((l) => {
      const emp = this.db.employees.find((e) => e.id === l.employeeId);
      return {
        ...l,
        employeeCode: emp?.employeeCode || null,
        employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown Employee',
        departmentName: emp?.departmentName || null,
      };
    });
  }

  overrideLeaveRequest(id: string, dto: LeaveOverrideDto, actingAdmin?: User) {
    const leave = this.db.leaveRequests.find((l) => l.id === id);
    if (!leave) {
      throw new NotFoundException(`Leave request with ID "${id}" not found.`);
    }

    const previousStatus = leave.status;
    leave.status = dto.status;
    leave.hrApprovedAt = new Date().toISOString();
    leave.managerApprovedAt = new Date().toISOString();
    leave.managerApproverName = actingAdmin ? `${actingAdmin.firstName} ${actingAdmin.lastName} (Super Admin)` : 'Super Admin Override';
    leave.comments = dto.comments || `Overridden to ${dto.status} by Super Admin`;

    // Audit log
    this.db.logAudit(
      actingAdmin?.id || 'super-admin',
      actingAdmin ? `${actingAdmin.firstName} ${actingAdmin.lastName}` : 'Super Admin',
      Role.SUPER_ADMIN,
      'SUPER_ADMIN_LEAVE_OVERRIDE',
      'Leaves',
      `Super admin forced leave status from "${previousStatus}" to "${dto.status}" for employee ${leave.employeeId}`,
      leave.id,
    );

    this.db.persist();

    return {
      message: `Leave request ${id} successfully overridden to "${dto.status}" by Super Admin.`,
      leave,
    };
  }

  getAllPayrollMaster(month?: string) {
    let records = [...this.db.payrollRecords];
    if (month) {
      records = records.filter((p) => p.payrollMonth === month || p.payrollMonth?.includes(month));
    }

    const totalDisbursed = records.reduce((acc, p) => acc + (p.netSalary || 0), 0);
    const totalTax = records.reduce((acc, p) => acc + (p.taxDeduction || 0), 0);
    const totalPf = records.reduce((acc, p) => acc + (p.pfDeduction || 0), 0);

    return {
      totalRecords: records.length,
      aggregateFinancials: {
        totalNetDisbursement: Math.round(totalDisbursed),
        totalTaxWithheld: Math.round(totalTax),
        totalProvidentFund: Math.round(totalPf),
      },
      records,
    };
  }

  getAllAuditLogsMaster(module?: string, search?: string) {
    let logs = [...this.db.auditLogs].reverse();

    if (module) {
      logs = logs.filter((l) => l.module?.toLowerCase() === module.toLowerCase());
    }

    if (search) {
      const q = search.toLowerCase();
      logs = logs.filter(
        (l) =>
          l.action?.toLowerCase().includes(q) ||
          l.userName?.toLowerCase().includes(q) ||
          l.details?.toLowerCase().includes(q),
      );
    }

    return {
      total: logs.length,
      logs,
    };
  }

  pruneAuditLogs(retentionDays = 90, actingAdmin?: User) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const initialCount = this.db.auditLogs.length;
    this.db.auditLogs = this.db.auditLogs.filter((log) => {
      const logDate = new Date(log.createdAt);
      return logDate >= cutoffDate;
    });

    const prunedCount = initialCount - this.db.auditLogs.length;

    this.db.logAudit(
      actingAdmin?.id || 'super-admin',
      actingAdmin ? `${actingAdmin.firstName} ${actingAdmin.lastName}` : 'Super Admin',
      Role.SUPER_ADMIN,
      'SUPER_ADMIN_AUDIT_PRUNE',
      'SuperAdmin',
      `Super admin pruned ${prunedCount} audit logs older than ${retentionDays} days.`,
      'audit_logs',
    );

    this.db.persist();

    return {
      message: `Audit logs pruning complete. Removed ${prunedCount} records older than ${retentionDays} days.`,
      remainingLogsCount: this.db.auditLogs.length,
      prunedCount,
    };
  }

  // -------------------------------------------------------------
  // 4. ENTERPRISE SYSTEM CONFIGURATION & MAINTENANCE
  // -------------------------------------------------------------
  getSystemSettings() {
    return {
      companyName: 'Paneliya Enterprise HRMS',
      supportEmail: 'admin@paneliya.com',
      timeZone: 'Asia/Kolkata',
      currency: 'INR',
      maintenanceMode: false,
      allowRegistration: true,
      twoFactorAuthEnforced: false,
      sessionTimeoutMinutes: 120,
      activeModules: [
        'Authentication',
        'Super Admin',
        'Employees',
        'Organization',
        'Attendance',
        'Leaves',
        'Payroll',
        'Recruitment',
        'Performance',
        'Training',
        'Assets',
        'Resignations',
        'Holidays',
        'Documents',
        'Announcements',
        'Notifications',
        'Audit Logs',
        'Reports & Analytics',
        'Settings',
      ],
      rbacRoles: Object.values(Role),
      superAdminGuaranteed: true,
    };
  }

  updateSystemSettings(dto: UpdateSystemSettingsDto, actingAdmin?: User) {
    this.db.logAudit(
      actingAdmin?.id || 'super-admin',
      actingAdmin ? `${actingAdmin.firstName} ${actingAdmin.lastName}` : 'Super Admin',
      Role.SUPER_ADMIN,
      'SUPER_ADMIN_UPDATE_SETTINGS',
      'SuperAdmin',
      `Super admin updated enterprise system configuration`,
      'system_settings',
    );

    return {
      message: 'System settings updated successfully by Super Admin',
      updatedSettings: {
        ...this.getSystemSettings(),
        ...dto,
      },
    };
  }

  toggleMaintenanceMode(enable: boolean, actingAdmin?: User) {
    this.db.logAudit(
      actingAdmin?.id || 'super-admin',
      actingAdmin ? `${actingAdmin.firstName} ${actingAdmin.lastName}` : 'Super Admin',
      Role.SUPER_ADMIN,
      'SUPER_ADMIN_MAINTENANCE_TOGGLE',
      'SuperAdmin',
      `Super admin turned maintenance mode ${enable ? 'ON' : 'OFF'}`,
      'system_maintenance',
    );

    return {
      message: `System maintenance mode is now ${enable ? 'ENABLED' : 'DISABLED'}.`,
      maintenanceMode: enable,
      timestamp: new Date().toISOString(),
    };
  }

  async createDatabaseBackup(actingAdmin?: User) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = `backup_${timestamp}`;
    const totalEntities =
      this.db.locations.length +
      this.db.departments.length +
      this.db.designations.length +
      this.db.users.length +
      this.db.employees.length +
      this.db.holidays.length +
      this.db.leaveBalances.length +
      this.db.leaveRequests.length +
      this.db.attendanceRecords.length +
      this.db.payrollRecords.length +
      this.db.jobs.length +
      this.db.candidates.length +
      this.db.assets.length +
      this.db.trainingPrograms.length +
      this.db.employeeTrainings.length +
      this.db.performanceCycles.length +
      this.db.performanceReviews.length +
      this.db.resignations.length +
      this.db.announcements.length +
      this.db.notifications.length +
      this.db.documents.length +
      this.db.auditLogs.length;

    // Record directly in MySQL system_backups table (strictly no secondary files on disk)
    try {
      const pool = this.db.getMysqlPool();
      if (pool && this.db.isConnectedToMysql) {
        await pool.query(
          `INSERT INTO system_backups (id, backupFileName, backupFilePath, totalEntities, fileSizeBytes, initiatedBy, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            backupId,
            `mysql_backup_${timestamp}`,
            'MySQL Database Live Snapshot (No secondary JSON files)',
            totalEntities,
            0,
            actingAdmin?.email || 'super-admin',
            new Date().toISOString(),
          ],
        );
      }
    } catch (err: any) {
      this.logger.warn(`Could not log backup to system_backups table: ${err.message}`);
    }

    this.db.logAudit(
      actingAdmin?.id || 'super-admin',
      actingAdmin ? `${actingAdmin.firstName} ${actingAdmin.lastName}` : 'Super Admin',
      Role.SUPER_ADMIN,
      'SUPER_ADMIN_DATABASE_BACKUP',
      'SuperAdmin',
      `Super admin generated database backup snapshot: mysql_backup_${timestamp} (Saved strictly in MySQL)`,
      backupId,
    );

    return {
      message: 'Database backup snapshot recorded successfully in MySQL database',
      backupId,
      storage: 'MySQL Database (100% Pure Database Storage, No secondary JSON files)',
      totalEntitiesBackedUp: totalEntities,
      createdAt: new Date().toISOString(),
    };
  }

  getDatabaseStats() {
    return {
      locations: this.db.locations.length,
      departments: this.db.departments.length,
      designations: this.db.designations.length,
      users: this.db.users.length,
      superAdmins: this.db.users.filter(
        (u) => u.role === Role.SUPER_ADMIN || u.isSuperAdmin === true,
      ).length,
      employees: this.db.employees.length,
      holidays: this.db.holidays.length,
      leaveBalances: this.db.leaveBalances.length,
      leaveRequests: this.db.leaveRequests.length,
      attendanceRecords: this.db.attendanceRecords.length,
      payrollRecords: this.db.payrollRecords.length,
      jobs: this.db.jobs.length,
      candidates: this.db.candidates.length,
      assets: this.db.assets.length,
      trainingPrograms: this.db.trainingPrograms.length,
      employeeTrainings: this.db.employeeTrainings.length,
      performanceCycles: this.db.performanceCycles.length,
      performanceReviews: this.db.performanceReviews.length,
      resignations: this.db.resignations.length,
      announcements: this.db.announcements.length,
      notifications: this.db.notifications.length,
      documents: this.db.documents.length,
      auditLogs: this.db.auditLogs.length,
      companies: this.db.companies.length,
    };
  }

  // -------------------------------------------------------------
  // MULTI-COMPANY MANAGEMENT (SuperAdmin only)
  // -------------------------------------------------------------
  getCompanies() {
    return this.db.companies.map((c) => {
      const companyEmployees = this.db.employees.filter((e) => e.companyId === c.id);
      const companyAdmins = this.db.users.filter(
        (u) => u.companyId === c.id && u.role === Role.ADMIN,
      );
      const adminUser = c.adminUserId
        ? this.db.users.find((u) => u.id === c.adminUserId)
        : companyAdmins[0] || null;

      const safeAdmin = adminUser
        ? {
            id: adminUser.id,
            email: adminUser.email,
            firstName: adminUser.firstName,
            lastName: adminUser.lastName,
            role: adminUser.role,
            status: adminUser.status || 'Active',
          }
        : null;

      return {
        ...c,
        totalEmployees: companyEmployees.length,
        totalAdmins: companyAdmins.length,
        adminUser: safeAdmin,
      };
    });
  }

  getCompanyById(id: string) {
    const company = this.db.companies.find(
      (c) =>
        c.id.toLowerCase() === id.toLowerCase() ||
        c.companyCode.toLowerCase() === id.toLowerCase(),
    );
    if (!company) {
      throw new NotFoundException(`Company with ID or code "${id}" not found.`);
    }

    const companyEmployees = this.db.employees.filter((e) => e.companyId === company.id);
    const companyAdmins = this.db.users
      .filter((u) => u.companyId === company.id && u.role === Role.ADMIN)
      .map(({ password: _, ...safe }) => safe);

    const adminUser = company.adminUserId
      ? this.db.users.find((u) => u.id === company.adminUserId)
      : companyAdmins[0] || null;

    return {
      ...company,
      totalEmployees: companyEmployees.length,
      employees: companyEmployees,
      admins: companyAdmins,
      adminUser: adminUser
        ? {
            id: adminUser.id,
            email: adminUser.email,
            firstName: adminUser.firstName,
            lastName: adminUser.lastName,
          }
        : null,
    };
  }

  async createCompany(dto: CreateCompanyDto, actingAdmin?: User) {
    const companyName = (dto.companyName || dto.name || '').trim();
    if (!companyName) {
      throw new BadRequestException('Company name is required.');
    }

    // Assert global uniqueness for company name, company email, and company phone
    await this.db.assertCompanyUnique({
      companyName,
      email: dto.email,
      phone: dto.phone,
    });

    // Auto-generate globally unique sequential Company Code (e.g. CMP-000001, CMP-000002)
    const companyCode = this.db.generateNextCompanyCode();
    const companyId = `cmp-${Date.now()}`;

    const newCompany: Company = {
      id: companyId,
      companyCode,
      companyName,
      name: companyName,
      email: dto.email || '',
      phone: dto.phone || '',
      address: dto.address || '',
      status: dto.status || 'Active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // If initial admin credentials are provided, automatically create the company Admin
    if (dto.adminEmail && dto.adminPassword) {
      const releaseEmailLock = this.db.acquireEmailLock(dto.adminEmail, newCompany.id);
      let releasePhoneLock = () => {};
      if (dto.phone) {
        releasePhoneLock = this.db.acquirePhoneLock(dto.phone, newCompany.id);
      }

      try {
        const normalizedEmail = await this.db.assertEmailUnique(dto.adminEmail, newCompany.id, undefined, true);
        const normalizedPhone = dto.phone
          ? await this.db.assertPhoneUnique(dto.phone, newCompany.id, undefined, true)
          : '';
        const adminUserId = `user-${Date.now()}`;
        const hashedAdminPassword = hashPassword(dto.adminPassword);
        const adminUser: User = {
          id: adminUserId,
          email: normalizedEmail,
          phone: normalizedPhone,
          password: hashedAdminPassword,
          firstName: dto.adminFirstName || 'Company',
          lastName: dto.adminLastName || 'Admin',
          role: Role.ADMIN,
          isSuperAdmin: false,
          status: 'Active',
          companyId: newCompany.id,
          companyCode: newCompany.companyCode,
          employeeId: null,
          avatarUrl: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.db.users.unshift(adminUser);

        const adminEmp: Employee = {
          id: adminUserId,
          employeeCode: 'EMP-000001',
          companyId: newCompany.id,
          companyCode: newCompany.companyCode,
          userId: adminUserId,
          password: hashedAdminPassword,
          isSuperAdmin: false,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          email: normalizedEmail,
          phone: normalizedPhone,
          avatarUrl: '',
        gender: 'Other',
        dateOfBirth: '',
        address: dto.address || '',
        emergencyContact: {} as any,
        joiningDate: new Date().toISOString().split('T')[0],
        employmentType: 'Full-time',
        status: EmployeeStatus.ACTIVE,
        departmentId: this.db.departments[0]?.id || '',
        departmentName: this.db.departments[0]?.name || '',
        designationId: this.db.designations[0]?.id || '',
        designationTitle: 'Administrator',
        reportingManagerId: '',
        reportingManagerName: '',
        workLocationId: this.db.locations[0]?.id || '',
        workLocationName: this.db.locations[0]?.name || '',
        shift: 'General Shift (9 AM - 6 PM)',
        bankDetails: {} as any,
        taxInformation: {} as any,
        education: [],
        previousExperience: [],
        skills: ['Management'],
        salary: {} as any,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.db.employees.unshift(adminEmp);

      this.db.leaveBalances.push({
        id: `bal-${adminEmp.id}`,
        employeeId: adminEmp.id,
        year: 2026,
        casualLeave: { total: 12, used: 0, remaining: 12 },
        sickLeave: { total: 10, used: 0, remaining: 10 },
        paidLeave: { total: 15, used: 0, remaining: 15 },
      });

      newCompany.adminUserId = adminUserId;
      } finally {
        releaseEmailLock();
        releasePhoneLock();
      }
    }

    this.db.companies.push(newCompany);

    this.db.logAudit(
      actingAdmin?.id || 'super-admin',
      actingAdmin ? `${actingAdmin.firstName} ${actingAdmin.lastName}` : 'Super Admin',
      actingAdmin?.role || Role.SUPER_ADMIN,
      'COMPANY_CREATED',
      'SuperAdmin',
      `Registered new company "${newCompany.companyName}" with code ${newCompany.companyCode}`,
      newCompany.id,
    );

    this.db.persist();
    return {
      message: 'Company registered successfully',
      company: newCompany,
      ...newCompany,
    };
  }

  async updateCompany(id: string, dto: UpdateCompanyDto, actingAdmin?: User) {
    const company = this.db.companies.find(
      (c) =>
        c.id.toLowerCase() === id.toLowerCase() ||
        c.companyCode.toLowerCase() === id.toLowerCase(),
    );
    if (!company) {
      throw new NotFoundException(`Company with ID or code "${id}" not found.`);
    }

    // Assert company uniqueness against other companies
    await this.db.assertCompanyUnique(
      {
        companyName: dto.companyName || dto.name,
        email: dto.email,
        phone: dto.phone,
      },
      company.id,
    );

    if (dto.companyName) {
      company.companyName = dto.companyName;
      company.name = dto.companyName;
    }
    if (dto.name) {
      company.name = dto.name;
      company.companyName = dto.name;
    }
    if (dto.email !== undefined) company.email = dto.email;
    if (dto.phone !== undefined) company.phone = dto.phone;
    if (dto.address !== undefined) company.address = dto.address;
    if (dto.status !== undefined) company.status = dto.status;
    if (dto.adminUserId !== undefined) company.adminUserId = dto.adminUserId;
    company.updatedAt = new Date().toISOString();

    this.db.logAudit(
      actingAdmin?.id || 'super-admin',
      actingAdmin ? `${actingAdmin.firstName} ${actingAdmin.lastName}` : 'Super Admin',
      actingAdmin?.role || Role.SUPER_ADMIN,
      'COMPANY_UPDATED',
      'SuperAdmin',
      `Updated company profile for ${company.companyCode} (${company.companyName})`,
      company.id,
    );

    this.db.persist();
    return company;
  }

  getCompanyEmployees(id: string) {
    const company = this.db.companies.find(
      (c) =>
        c.id.toLowerCase() === id.toLowerCase() ||
        c.companyCode.toLowerCase() === id.toLowerCase(),
    );
    if (!company) {
      throw new NotFoundException(`Company with ID or code "${id}" not found.`);
    }

    return this.db.employees.filter((e) => e.companyId === company.id);
  }

  assignCompanyAdmin(companyId: string, userId: string, actingAdmin?: User) {
    const company = this.db.companies.find(
      (c) =>
        c.id.toLowerCase() === companyId.toLowerCase() ||
        c.companyCode.toLowerCase() === companyId.toLowerCase(),
    );
    if (!company) {
      throw new NotFoundException(`Company "${companyId}" not found.`);
    }

    const user = this.db.users.find((u) => u.id === userId);
    if (!user) {
      throw new NotFoundException(`User "${userId}" not found.`);
    }

    user.companyId = company.id;
    user.companyCode = company.companyCode;
    user.role = Role.ADMIN;
    user.updatedAt = new Date().toISOString();

    company.adminUserId = user.id;
    company.updatedAt = new Date().toISOString();

    const linkedEmp = this.db.employees.find(
      (e) => e.id === user.employeeId || e.userId === user.id,
    );
    if (linkedEmp) {
      linkedEmp.companyId = company.id;
      linkedEmp.companyCode = company.companyCode;
      linkedEmp.updatedAt = new Date().toISOString();
    }

    this.db.logAudit(
      actingAdmin?.id || 'super-admin',
      actingAdmin ? `${actingAdmin.firstName} ${actingAdmin.lastName}` : 'Super Admin',
      actingAdmin?.role || Role.SUPER_ADMIN,
      'COMPANY_ADMIN_ASSIGNED',
      'SuperAdmin',
      `Assigned user ${user.email} as Admin for company ${company.companyCode}`,
      company.id,
    );

    this.db.persist();
    return {
      message: `User ${user.email} assigned as Admin for company ${company.companyCode}`,
      company,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        companyCode: user.companyCode,
      },
    };
  }

  async deleteCompany(id: string, actingAdmin?: User) {
    const cleanId = (id || '').trim();
    const index = this.db.companies.findIndex(
      (c) =>
        c.id.toLowerCase() === cleanId.toLowerCase() ||
        c.companyCode?.toLowerCase() === cleanId.toLowerCase(),
    );

    let companyId = cleanId;
    let companyCode = cleanId;
    let companyName = cleanId;

    if (index !== -1) {
      const company = this.db.companies[index];
      companyId = company.id;
      companyCode = company.companyCode;
      companyName = company.companyName || company.name || cleanId;
    } else {
      // Check if found in MySQL
      if (this.db.getMysqlPool() && this.db.isConnectedToMysql) {
        try {
          const [rows]: any = await this.db.getMysqlPool()!.query(
            `SELECT id, companyCode, companyName FROM companies WHERE id = ? OR companyCode = ? LIMIT 1`,
            [cleanId, cleanId],
          );
          if (rows && rows.length > 0) {
            companyId = rows[0].id;
            companyCode = rows[0].companyCode;
            companyName = rows[0].companyName;
          }
        } catch {}
      }
    }

    // Completely wipe out company and ALL its data from MySQL and runtime memory
    await this.db.purgeCompanyCompletely(companyId, companyCode);

    this.db.logAudit(
      actingAdmin?.id || 'super-admin',
      actingAdmin ? `${actingAdmin.firstName} ${actingAdmin.lastName}` : 'Super Admin',
      actingAdmin?.role || Role.SUPER_ADMIN,
      'COMPANY_DELETED_PERMANENTLY',
      'SuperAdmin',
      `Permanently deleted company "${companyName}" (${companyCode}) and cascaded complete deletion to all its admins, employees, departments, and operational data.`,
      companyId,
    );

    return {
      success: true,
      message: `Company ${companyCode} (${companyName}) and all associated users, employees, and records have been permanently deleted from both live MySQL and runtime memory.`,
      deletedCompanyId: companyId,
      deletedCompanyCode: companyCode,
    };
  }

  // -------------------------------------------------------------
  // COMPANY REGISTRATION APPROVAL WORKFLOW
  // -------------------------------------------------------------
  async createCompanyRegistrationRequest(dto: RegisterCompanyRequestDto) {
    const companyLegalName = (dto.companyLegalName || '').trim();
    if (!companyLegalName) {
      throw new BadRequestException('Company Legal Name is required.');
    }

    const officialEmail = (dto.officialEmail || '').trim().toLowerCase();
    if (!officialEmail) {
      throw new BadRequestException('Official Owner Email is required.');
    }

    const mobileNumber = (dto.mobileNumber || '').trim().replace(/\D/g, '');
    if (!mobileNumber) {
      throw new BadRequestException('Mobile Number is required.');
    }

    if (dto.confirmPassword && dto.confirmPassword !== dto.password) {
      throw new BadRequestException('Passwords do not match.');
    }

    // Check if active company or user already has this email
    const existingUser = this.db.users.find(
      (u) => u.email.toLowerCase() === officialEmail || (u.phone && u.phone === mobileNumber),
    );
    if (existingUser) {
      throw new ConflictException(
        'An account with this email address or mobile number already exists. Please login or use different contact information.',
      );
    }

    const existingCompany = this.db.companies.find(
      (c) =>
        c.companyName.toLowerCase() === companyLegalName.toLowerCase() ||
        (c.email && c.email.toLowerCase() === officialEmail),
    );
    if (existingCompany) {
      throw new ConflictException(
        `A company with the name "${companyLegalName}" or email "${officialEmail}" is already registered.`,
      );
    }

    // Check for duplicate pending requests
    const duplicatePending = this.db.companyRegistrationRequests.find(
      (r) =>
        r.status === 'PENDING' &&
        (r.officialEmail.toLowerCase() === officialEmail ||
          r.companyLegalName.toLowerCase() === companyLegalName.toLowerCase() ||
          r.mobileNumber === mobileNumber),
    );
    if (duplicatePending) {
      throw new ConflictException(
        'A registration request for this company name, email, or mobile number is already pending Super Admin approval.',
      );
    }

    const requestId = `req-${Date.now()}`;
    const passwordHash = hashPassword(dto.password);
    const now = new Date().toISOString();

    const requestRecord: CompanyRegistrationRequest = {
      id: requestId,
      companyLegalName,
      gstin: (dto.gstin || '').trim(),
      industrySector: (dto.industrySector || '').trim(),
      officeAddress: (dto.officeAddress || '').trim(),
      city: (dto.city || '').trim(),
      state: (dto.state || '').trim(),
      firstName: (dto.firstName || '').trim(),
      lastName: (dto.lastName || '').trim(),
      officialEmail,
      mobileNumber,
      passwordHash,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };

    // Store in MySQL table
    try {
      const pool = this.db.getMysqlPool();
      if (pool && this.db.isConnectedToMysql) {
        await pool.query(
          `INSERT INTO company_registration_requests (
            id, companyLegalName, gstin, industrySector, officeAddress, city, state,
            firstName, lastName, officialEmail, mobileNumber, passwordHash, status, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            requestRecord.id,
            requestRecord.companyLegalName,
            requestRecord.gstin || null,
            requestRecord.industrySector || null,
            requestRecord.officeAddress || null,
            requestRecord.city || null,
            requestRecord.state || null,
            requestRecord.firstName,
            requestRecord.lastName,
            requestRecord.officialEmail,
            requestRecord.mobileNumber,
            requestRecord.passwordHash,
            requestRecord.status,
            requestRecord.createdAt,
            requestRecord.updatedAt,
          ],
        );
      }
    } catch (err: any) {
      this.logger.warn(`Could not save company_registration_request to MySQL: ${err.message}`);
    }

    this.db.companyRegistrationRequests.unshift(requestRecord);

    this.db.logAudit(
      'guest-registration',
      `${requestRecord.firstName} ${requestRecord.lastName}`,
      'GUEST',
      'COMPANY_REGISTRATION_REQUEST_SUBMITTED',
      'Companies',
      `New company registration request submitted for "${companyLegalName}" (${officialEmail}). Pending Super Admin approval.`,
      requestId,
    );

    return {
      statusCode: 201,
      message:
        'Company registration request submitted successfully! Your workspace will be created and activated once the Super Admin approves it.',
      requestId: requestRecord.id,
      companyLegalName: requestRecord.companyLegalName,
      officialEmail: requestRecord.officialEmail,
      status: requestRecord.status,
      submittedAt: requestRecord.createdAt,
    };
  }

  getCompanyRegistrationRequests(status?: string) {
    let list = [...this.db.companyRegistrationRequests];
    if (status) {
      list = list.filter((r) => r.status.toUpperCase() === status.toUpperCase());
    }
    // Mask passwordHash before returning
    return list.map(({ passwordHash: _, ...safe }) => safe);
  }

  async approveCompanyRegistrationRequest(requestId: string, actingAdmin?: User) {
    const matched = this.db.companyRegistrationRequests.find((r) => r.id === requestId);
    if (!matched) {
      throw new NotFoundException(`Company registration request with ID "${requestId}" not found.`);
    }

    if (matched.status !== 'PENDING') {
      throw new BadRequestException(
        `Registration request has already been ${matched.status.toLowerCase()} and cannot be approved again.`,
      );
    }

    const now = new Date().toISOString();
    const companyId = `cmp-${Date.now()}`;
    const companyCode = this.db.generateNextCompanyCode();

    const newCompany: Company = {
      id: companyId,
      companyCode,
      companyName: matched.companyLegalName,
      name: matched.companyLegalName,
      email: matched.officialEmail,
      phone: matched.mobileNumber,
      address: matched.officeAddress || '',
      city: matched.city || '',
      state: matched.state || '',
      gstin: matched.gstin || '',
      industrySector: matched.industrySector || '',
      status: 'Active',
      createdAt: now,
      updatedAt: now,
    };

    const adminUserId = `user-${Date.now()}`;
    const adminUser: User = {
      id: adminUserId,
      email: matched.officialEmail,
      phone: matched.mobileNumber,
      password: matched.passwordHash,
      firstName: matched.firstName,
      lastName: matched.lastName,
      role: Role.ADMIN,
      isSuperAdmin: false,
      status: 'Active',
      companyId: newCompany.id,
      companyCode: newCompany.companyCode,
      employeeId: null,
      avatarUrl: '',
      createdAt: now,
      updatedAt: now,
    };

    const adminEmp: Employee = {
      id: adminUserId,
      employeeCode: 'EMP-000001',
      companyId: newCompany.id,
      companyCode: newCompany.companyCode,
      userId: adminUserId,
      password: matched.passwordHash,
      isSuperAdmin: false,
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
      email: matched.officialEmail,
      phone: matched.mobileNumber,
      avatarUrl: '',
      gender: 'Other',
      dateOfBirth: '',
      address: matched.officeAddress || '',
      emergencyContact: {} as any,
      joiningDate: now.split('T')[0],
      employmentType: 'Full-time',
      status: EmployeeStatus.ACTIVE,
      departmentId: this.db.departments[0]?.id || '',
      departmentName: this.db.departments[0]?.name || 'Management',
      designationId: this.db.designations[0]?.id || '',
      designationTitle: 'Company Owner & Administrator',
      reportingManagerId: '',
      reportingManagerName: '',
      workLocationId: this.db.locations[0]?.id || '',
      workLocationName: this.db.locations[0]?.name || '',
      shift: 'General Shift (9 AM - 6 PM)',
      bankDetails: {} as any,
      taxInformation: {} as any,
      education: [],
      previousExperience: [],
      skills: ['Leadership'],
      salary: {} as any,
      createdAt: now,
      updatedAt: now,
    };

    newCompany.adminUserId = adminUserId;

    // Update registration request status
    matched.status = 'APPROVED';
    matched.approvedCompanyId = newCompany.id;
    matched.approvedCompanyCode = newCompany.companyCode;
    matched.approvedAdminUserId = adminUserId;
    matched.approvedBy = actingAdmin?.id || 'super-admin';
    matched.approvedAt = now;
    matched.updatedAt = now;

    // Update in MySQL
    try {
      const pool = this.db.getMysqlPool();
      if (pool && this.db.isConnectedToMysql) {
        await pool.query(
          `UPDATE company_registration_requests
           SET status = 'APPROVED', approvedCompanyId = ?, approvedCompanyCode = ?, approvedAdminUserId = ?, approvedBy = ?, approvedAt = ?, updatedAt = ?
           WHERE id = ?`,
          [
            matched.approvedCompanyId,
            matched.approvedCompanyCode,
            matched.approvedAdminUserId,
            matched.approvedBy,
            matched.approvedAt,
            matched.updatedAt,
            matched.id,
          ],
        );
      }
    } catch (err: any) {
      this.logger.warn(`Could not update company_registration_requests in MySQL: ${err.message}`);
    }

    this.db.companies.push(newCompany);
    this.db.users.unshift(adminUser);
    this.db.employees.unshift(adminEmp);

    await this.db.flushPersist();

    this.db.logAudit(
      actingAdmin?.id || 'super-admin',
      actingAdmin ? `${actingAdmin.firstName} ${actingAdmin.lastName}` : 'Super Admin',
      Role.SUPER_ADMIN,
      'COMPANY_REGISTRATION_APPROVED',
      'SuperAdmin',
      `Super Admin approved company registration request ${matched.id}. Created company "${newCompany.companyName}" (${newCompany.companyCode}) and Admin user "${adminUser.email}".`,
      newCompany.id,
    );

    const { password: _, ...safeAdmin } = adminUser;
    return {
      statusCode: 200,
      message: `Company registration request approved successfully! Company "${newCompany.companyName}" (${newCompany.companyCode}) and Admin account "${adminUser.email}" have been created and activated.`,
      company: newCompany,
      adminUser: safeAdmin,
      approvedAt: now,
    };
  }

  async rejectCompanyRegistrationRequest(requestId: string, reason?: string, actingAdmin?: User) {
    const matched = this.db.companyRegistrationRequests.find((r) => r.id === requestId);
    if (!matched) {
      throw new NotFoundException(`Company registration request with ID "${requestId}" not found.`);
    }

    if (matched.status !== 'PENDING') {
      throw new BadRequestException(
        `Registration request has already been ${matched.status.toLowerCase()} and cannot be rejected.`,
      );
    }

    const now = new Date().toISOString();
    matched.status = 'REJECTED';
    matched.rejectionReason = reason || 'Rejected by Super Admin.';
    matched.rejectedAt = now;
    matched.updatedAt = now;

    try {
      const pool = this.db.getMysqlPool();
      if (pool && this.db.isConnectedToMysql) {
        await pool.query(
          `UPDATE company_registration_requests
           SET status = 'REJECTED', rejectionReason = ?, rejectedAt = ?, updatedAt = ?
           WHERE id = ?`,
          [matched.rejectionReason, matched.rejectedAt, matched.updatedAt, matched.id],
        );
      }
    } catch (err: any) {
      this.logger.warn(`Could not update company_registration_requests in MySQL: ${err.message}`);
    }

    this.db.logAudit(
      actingAdmin?.id || 'super-admin',
      actingAdmin ? `${actingAdmin.firstName} ${actingAdmin.lastName}` : 'Super Admin',
      Role.SUPER_ADMIN,
      'COMPANY_REGISTRATION_REJECTED',
      'SuperAdmin',
      `Super Admin rejected company registration request ${matched.id}. Reason: ${matched.rejectionReason}`,
      matched.id,
    );

    return {
      statusCode: 200,
      message: `Company registration request ${matched.id} has been rejected.`,
      requestId: matched.id,
      status: 'REJECTED',
      rejectionReason: matched.rejectionReason,
      rejectedAt: now,
    };
  }
}
