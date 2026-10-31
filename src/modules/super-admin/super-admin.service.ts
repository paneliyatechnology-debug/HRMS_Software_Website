import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
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
} from '../../common/types.js';
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
    const releaseLock = this.db.acquireEmailLock(dto.email);

    try {
      const normalizedEmail = await this.db.assertEmailUnique(dto.email, undefined, true);

      const targetCompany = this.db.companies.find(
        (c) => c.id === dto.companyId || c.companyCode === dto.companyId,
      );
      if (!targetCompany) {
        throw new NotFoundException(
          `Company with ID or code "${dto.companyId}" not found. Please provide an existing company.`,
        );
      }

      const userId = `user-${Date.now()}`;
      const hashedPassword = hashPassword(dto.password);

      const newAdmin: User = {
        id: userId,
        email: normalizedEmail,
        phone: dto.phone || '',
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
      releaseLock();
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

    if (dto.email && dto.email.trim().toLowerCase() !== user.email.toLowerCase()) {
      const normalizedEmail = await this.db.assertEmailUnique(dto.email, user.id);
      user.email = normalizedEmail;
    }

    if (dto.firstName) user.firstName = dto.firstName;
    if (dto.lastName) user.lastName = dto.lastName;
    if (dto.phone !== undefined) user.phone = dto.phone;
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
    const releaseLock = this.db.acquireEmailLock(dto.email);

    try {
      const normalizedEmail = await this.db.assertEmailUnique(dto.email, undefined, true);

    const userId = `user-${Date.now()}`;
    const role = dto.role || Role.SUPER_ADMIN;
    const employeeId = role === Role.EMPLOYEE ? userId : null;
    const isSuperAdmin = dto.isSuperAdmin !== undefined ? dto.isSuperAdmin : role === Role.SUPER_ADMIN;
    const status = dto.status || 'Active';

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

    const hashedPassword = hashPassword(dto.password);

    const newUser: User = {
      id: userId,
      email: normalizedEmail,
      phone: dto.phone || '',
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
      releaseLock();
    }
  }

  async updateUser(id: string, dto: UpdateSuperAdminUserDto, actingAdmin?: User) {
    const user = this.db.users.find((u) => u.id === id);
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found.`);
    }

    if (dto.email && dto.email.trim().toLowerCase() !== user.email.toLowerCase()) {
      const normalizedEmail = await this.db.assertEmailUnique(dto.email, id);
      user.email = normalizedEmail;
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

  deleteUser(id: string, actingAdmin?: User) {
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

  createDatabaseBackup(actingAdmin?: User) {
    const dataDir = path.resolve(process.cwd(), 'data');
    const backupsDir = path.join(dataDir, 'backups');

    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup_hrms_${timestamp}.json`;
    const backupFilePath = path.join(backupsDir, backupFileName);

    const snapshot = {
      timestamp: new Date().toISOString(),
      initiatedBy: actingAdmin?.email || 'super-admin',
      version: '1.0.0',
      data: {
        locations: this.db.locations,
        departments: this.db.departments,
        designations: this.db.designations,
        users: this.db.users,
        employees: this.db.employees,
        holidays: this.db.holidays,
        leaveBalances: this.db.leaveBalances,
        leaveRequests: this.db.leaveRequests,
        attendanceRecords: this.db.attendanceRecords,
        payrollRecords: this.db.payrollRecords,
        jobs: this.db.jobs,
        candidates: this.db.candidates,
        assets: this.db.assets,
        trainingPrograms: this.db.trainingPrograms,
        employeeTrainings: this.db.employeeTrainings,
        performanceCycles: this.db.performanceCycles,
        performanceReviews: this.db.performanceReviews,
        resignations: this.db.resignations,
        announcements: this.db.announcements,
        notifications: this.db.notifications,
        documents: this.db.documents,
        auditLogs: this.db.auditLogs,
      },
    };

    fs.writeFileSync(backupFilePath, JSON.stringify(snapshot, null, 2), 'utf-8');

    this.db.logAudit(
      actingAdmin?.id || 'super-admin',
      actingAdmin ? `${actingAdmin.firstName} ${actingAdmin.lastName}` : 'Super Admin',
      Role.SUPER_ADMIN,
      'SUPER_ADMIN_DATABASE_BACKUP',
      'SuperAdmin',
      `Super admin generated database backup snapshot: ${backupFileName}`,
      backupFileName,
    );

    return {
      message: 'Database backup snapshot generated successfully',
      backupFileName,
      backupFilePath,
      totalEntitiesBackedUp: Object.keys(snapshot.data).length,
      createdAt: snapshot.timestamp,
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
      const releaseLock = this.db.acquireEmailLock(dto.adminEmail);

      try {
        const normalizedEmail = await this.db.assertEmailUnique(dto.adminEmail, undefined, true);
        const adminUserId = `user-${Date.now()}`;
        const hashedAdminPassword = hashPassword(dto.adminPassword);
        const adminUser: User = {
          id: adminUserId,
          email: normalizedEmail,
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
          phone: dto.phone || '',
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
        releaseLock();
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

  updateCompany(id: string, dto: UpdateCompanyDto, actingAdmin?: User) {
    const company = this.db.companies.find(
      (c) =>
        c.id.toLowerCase() === id.toLowerCase() ||
        c.companyCode.toLowerCase() === id.toLowerCase(),
    );
    if (!company) {
      throw new NotFoundException(`Company with ID or code "${id}" not found.`);
    }

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

  deleteCompany(id: string, actingAdmin?: User) {
    const index = this.db.companies.findIndex(
      (c) =>
        c.id.toLowerCase() === id.toLowerCase() ||
        c.companyCode.toLowerCase() === id.toLowerCase(),
    );
    if (index === -1) {
      throw new NotFoundException(`Company with ID or code "${id}" not found.`);
    }

    const company = this.db.companies[index];
    this.db.companies.splice(index, 1);

    // Also remove employees belonging to this company
    this.db.employees = this.db.employees.filter((e) => e.companyId !== company.id);

    // Remove non-super-admin users belonging to this company
    this.db.users = this.db.users.filter(
      (u) => u.companyId !== company.id || u.role === Role.SUPER_ADMIN,
    );

    this.db.logAudit(
      actingAdmin?.id || 'super-admin',
      actingAdmin ? `${actingAdmin.firstName} ${actingAdmin.lastName}` : 'Super Admin',
      actingAdmin?.role || Role.SUPER_ADMIN,
      'COMPANY_DELETED',
      'SuperAdmin',
      `Deleted company "${company.companyName}" (${company.companyCode})`,
      company.id,
    );

    this.db.persist();
    return {
      message: `Company ${company.companyCode} (${company.companyName}) deleted successfully`,
      deletedCompanyId: company.id,
    };
  }
}
