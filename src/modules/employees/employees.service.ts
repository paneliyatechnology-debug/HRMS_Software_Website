import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { Employee, EmployeeStatus, Role, User, isSuperAdminUser } from '../../common/types.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { QueryEmployeeDto } from './dto/query-employee.dto.js';
import { hashPassword } from '../../common/utils/password.util.js';

@Injectable()
export class EmployeesService {
  constructor(private readonly db: DatabaseService) {}

  findAll(params?: QueryEmployeeDto, actorUser?: User) {
    let result = [...this.db.employees].filter((emp) => {
      const linkedUser = this.db.users.find(
        (u) => u.id === emp.userId || u.employeeId === emp.id || (u.email && emp.email && u.email.toLowerCase() === emp.email.toLowerCase()),
      );
      if (linkedUser && (linkedUser.role === Role.SUPER_ADMIN || linkedUser.role === Role.ADMIN || linkedUser.isSuperAdmin)) {
        return false;
      }
      if (emp.isSuperAdmin) return false;
      const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
      if (fullName.includes('super admin') || fullName.includes('superadmin') || fullName.includes('ravi admin')) return false;
      if (emp.email?.toLowerCase().includes('superadmin')) return false;
      return true;
    });

    // Multi-company isolation
    if (actorUser) {
      if (!isSuperAdminUser(actorUser)) {
        if (actorUser.companyId) {
          result = result.filter((e) => e.companyId === actorUser.companyId);
        }
      } else if (actorUser.role === Role.SUPER_ADMIN && params?.companyId) {
        result = result.filter((e) => e.companyId === params.companyId);
      }
    }

    if (params?.search) {
      const q = params.search.toLowerCase();
      result = result.filter(
        (e) =>
          `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q) ||
          e.employeeCode.toLowerCase().includes(q) ||
          (e.companyCode && e.companyCode.toLowerCase().includes(q)) ||
          e.designationTitle.toLowerCase().includes(q) ||
          e.departmentName.toLowerCase().includes(q) ||
          e.skills.some((s) => s.toLowerCase().includes(q)),
      );
    }

    if (params?.departmentId && params.departmentId !== 'ALL') {
      result = result.filter((e) => e.departmentId === params.departmentId);
    }

    if (params?.status && params.status !== 'ALL') {
      result = result.filter((e) => e.status === params.status);
    }

    if (params?.employmentType && params.employmentType !== 'ALL') {
      result = result.filter((e) => e.employmentType === params.employmentType);
    }

    return result;
  }

  findOne(id: string, actorUser?: User) {
    const employee = this.db.employees.find((e) => e.id === id || e.employeeCode === id);
    if (!employee) {
      throw new NotFoundException(`Employee with ID "${id}" not found`);
    }

    // Multi-company isolation: Admin can only access their own company's employees
    if (actorUser && actorUser.role === Role.ADMIN) {
      if (actorUser.companyId && employee.companyId && employee.companyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot access employee belonging to another company.');
      }
    }

    // Tab aggregate details
    const attendance = this.db.attendanceRecords.filter((a) => a.employeeId === employee.id);
    const leaves = this.db.leaveRequests.filter((l) => l.employeeId === employee.id);
    const leaveBalance = this.db.leaveBalances.find((b) => b.employeeId === employee.id);
    const documents = this.db.documents.filter((d) => d.employeeId === employee.id);
    const assets = this.db.assets.filter((a) => a.assignedToEmployeeId === employee.id);
    const performance = this.db.performanceReviews.filter((p) => p.employeeId === employee.id);
    const trainings = this.db.employeeTrainings.filter((t) => t.employeeId === employee.id);
    const payrolls = this.db.payrollRecords.filter((p) => p.employeeId === employee.id);
    const auditLogs = this.db.auditLogs.filter(
      (l) => l.recordId === employee.id || l.details.includes(employee.firstName),
    );

    const company = this.db.companies.find((c) => c.id === employee.companyId);

    return {
      ...employee,
      company: company || null,
      tabsData: {
        attendance,
        leaves,
        leaveBalance,
        documents,
        assets,
        performance,
        trainings,
        payrolls,
        activity: auditLogs,
      },
    };
  }

  /**
   * Concurrency-safe, sequential Employee Code generator scoped to target company
   * e.g. EMP-000001, EMP-000002... restarts for each company.
   */
  generateNextEmployeeCode(companyId?: string): string {
    let maxNum = 0;
    const scopedEmployees = companyId
      ? this.db.employees.filter((e) => e.companyId === companyId)
      : this.db.employees;

    for (const emp of scopedEmployees) {
      if (emp.employeeCode) {
        const match = emp.employeeCode.match(/(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    }
    const nextNum = maxNum + 1;
    return `EMP-${String(nextNum).padStart(6, '0')}`;
  }

  getNextCode(companyId?: string): { nextCode: string; companyCode?: string } {
    const nextCode = this.generateNextEmployeeCode(companyId);
    const company = companyId ? this.db.companies.find((c) => c.id === companyId) : null;
    return { nextCode, companyCode: company?.companyCode };
  }

  create(data: CreateEmployeeDto, actorName = 'Admin', companyIdOverride?: string) {
    const newId = `emp-${Date.now()}`;

    // Determine target company:
    // If companyIdOverride is provided (from Admin token or SuperAdmin explicit selection), use it
    let targetCompanyId = companyIdOverride || data.companyId;
    let targetCompany: any;
    if (targetCompanyId) {
      targetCompany = this.db.companies.find(
        (c) => c.id === targetCompanyId || c.companyCode === targetCompanyId,
      );
      if (!targetCompany) {
        throw new NotFoundException(
          `Company with ID or code "${targetCompanyId}" not found. Please provide an existing company.`,
        );
      }
    } else if (this.db.companies.length > 0) {
      targetCompany = this.db.companies[0];
    }

    if (!targetCompany) {
      throw new BadRequestException('No valid company found to assign this employee to.');
    }

    // Scoped automatic generation of sequential employee code (e.g. EMP-000001 per company)
    const employeeCode = this.generateNextEmployeeCode(targetCompany.id);

    const department = this.db.departments.find((d) => d.id === data.departmentId);
    const designation = this.db.designations.find((d) => d.id === data.designationId);
    const location =
      this.db.locations.find((l) => l.id === data.workLocationId) || this.db.locations[0];

    // Dynamic salary calculation
    let salary = data.salary;
    if (data.salary && Object.keys(data.salary).length > 0) {
      const basic = data.salary.basic || 0;
      const hra = data.salary.hra || 0;
      const allowances = data.salary.allowances || 0;
      const bonus = data.salary.bonus || 0;
      const pf = data.salary.pf || 0;
      const tax = data.salary.tax || 0;
      const professionalTax = (data.salary as any).professionalTax || 0;
      const gross =
        (data.salary as any).gross !== undefined
          ? (data.salary as any).gross
          : basic + hra + allowances + bonus;
      const net =
        (data.salary as any).net !== undefined
          ? (data.salary as any).net
          : gross - (pf + tax + professionalTax);
      salary = {
        basic,
        hra,
        allowances,
        bonus,
        pf,
        tax,
        professionalTax,
        gross,
        net,
      } as any;
    }

    const userId = `user-${Date.now()}`;
    const userPassword = data.password ? hashPassword(data.password) : '';
    const userRole = data.role || Role.EMPLOYEE;
    const isSuperAdmin = userRole === Role.SUPER_ADMIN;

    const newEmployee: Employee = {
      id: newId,
      employeeCode,
      companyId: targetCompany.id,
      companyCode: targetCompany.companyCode,
      userId,
      password: userPassword,
      isSuperAdmin,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone || '',
      avatarUrl: data.avatarUrl || '',
      gender: (data.gender as any) || 'Other',
      dateOfBirth: data.dateOfBirth || '',
      address: data.address || '',
      emergencyContact: (data.emergencyContact as any) || {},
      joiningDate: data.joiningDate || new Date().toISOString().split('T')[0],
      employmentType: (data.employmentType as any) || 'Full-time',
      status: data.status || EmployeeStatus.ACTIVE,
      departmentId: department?.id || data.departmentId || '',
      departmentName: department?.name || '',
      designationId: designation?.id || data.designationId || '',
      designationTitle: designation?.title || '',
      reportingManagerId: data.reportingManagerId || '',
      reportingManagerName: data.reportingManagerName || '',
      workLocationId: location?.id || data.workLocationId || '',
      workLocationName: location?.name || '',
      shift: data.shift || '',
      bankDetails: (data.bankDetails as any) || {},
      taxInformation: (data.taxInformation as any) || {},
      education: data.education || [],
      previousExperience: data.previousExperience || [],
      skills: data.skills || [],
      salary: (salary as any) || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.db.employees.unshift(newEmployee);

    // Create or link login User account
    const existingUser = this.db.users.find(
      (u) => u.email.toLowerCase() === newEmployee.email.toLowerCase(),
    );

    if (!existingUser) {
      const newUser: User = {
        id: userId,
        email: newEmployee.email,
        password: userPassword,
        firstName: newEmployee.firstName,
        lastName: newEmployee.lastName,
        role: userRole,
        isSuperAdmin,
        status: 'Active',
        companyId: targetCompany.id,
        companyCode: targetCompany.companyCode,
        employeeId: newEmployee.id,
        avatarUrl: newEmployee.avatarUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.db.users.push(newUser);
    } else {
      existingUser.employeeId = newEmployee.id;
      existingUser.companyId = targetCompany.id;
      existingUser.companyCode = targetCompany.companyCode;
      if (data.password) {
        existingUser.password = hashPassword(data.password);
      }
      if (data.role) {
        existingUser.role = data.role;
      }
      newEmployee.userId = existingUser.id;
    }

    // Create initial leave balance
    this.db.leaveBalances.push({
      id: `bal-${newEmployee.id}`,
      employeeId: newEmployee.id,
      year: 2026,
      casualLeave: { total: 12, used: 0, remaining: 12 },
      sickLeave: { total: 10, used: 0, remaining: 10 },
      paidLeave: { total: 15, used: 0, remaining: 15 },
    });

    // Update department count
    if (department) {
      department.employeeCount += 1;
    }

    this.db.logAudit(
      'sys',
      actorName,
      'ADMIN',
      'EMPLOYEE_CREATED',
      'Employee Management',
      `Created new employee ${newEmployee.firstName} ${newEmployee.lastName} (${newEmployee.employeeCode}) in company ${targetCompany.companyCode}`,
      newEmployee.id,
    );

    this.db.persist();
    return newEmployee;
  }

  update(id: string, data: UpdateEmployeeDto, actorName = 'Admin', actorUser?: User) {
    const idx = this.db.employees.findIndex(
      (e) => e.id === id || e.employeeCode.toLowerCase() === id.toLowerCase(),
    );
    if (idx === -1) {
      throw new NotFoundException(`Employee ${id} not found`);
    }

    const current = this.db.employees[idx];

    // Multi-company isolation check: Admin can only update employees in their company
    if (actorUser && actorUser.role === Role.ADMIN) {
      if (actorUser.companyId && current.companyId && current.companyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot modify employee belonging to another company.');
      }
      // An Admin cannot grant SuperAdmin role or alter company association
      if (data.role === Role.SUPER_ADMIN) {
        throw new ForbiddenException('Admin cannot grant SuperAdmin privileges.');
      }
    }

    const updated: Employee = {
      ...current,
      ...(data as any),
      // Preserve fixed company association and codes
      companyId: current.companyId,
      companyCode: current.companyCode,
      employeeCode: current.employeeCode,
      salary: {
        ...current.salary,
        ...(data.salary || {}),
      },
      updatedAt: new Date().toISOString(),
    };

    this.db.employees[idx] = updated;

    // Keep associated user account synchronized
    const user = this.db.users.find(
      (u) => u.employeeId === current.id || u.email.toLowerCase() === current.email.toLowerCase(),
    );
    if (user) {
      if (data.email) user.email = data.email;
      if (data.firstName) user.firstName = data.firstName;
      if (data.lastName) user.lastName = data.lastName;
      if (data.password) user.password = hashPassword(data.password);
      if (data.role && actorUser?.role === Role.SUPER_ADMIN) user.role = data.role;
      user.updatedAt = new Date().toISOString();
    }

    this.db.logAudit(
      'sys',
      actorName,
      'ADMIN',
      'EMPLOYEE_UPDATED',
      'Employee Management',
      `Updated details for employee ${updated.firstName} ${updated.lastName} (${updated.employeeCode})`,
      updated.id,
    );

    this.db.persist();
    return updated;
  }

  remove(id: string, actorName = 'Admin', actorUser?: User) {
    const employee = this.db.employees.find(
      (e) => e.id === id || e.employeeCode.toLowerCase() === id.toLowerCase(),
    );
    if (!employee) {
      throw new NotFoundException(`Employee ${id} not found`);
    }

    // Multi-company isolation: Admin can only deactivate employees in their company
    if (actorUser && actorUser.role === Role.ADMIN) {
      if (actorUser.companyId && employee.companyId && employee.companyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot deactivate employee belonging to another company.');
      }
    }

    // Per business requirement: Prefer deactivation over hard deleting records
    employee.status = EmployeeStatus.INACTIVE;
    employee.updatedAt = new Date().toISOString();

    const user = this.db.users.find(
      (u) => u.employeeId === employee.id || u.email.toLowerCase() === employee.email.toLowerCase(),
    );
    if (user) {
      user.status = 'Inactive';
      user.updatedAt = new Date().toISOString();
    }

    this.db.logAudit(
      'sys',
      actorName,
      'ADMIN',
      'EMPLOYEE_DEACTIVATED',
      'Employee Management',
      `Marked employee ${employee.firstName} ${employee.lastName} as Inactive (${employee.employeeCode})`,
      employee.id,
    );

    this.db.persist();
    return {
      success: true,
      message: `Employee ${employee.employeeCode} has been deactivated.`,
      employee,
    };
  }
}
