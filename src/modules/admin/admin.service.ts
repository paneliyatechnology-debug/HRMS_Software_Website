import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import {
  Company,
  User,
  Employee,
  Role,
  EmployeeStatus,
  AttendanceStatus,
  LeaveStatus,
  LeaveType,
  AttendanceRecord,
  LeaveRequest,
  Department,
  Designation,
} from '../../common/types.js';
import { hashPassword } from '../../common/utils/password.util.js';
import { normalizeEmail } from '../../common/utils/email.util.js';
import { CreateAdminEmployeeDto } from './dto/create-admin-employee.dto.js';
import { UpdateAdminEmployeeDto } from './dto/update-admin-employee.dto.js';
import { QueryAdminEmployeesDto } from './dto/query-admin-employees.dto.js';
import { UpdateAdminCompanyDto } from './dto/update-admin-company.dto.js';
import { AdminManualAttendanceDto } from './dto/admin-manual-attendance.dto.js';
import { CreateAdminDepartmentDto } from './dto/create-admin-department.dto.js';
import { CreateAdminDesignationDto } from './dto/create-admin-designation.dto.js';
import { EmployeeInvitationService } from '../employees/employee-invitation.service.js';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly invitationService: EmployeeInvitationService,
  ) {}

  /**
   * Strictly enforces company-level data isolation.
   * Company Admins are strictly scoped to their assigned company.
   * Super Admins can optionally pass a companyId or default to the primary company.
   */
  public resolveTargetCompany(actor?: User, companyIdOverride?: string): Company {
    if (!actor || !actor.id) {
      throw new UnauthorizedException('Authentication required. Please login first.');
    }

    if (actor.role === Role.SUPER_ADMIN || actor.isSuperAdmin) {
      const targetId = companyIdOverride || actor.companyId || (this.db.companies[0]?.id);
      const company = this.db.companies.find(
        (c) => c.id === targetId || c.companyCode === targetId,
      );
      if (!company) {
        throw new NotFoundException(`Company "${targetId}" not found.`);
      }
      return company;
    }

    if (actor.role === Role.ADMIN) {
      if (!actor.companyId) {
        throw new ForbiddenException('Admin user is not associated with any company.');
      }
      const company = this.db.companies.find((c) => c.id === actor.companyId);
      if (!company) {
        throw new NotFoundException(`Company associated with Admin ("${actor.companyId}") not found.`);
      }
      return company;
    }

    throw new ForbiddenException('Access Denied: Only Company Administrators and Super Administrators can access this resource.');
  }

  // -------------------------------------------------------------
  // 1. ADMIN DASHBOARD & VITALITY
  // -------------------------------------------------------------
  getDashboard(actor: User, companyIdOverride?: string) {
    const company = this.resolveTargetCompany(actor, companyIdOverride);
    const companyEmployees = this.db.employees.filter((e) => e.companyId === company.id);
    const companyEmpIds = new Set(companyEmployees.map((e) => e.id));

    // Employee status breakdown
    const totalEmployees = companyEmployees.length;
    const activeEmployees = companyEmployees.filter((e) => (e.status || EmployeeStatus.ACTIVE) === EmployeeStatus.ACTIVE).length;
    const onNoticeEmployees = companyEmployees.filter((e) => e.status === EmployeeStatus.ON_NOTICE).length;
    const probationEmployees = companyEmployees.filter((e) => e.status === EmployeeStatus.PROBATION).length;

    // Today's attendance snapshot
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = this.db.attendanceRecords.filter(
      (a) => companyEmpIds.has(a.employeeId) && a.date === today,
    );
    const presentToday = todayAttendance.filter((a) => a.status === AttendanceStatus.PRESENT).length;
    const lateToday = todayAttendance.filter((a) => a.status === AttendanceStatus.LATE).length;
    const halfDayToday = todayAttendance.filter((a) => a.status === AttendanceStatus.HALF_DAY).length;
    const absentToday = totalEmployees - (presentToday + lateToday + halfDayToday);

    // Pending actions
    const pendingLeaves = this.db.leaveRequests.filter(
      (l) => companyEmpIds.has(l.employeeId) && l.status === LeaveStatus.PENDING,
    ).length;

    const pendingResignations = this.db.resignations.filter(
      (r) => companyEmpIds.has(r.employeeId) && (r.status as string) === 'PENDING',
    ).length;

    // Company departments & designations
    const companyDeptIds = new Set(companyEmployees.map((e) => e.departmentId).filter(Boolean));
    const totalDepartments = companyDeptIds.size > 0 ? companyDeptIds.size : this.db.departments.length;
    const totalDesignations = this.db.designations.length;

    return {
      company: {
        id: company.id,
        companyCode: company.companyCode,
        companyName: company.companyName,
        email: company.email,
        phone: company.phone,
        status: company.status,
      },
      overview: {
        totalEmployees,
        activeEmployees,
        probationEmployees,
        onNoticeEmployees,
        totalDepartments,
        totalDesignations,
      },
      attendanceToday: {
        date: today,
        totalRecorded: todayAttendance.length,
        present: presentToday,
        late: lateToday,
        halfDay: halfDayToday,
        estimatedAbsent: Math.max(0, absentToday),
      },
      pendingActions: {
        pendingLeaveRequests: pendingLeaves,
        pendingResignations,
      },
    };
  }

  // -------------------------------------------------------------
  // 2. COMPANY PROFILE & SETTINGS
  // -------------------------------------------------------------
  getCompany(actor: User) {
    const company = this.resolveTargetCompany(actor);
    const employees = this.db.employees.filter((e) => e.companyId === company.id);
    const companyAdmins = this.db.users.filter((u) => u.companyId === company.id && u.role === Role.ADMIN);

    return {
      ...company,
      totalEmployees: employees.length,
      admins: companyAdmins.map((a) => ({
        id: a.id,
        email: a.email,
        firstName: a.firstName,
        lastName: a.lastName,
        phone: a.phone,
        status: a.status,
      })),
    };
  }

  async updateCompany(actor: User, dto: UpdateAdminCompanyDto) {
    const company = this.resolveTargetCompany(actor);

    await this.db.assertCompanyUnique(
      {
        companyName: dto.companyName,
        email: dto.email,
        phone: dto.phone,
      },
      company.id,
    );

    if (dto.companyName) {
      company.companyName = dto.companyName.trim();
      company.name = dto.companyName.trim();
    }
    if (dto.email) company.email = dto.email.trim();
    if (dto.phone) company.phone = dto.phone.trim();
    if (dto.address) company.address = dto.address.trim();
    company.updatedAt = new Date().toISOString();

    this.db.logAudit(
      actor.id,
      `${actor.firstName} ${actor.lastName}`,
      actor.role,
      'ADMIN_COMPANY_UPDATED',
      'Admin',
      `Admin updated company profile for "${company.companyName}"`,
      company.id,
    );

    this.db.persist();
    return {
      message: 'Company profile updated successfully',
      company,
    };
  }

  // -------------------------------------------------------------
  // 3. EMPLOYEE ROSTER MANAGEMENT (COMPANY SCOPED)
  // -------------------------------------------------------------
  getEmployees(actor: User, query: QueryAdminEmployeesDto) {
    const company = this.resolveTargetCompany(actor);
    let list = this.db.employees.filter((e) => e.companyId === company.id);

    if (query.search) {
      const q = query.search.toLowerCase();
      list = list.filter(
        (e) =>
          e.firstName?.toLowerCase().includes(q) ||
          e.lastName?.toLowerCase().includes(q) ||
          e.email?.toLowerCase().includes(q) ||
          e.employeeCode?.toLowerCase().includes(q),
      );
    }

    if (query.departmentId) {
      list = list.filter((e) => e.departmentId === query.departmentId);
    }

    if (query.designationId) {
      list = list.filter((e) => e.designationId === query.designationId);
    }

    if (query.status) {
      list = list.filter((e) => (e.status || EmployeeStatus.ACTIVE).toLowerCase() === query.status?.toLowerCase());
    }

    const total = list.length;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const startIndex = (page - 1) * limit;
    const paginated = list.slice(startIndex, startIndex + limit);

    return {
      companyId: company.id,
      companyCode: company.companyCode,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items: paginated.map((e) => {
        const realId = e.userId || e.id;
        return {
          ...e,
          id: realId,
          userId: realId,
          employeeId: realId,
          role: Role.EMPLOYEE,
        };
      }),
    };
  }

  getEmployeeById(actor: User, id: string) {
    const company = this.resolveTargetCompany(actor);
    const employee = this.db.employees.find(
      (e) => (e.id === id || e.userId === id || e.employeeCode?.toLowerCase() === id.toLowerCase()) && e.companyId === company.id,
    );

    if (!employee) {
      throw new NotFoundException(`Employee with ID or code "${id}" not found in your company.`);
    }

    const user = this.db.users.find(
      (u) => (employee.userId && u.id === employee.userId) || u.id === employee.id || u.employeeId === employee.id || u.email.toLowerCase() === employee.email.toLowerCase(),
    );

    const realId = user ? user.id : (employee.userId || employee.id);
    const safeEmployee = {
      ...employee,
      id: realId,
      userId: realId,
      employeeId: realId,
      role: Role.EMPLOYEE,
    };

    const leaveBalance = this.db.leaveBalances.find((b) => b.employeeId === realId || b.employeeId === employee.id);

    return {
      employee: safeEmployee,
      user: user
        ? {
            id: user.id,
            email: user.email,
            role: user.role,
            status: user.status,
            avatarUrl: user.avatarUrl,
          }
        : null,
      leaveBalance: leaveBalance || null,
    };
  }

  async createEmployee(actor: User, dto: CreateAdminEmployeeDto) {
    const company = this.resolveTargetCompany(actor);

    // If resendIfExisting is requested and employee already exists in this company, resend setup invitation
    if (dto.resendIfExisting) {
      const normalizedReqEmail = normalizeEmail(dto.email);
      const existingEmployee = this.db.employees.find(
        (e) => normalizeEmail(e.email) === normalizedReqEmail && e.companyId === company.id,
      );
      if (existingEmployee) {
        return this.invitationService.resendInvitation(existingEmployee.id, {
          id: actor.id,
          role: actor.role,
          companyId: company.id,
        });
      }
    }

    // 1. Company-scoped email & phone uniqueness check and mutex lock
    const releaseEmailLock = this.db.acquireEmailLock(dto.email, company.id);
    let releasePhoneLock = () => {};
    if (dto.phone) {
      releasePhoneLock = this.db.acquirePhoneLock(dto.phone, company.id);
    }

    try {
      const normalizedEmail = await this.db.assertEmailUnique(dto.email, company.id, undefined, true);
      const normalizedPhone = dto.phone
        ? await this.db.assertPhoneUnique(dto.phone, company.id, undefined, true)
        : '';

      // 2. Sequential employee code generation scoped to company
      let maxNum = 0;
      for (const emp of this.db.employees) {
        if (emp.employeeCode) {
          const match = emp.employeeCode.match(/(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
          }
        }
      }
      const autoEmployeeCode = `EMP-${String(maxNum + 1).padStart(6, '0')}`;

      const userId = `user-${Date.now()}`;
      const employeeId = userId;
      const hashedPassword = hashPassword(dto.password || 'Employee@123');

      const department = this.db.departments.find((d) => d.id === dto.departmentId) || this.db.departments[0];
      const designation = this.db.designations.find((d) => d.id === dto.designationId) || this.db.designations[0];
      const location = this.db.locations[0];

      // 3. Create Employee profile record
      const newEmployee: Employee = {
        id: userId,
        employeeCode: autoEmployeeCode,
        companyId: company.id,
        companyCode: company.companyCode,
        userId,
        password: hashedPassword,
        isSuperAdmin: false,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        avatarUrl: '',
        gender: (dto.gender as any) || 'Other',
        dateOfBirth: '',
        address: dto.address?.trim() || '',
        emergencyContact: {} as any,
        joiningDate: dto.joiningDate || new Date().toISOString().split('T')[0],
        employmentType: (dto.employmentType as any) || 'Full-time',
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
        salary: dto.salary || { basic: 40000, hra: 15000, allowances: 5000 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.db.employees.unshift(newEmployee);

      // 4. Create User credentials record in unified users table
      const newUser: User = {
        id: userId,
        email: normalizedEmail,
        phone: newEmployee.phone,
        password: hashedPassword,
        firstName: newEmployee.firstName,
        lastName: newEmployee.lastName,
        role: Role.EMPLOYEE,
        isSuperAdmin: false,
        status: 'Active',
        companyId: company.id,
        companyCode: company.companyCode,
        employeeId: userId,
        employeeCode: autoEmployeeCode,
        avatarUrl: '',
        gender: newEmployee.gender,
        joiningDate: newEmployee.joiningDate,
        employmentType: newEmployee.employmentType,
        departmentId: newEmployee.departmentId,
        departmentName: newEmployee.departmentName,
        designationId: newEmployee.designationId,
        designationTitle: newEmployee.designationTitle,
        workLocationId: newEmployee.workLocationId,
        workLocationName: newEmployee.workLocationName,
        shift: newEmployee.shift,
        salary: newEmployee.salary,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.db.users.unshift(newUser);

      // 5. Initialize leave balances
      this.db.leaveBalances.push({
        id: `bal-${userId}`,
        employeeId: userId,
        year: 2026,
        casualLeave: { total: 12, used: 0, remaining: 12 },
        sickLeave: { total: 10, used: 0, remaining: 10 },
        paidLeave: { total: 15, used: 0, remaining: 15 },
      });

      this.db.logAudit(
        actor.id,
        `${actor.firstName} ${actor.lastName}`,
        actor.role,
        'ADMIN_CREATE_EMPLOYEE',
        'Admin',
        `Admin created employee account "${newUser.email}" (${newEmployee.employeeCode}) in company "${company.companyName}"`,
        userId,
      );

      // 6. Automatically dispatch setup email invitation via Nodemailer
      let invitationResult: any = undefined;
      try {
        const invResult = await this.invitationService.createAndSendInvitation({
          userId,
          email: normalizedEmail,
          employeeName: `${newEmployee.firstName} ${newEmployee.lastName}`.trim(),
          companyId: company.id,
          companyCode: company.companyCode,
          companyName: company.companyName || company.name || 'Your Company',
        });
        invitationResult = {
          id: invResult.invitationId,
          sent: invResult.sent,
          error: invResult.error,
          rawToken: invResult.rawToken,
        };
        (newEmployee as any).invitation = invitationResult;
      } catch (invErr: any) {
        this.logger.error(`Failed to send invitation email: ${invErr.message}`, invErr.stack);
        this.db.logAudit(
          'sys',
          `${actor.firstName} ${actor.lastName}`,
          actor.role,
          'INVITATION_EMAIL_FAILED',
          'Admin',
          `Invitation email failed for employee ${userId}: ${invErr.message}`,
          userId,
        );
      }

      this.db.persist();

      const { password: _, ...safeUser } = newUser;
      return {
        message: invitationResult?.sent
          ? 'Employee successfully created and invitation email dispatched'
          : 'Employee successfully created and added to company',
        employee: newEmployee,
        user: safeUser,
        invitation: invitationResult,
      };
    } finally {
      releaseEmailLock();
      releasePhoneLock();
    }
  }

  async resendEmployeeInvitation(actor: User, id: string) {
    const company = this.resolveTargetCompany(actor);
    const searchVal = id.trim().toLowerCase();
    const employee = this.db.employees.find(
      (e) =>
        e.companyId === company.id &&
        (e.id === id ||
          e.userId === id ||
          e.employeeCode?.toLowerCase() === searchVal ||
          e.email?.toLowerCase() === searchVal),
    );

    if (!employee) {
      throw new NotFoundException(`Employee "${id}" not found in your company.`);
    }

    return this.invitationService.resendInvitation(employee.id, {
      id: actor.id,
      role: actor.role,
      companyId: company.id,
    });
  }

  async updateEmployee(actor: User, id: string, dto: UpdateAdminEmployeeDto) {
    const company = this.resolveTargetCompany(actor);
    const employee = this.db.employees.find(
      (e) => (e.id === id || e.employeeCode?.toLowerCase() === id.toLowerCase()) && e.companyId === company.id,
    );

    if (!employee) {
      throw new NotFoundException(`Employee "${id}" not found in your company.`);
    }

    if (dto.email && dto.email.trim().toLowerCase() !== employee.email.toLowerCase()) {
      const normalizedEmail = await this.db.assertEmailUnique(dto.email, company.id, employee.userId || employee.id);
      employee.email = normalizedEmail;
    }

    if (dto.phone !== undefined && dto.phone.trim() !== '') {
      const normalizedPhone = await this.db.assertPhoneUnique(dto.phone, company.id, employee.userId || employee.id);
      employee.phone = normalizedPhone;
    } else if (dto.phone !== undefined) {
      employee.phone = '';
    }
    if (dto.gender) employee.gender = dto.gender as any;
    if (dto.address !== undefined) employee.address = dto.address.trim();
    if (dto.employmentType) employee.employmentType = dto.employmentType as any;
    if (dto.status) employee.status = dto.status as any;
    if (dto.shift) employee.shift = dto.shift;
    if (dto.salary) employee.salary = { ...employee.salary, ...dto.salary };

    if (dto.departmentId) {
      const dept = this.db.departments.find((d) => d.id === dto.departmentId);
      if (dept) {
        employee.departmentId = dept.id;
        employee.departmentName = dept.name;
      }
    }

    if (dto.designationId) {
      const desig = this.db.designations.find((d) => d.id === dto.designationId);
      if (desig) {
        employee.designationId = desig.id;
        employee.designationTitle = desig.title;
      }
    }

    employee.updatedAt = new Date().toISOString();

    // Synchronize linked User account
    const user = this.db.users.find(
      (u) => (employee.userId && u.id === employee.userId) || u.employeeId === employee.id || u.email.toLowerCase() === employee.email.toLowerCase(),
    );
    if (user) {
      user.email = employee.email;
      user.firstName = employee.firstName;
      user.lastName = employee.lastName;
      user.phone = employee.phone;
      user.status = employee.status;
      user.departmentId = employee.departmentId;
      user.departmentName = employee.departmentName;
      user.designationId = employee.designationId;
      user.designationTitle = employee.designationTitle;
      user.shift = employee.shift;
      user.salary = employee.salary;
      user.updatedAt = new Date().toISOString();
    }

    this.db.logAudit(
      actor.id,
      `${actor.firstName} ${actor.lastName}`,
      actor.role,
      'ADMIN_UPDATE_EMPLOYEE',
      'Admin',
      `Admin updated employee profile for ${employee.email} (${employee.employeeCode})`,
      employee.id,
    );

    this.db.persist();

    return {
      message: 'Employee updated successfully',
      employee,
    };
  }

  async deleteEmployee(actor: User, id: string) {
    const company = this.resolveTargetCompany(actor);
    const empIdx = this.db.employees.findIndex(
      (e) => (e.id === id || e.employeeCode?.toLowerCase() === id.toLowerCase()) && e.companyId === company.id,
    );

    if (empIdx === -1) {
      throw new NotFoundException(`Employee "${id}" not found in your company.`);
    }

    const employee = this.db.employees[empIdx];
    this.db.employees.splice(empIdx, 1);

    // Also remove or deactivate associated user
    const userIdx = this.db.users.findIndex(
      (u) => (employee.userId && u.id === employee.userId) || u.employeeId === employee.id || u.email.toLowerCase() === employee.email.toLowerCase(),
    );
    if (userIdx !== -1) {
      this.db.users.splice(userIdx, 1);
    }

    // Ensure deletion is immediately propagated directly to MySQL
    await this.db.deleteUserFromMysql(employee.id, employee.email);
    if (employee.userId && employee.userId !== employee.id) {
      await this.db.deleteUserFromMysql(employee.userId, employee.email);
    }

    this.db.logAudit(
      actor.id,
      `${actor.firstName} ${actor.lastName}`,
      actor.role,
      'ADMIN_DELETE_EMPLOYEE',
      'Admin',
      `Admin deleted employee ${employee.email} (${employee.employeeCode}) from company "${company.companyName}"`,
      employee.id,
    );

    this.db.persist();

    return {
      message: `Employee "${employee.employeeCode}" (${employee.firstName} ${employee.lastName}) deleted successfully.`,
    };
  }

  // -------------------------------------------------------------
  // 4. ATTENDANCE MANAGEMENT (COMPANY SCOPED)
  // -------------------------------------------------------------
  getAttendance(actor: User, query: { date?: string; month?: string; employeeId?: string; userId?: string }) {
    const company = this.resolveTargetCompany(actor);
    const companyEmployees = this.db.employees.filter((e) => e.companyId === company.id);
    const companyEmpIds = new Set(companyEmployees.map((e) => e.userId || e.id));

    let list = this.db.attendanceRecords.filter((a) => companyEmpIds.has(a.employeeId));

    const filterId = query.userId || query.employeeId;
    if (filterId) {
      list = list.filter((a) => {
        if (a.employeeId === filterId || (a as any).userId === filterId) return true;
        const user = this.db.users.find((u) => u.id === a.employeeId || u.employeeId === a.employeeId);
        return user?.id === filterId || user?.employeeId === filterId;
      });
    }

    if (query.date) {
      list = list.filter((a) => a.date === query.date);
    } else if (query.month) {
      list = list.filter((a) => a.date?.startsWith(query.month!));
    }

    return {
      companyId: company.id,
      totalRecords: list.length,
      records: list.map((a) => {
        const user = this.db.users.find(
          (u) => u.id === a.employeeId || u.employeeId === a.employeeId || (a as any).userId === u.id,
        );
        const realUserId = user ? user.id : a.employeeId;
        const { employeeId: _, id: attId, ...rest } = a;
        const resObj: any = {
          id: attId,
          userId: realUserId,
          role: user?.role || Role.EMPLOYEE,
          ...rest,
        };
        Object.defineProperty(resObj, 'employeeId', {
          value: realUserId,
          enumerable: false,
          configurable: true,
          writable: true,
        });
        return resObj;
      }),
    };
  }

  manualAttendance(actor: User, dto: AdminManualAttendanceDto) {
    const company = this.resolveTargetCompany(actor);
    const targetId = (dto as any).userId || dto.employeeId;
    const user = this.db.resolveUser(targetId);

    if (!user || (user.companyId && user.companyId !== company.id)) {
      throw new NotFoundException(`User "${targetId}" not found in your company.`);
    }

    const realUserId = user.id;

    let record = this.db.attendanceRecords.find(
      (a) => (a.employeeId === realUserId || a.employeeId === targetId) && a.date === dto.date,
    );

    if (record) {
      record.employeeId = realUserId;
      record.checkIn = dto.checkIn || record.checkIn;
      record.checkOut = dto.checkOut || record.checkOut;
      record.status = dto.status;
      record.remarks = dto.notes || record.remarks;
    } else {
      const newRecord: AttendanceRecord = {
        id: `att-${Date.now()}`,
        employeeId: realUserId,
        employeeName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        date: dto.date,
        checkIn: dto.checkIn || '09:00 AM',
        checkOut: dto.checkOut || '06:00 PM',
        breakDurationMinutes: 60,
        workingHours: 8,
        overtimeHours: 0,
        status: dto.status,
        remarks: dto.notes || 'Admin manual punch regularization',
        createdAt: new Date().toISOString(),
      };
      record = newRecord;
      this.db.attendanceRecords.unshift(newRecord);
    }

    this.db.logAudit(
      actor.id,
      `${actor.firstName} ${actor.lastName}`,
      actor.role,
      'ADMIN_ATTENDANCE_REGULARIZED',
      'Admin',
      `Admin regularized attendance for ${user.employeeCode || user.email} on ${dto.date} as ${dto.status}`,
      record.id,
    );

    this.db.persist();

    const { employeeId: _, id: recId, ...rest } = record;
    const attObj: any = {
      id: recId,
      userId: realUserId,
      ...rest,
    };
    Object.defineProperty(attObj, 'employeeId', {
      value: realUserId,
      enumerable: false,
      configurable: true,
      writable: true,
    });

    return {
      message: 'Attendance regularized successfully',
      attendance: attObj,
    };
  }

  // -------------------------------------------------------------
  // 5. PAYROLL OVERVIEW (COMPANY SCOPED)
  // -------------------------------------------------------------
  getPayroll(actor: User, query: { month?: string; year?: number }) {
    const company = this.resolveTargetCompany(actor);
    const companyEmployees = this.db.employees.filter((e) => e.companyId === company.id);
    const companyEmpIds = new Set(companyEmployees.map((e) => e.id));

    let list = this.db.payrollRecords.filter((p) => companyEmpIds.has(p.employeeId));

    if (query.month) {
      list = list.filter((p) => p.payrollMonth === query.month || p.payrollMonth?.toLowerCase().includes(query.month!.toLowerCase()));
    }

    const totalDisbursed = list.reduce((sum, p) => sum + (p.netSalary || p.grossSalary || 0), 0);

    return {
      companyId: company.id,
      companyCode: company.companyCode,
      totalRecords: list.length,
      cumulativePayout: totalDisbursed,
      records: list,
    };
  }

  // -------------------------------------------------------------
  // 7. DEPARTMENTS & DESIGNATIONS (COMPANY SCOPED)
  // -------------------------------------------------------------
  getDepartments(actor: User) {
    this.resolveTargetCompany(actor);
    return this.db.departments;
  }

  createDepartment(actor: User, dto: CreateAdminDepartmentDto) {
    this.resolveTargetCompany(actor);
    const existing = this.db.departments.find((d) => d.name.toLowerCase() === dto.name.trim().toLowerCase());
    if (existing) {
      throw new ConflictException(`Department "${dto.name}" already exists.`);
    }

    const deptCode = `DEP-${String(this.db.departments.length + 1).padStart(3, '0')}`;
    const dept: Department = {
      id: `dept-${Date.now()}`,
      name: dto.name.trim(),
      code: deptCode,
      description: dto.description?.trim() || '',
      employeeCount: 0,
      createdAt: new Date().toISOString(),
    };
    this.db.departments.push(dept);
    this.db.persist();

    return {
      message: 'Department created successfully',
      department: dept,
    };
  }

  getDesignations(actor: User) {
    this.resolveTargetCompany(actor);
    return this.db.designations;
  }

  createDesignation(actor: User, dto: CreateAdminDesignationDto) {
    this.resolveTargetCompany(actor);
    const existing = this.db.designations.find((d) => d.title.toLowerCase() === dto.title.trim().toLowerCase());
    if (existing) {
      throw new ConflictException(`Designation "${dto.title}" already exists.`);
    }

    const desig: Designation = {
      id: `desig-${Date.now()}`,
      title: dto.title.trim(),
      departmentId: dto.departmentId || '',
      departmentName: this.db.departments.find((d) => d.id === dto.departmentId)?.name || '',
      minSalary: 25000,
      maxSalary: 150000,
      createdAt: new Date().toISOString(),
    };
    this.db.designations.push(desig);
    this.db.persist();

    return {
      message: 'Designation created successfully',
      designation: desig,
    };
  }

  // -------------------------------------------------------------
  // 8. ADMIN USER PROFILE
  // -------------------------------------------------------------
  getProfile(actor: User) {
    const company = this.resolveTargetCompany(actor);
    const { password: _, ...safeUser } = actor;

    return {
      ...safeUser,
      company: {
        id: company.id,
        companyCode: company.companyCode,
        companyName: company.companyName,
        email: company.email,
        phone: company.phone,
        status: company.status,
      },
    };
  }
}
