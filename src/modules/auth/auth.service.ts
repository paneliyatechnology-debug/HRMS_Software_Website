import { Injectable, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { User, Role, Employee, EmployeeStatus } from '../../common/types.js';
import { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService) {}

  register(data: RegisterDto) {
    const existing = this.db.users.find(
      (u) => u.email.toLowerCase() === data.email.toLowerCase(),
    );

    if (existing) {
      throw new ConflictException('User with this email already exists.');
    }

    const userId = `user-${Date.now()}`;
    const employeeId = `emp-${Date.now()}`;
    const role = data.role || Role.EMPLOYEE;

    const department = this.db.departments.find((d) => d.id === data.departmentId);
    const designation = this.db.designations.find((d) => d.id === data.designationId);
    const location = this.db.locations[0];

    const isSuperAdmin = role === Role.SUPER_ADMIN;

    // Create User record
    const newUser: User = {
      id: userId,
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      role,
      isSuperAdmin,
      status: 'Active',
      employeeId,
      avatarUrl: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.db.users.push(newUser);

    // Create corresponding Employee record with auto-generated employeeCode
    let maxEmpNum = 0;
    for (const emp of this.db.employees) {
      if (emp.employeeCode) {
        const match = emp.employeeCode.match(/(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxEmpNum) maxEmpNum = num;
        }
      }
    }
    const autoEmployeeCode = `EMP-${String(maxEmpNum + 1).padStart(3, '0')}`;

    const newEmployee: Employee = {
      id: employeeId,
      employeeCode: autoEmployeeCode,
      userId,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone || '',
      avatarUrl: '',
      gender: 'Other',
      dateOfBirth: '',
      address: '',
      emergencyContact: {} as any,
      joiningDate: new Date().toISOString().split('T')[0],
      employmentType: 'Full-time',
      status: EmployeeStatus.ACTIVE,
      departmentId: department?.id || data.departmentId || '',
      departmentName: department?.name || '',
      designationId: designation?.id || data.designationId || '',
      designationTitle: designation?.title || '',
      reportingManagerId: '',
      reportingManagerName: '',
      workLocationId: location?.id || '',
      workLocationName: location?.name || '',
      shift: '',
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

    // Initial leave balance
    this.db.leaveBalances.push({
      id: `bal-${newEmployee.id}`,
      employeeId: newEmployee.id,
      year: 2026,
      casualLeave: { total: 12, used: 0, remaining: 12 },
      sickLeave: { total: 10, used: 0, remaining: 10 },
      paidLeave: { total: 15, used: 0, remaining: 15 },
    });

    if (department) {
      department.employeeCount += 1;
    }

    this.db.logAudit(
      newUser.id,
      `${newUser.firstName} ${newUser.lastName}`,
      newUser.role,
      'USER_REGISTERED',
      'Authentication',
      `User ${newUser.email} registered new account`,
      newUser.id,
    );

    this.db.persist();

    const token = `jwt_token_${newUser.id}_${Date.now()}`;
    return {
      message: 'User registered successfully',
      accessToken: token,
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        isSuperAdmin: newUser.isSuperAdmin ?? (newUser.role === Role.SUPER_ADMIN),
        status: newUser.status || 'Active',
        companyId: newUser.companyId || (this.db.companies[0]?.id || null),
        companyCode: newUser.companyCode || (this.db.companies[0]?.companyCode || null),
        employeeId: newUser.employeeId,
        avatarUrl: newUser.avatarUrl,
      },
    };
  }

  login(email: string, password?: string) {
    const user = this.db.users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials. Please check email and password.');
    }

    if (!user.password && password) {
      user.password = password;
      user.updatedAt = new Date().toISOString();
      this.db.persist();
    } else if (user.password && password && user.password !== password) {
      throw new UnauthorizedException('Invalid credentials. Incorrect password.');
    } else if (user.password && !password) {
      throw new UnauthorizedException('Password is required for this account.');
    }

    if (user.status && user.status.toLowerCase() === 'inactive') {
      throw new UnauthorizedException('Your account is deactivated. Contact company administrator.');
    }

    // Default company if missing
    if (user.role !== Role.SUPER_ADMIN && !user.companyId && this.db.companies.length > 0) {
      user.companyId = this.db.companies[0].id;
      user.companyCode = this.db.companies[0].companyCode;
      this.db.persist();
    }

    const token = `jwt_token_${user.id}_${Date.now()}`;
    this.db.logAudit(
      user.id,
      `${user.firstName} ${user.lastName}`,
      user.role,
      'USER_LOGIN',
      'Authentication',
      `User ${user.email} logged in successfully`,
      user.id,
    );

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin ?? (user.role === Role.SUPER_ADMIN),
        status: user.status || 'Active',
        companyId: user.companyId || null,
        companyCode: user.companyCode || null,
        employeeId: user.employeeId,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  extractUserId(rawToken?: string): string {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new UnauthorizedException('Authentication token is missing. Please provide Authorization header.');
    }

    // Clean token: strip surrounding quotes and trim whitespace
    let clean = rawToken.trim().replace(/^["']+|["']+$/g, '').trim();

    // Remove leading 'Bearer ' if present (case-insensitive)
    if (clean.toLowerCase().startsWith('bearer ')) {
      clean = clean.substring(7).trim().replace(/^["']+|["']+$/g, '').trim();
    }

    if (!clean) {
      throw new UnauthorizedException('Authentication token is empty.');
    }

    if (clean === '{{bearerToken}}' || clean === '{{token}}') {
      throw new UnauthorizedException(
        `Unresolved Postman variable "${clean}" detected. In Postman, please replace "${clean}" with your actual token in the Authorization tab, or select an environment where "${clean}" is defined.`,
      );
    }

    // 1. Try matching pattern: jwt_token_<userId>_<timestamp>
    const match = clean.match(/jwt_token_([^_]+)/i);
    if (match && match[1]) {
      return match[1];
    }

    // 2. Direct userId (e.g. user-123...)
    if (clean.startsWith('user-')) {
      return clean.split('_')[0];
    }

    return clean;
  }

  getCurrentUser(rawAuthHeader?: string) {
    if (!rawAuthHeader) {
      throw new UnauthorizedException('Authentication token required. Please login first.');
    }

    const identifier = this.extractUserId(rawAuthHeader);

    // Search strictly by user ID or email
    const user = this.db.users.find(
      (u) =>
        u.id.toLowerCase() === identifier.toLowerCase() ||
        u.email.toLowerCase() === identifier.toLowerCase(),
    );

    if (!user) {
      throw new UnauthorizedException(
        `User not found for token identifier "${identifier}". Invalid or expired session. Please login again.`,
      );
    }

    // Omit sensitive password from profile response
    const { password: _, ...safeUser } = user;
    return {
      ...safeUser,
      isSuperAdmin: user.isSuperAdmin ?? (user.role === Role.SUPER_ADMIN),
      status: user.status || 'Active',
    };
  }

  switchRole(targetRole: Role) {
    const matchedUser = this.db.users.find((u) => u.role === targetRole);
    if (!matchedUser) {
      throw new NotFoundException(`No user found with role "${targetRole}"`);
    }
    const { password: _, ...safeUser } = matchedUser;
    return {
      accessToken: `jwt_token_${matchedUser.id}_${Date.now()}`,
      user: {
        ...safeUser,
        isSuperAdmin: matchedUser.isSuperAdmin ?? (matchedUser.role === Role.SUPER_ADMIN),
        status: matchedUser.status || 'Active',
      },
    };
  }

  getAllUsers(): User[] {
    return this.db.users.map(({ password: _, ...rest }) => rest as User);
  }
}
