import { Injectable, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { User, Role, Employee, EmployeeStatus } from '../../common/types.js';
import { RegisterDto } from './dto/register.dto.js';
import { hashPassword, comparePassword } from '../../common/utils/password.util.js';

function matchPhone(phoneA?: string, phoneB?: string): boolean {
  if (!phoneA || !phoneB) return false;
  const a = phoneA.replace(/\D/g, '');
  const b = phoneB.replace(/\D/g, '');
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 10 && b.length >= 10) {
    return a.slice(-10) === b.slice(-10);
  }
  return false;
}

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

    // Determine target company:
    let targetCompany: any;
    if (data.companyId) {
      targetCompany = this.db.companies.find(
        (c) => c.id === data.companyId || c.companyCode === data.companyId,
      );
      if (!targetCompany) {
        throw new NotFoundException(`Company with ID or code "${data.companyId}" not found.`);
      }
    } else if (role !== Role.SUPER_ADMIN && this.db.companies.length > 0) {
      targetCompany = this.db.companies[0];
    }

    const hashedPassword = hashPassword(data.password);

    // Create User record
    const newUser: User = {
      id: userId,
      email: data.email,
      phone: data.phone || '',
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      role,
      isSuperAdmin,
      status: 'Active',
      companyId: targetCompany?.id || null,
      companyCode: targetCompany?.companyCode || null,
      employeeId,
      avatarUrl: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.db.users.push(newUser);

    if (role === Role.ADMIN && targetCompany) {
      targetCompany.adminUserId = userId;
      targetCompany.updatedAt = new Date().toISOString();
    }

    // Create corresponding Employee record with auto-generated employeeCode ONLY for EMPLOYEE role
    if (role === Role.EMPLOYEE) {
      let maxEmpNum = 0;
      const scopedList = targetCompany
        ? this.db.employees.filter((e) => e.companyId === targetCompany.id)
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
        id: employeeId,
        employeeCode: autoEmployeeCode,
        companyId: targetCompany?.id || '',
        companyCode: targetCompany?.companyCode || '',
        userId,
        password: hashedPassword,
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
    } else {
      newUser.employeeId = null as any;
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

  login(identifier: string, password?: string) {
    if (!identifier || typeof identifier !== 'string') {
      throw new UnauthorizedException('Email address or mobile number is required.');
    }

    const cleanInput = identifier.trim();
    const isEmailInput = cleanInput.includes('@');

    let user: User | undefined;

    if (isEmailInput) {
      // 1. Search directly by email
      user = this.db.users.find(
        (u) => u.email.toLowerCase() === cleanInput.toLowerCase(),
      );
    } else {
      // 2. Search by mobile/phone number
      // Collect all candidate users that match the given mobile number
      const candidateUsers: User[] = [];

      // 2a. Direct user phone
      for (const u of this.db.users) {
        if (u.phone && matchPhone(u.phone, cleanInput)) {
          if (!candidateUsers.some((c) => c.id === u.id)) candidateUsers.push(u);
        }
      }

      // 2b. Check linked employee phone
      for (const emp of this.db.employees) {
        if (emp.phone && matchPhone(emp.phone, cleanInput)) {
          const linkedUser = this.db.users.find(
            (u) =>
              u.id === emp.userId ||
              u.employeeId === emp.id ||
              (u.email && emp.email && u.email.toLowerCase() === emp.email.toLowerCase()),
          );
          if (linkedUser && !candidateUsers.some((c) => c.id === linkedUser.id)) {
            candidateUsers.push(linkedUser);
          }
        }
      }

      // 2c. Check company admin phone
      for (const comp of this.db.companies) {
        if (comp.phone && matchPhone(comp.phone, cleanInput) && comp.adminUserId) {
          const linkedAdmin = this.db.users.find((u) => u.id === comp.adminUserId);
          if (linkedAdmin && !candidateUsers.some((c) => c.id === linkedAdmin.id)) {
            candidateUsers.push(linkedAdmin);
          }
        }
      }

      if (candidateUsers.length === 1) {
        user = candidateUsers[0];
      } else if (candidateUsers.length > 1) {
        // If multiple users match this phone number, match the one with valid password
        if (password) {
          user = candidateUsers.find((u) => u.password && comparePassword(password, u.password));
        }
        if (!user) {
          user = candidateUsers[0];
        }
      }

      // 2d. Fallback: match by email string without @
      if (!user) {
        user = this.db.users.find(
          (u) => u.email.toLowerCase() === cleanInput.toLowerCase(),
        );
      }
    }

    if (!user) {
      throw new UnauthorizedException(
        isEmailInput
          ? 'Invalid credentials. Please check email and password.'
          : 'Invalid credentials. Please check mobile number and password.',
      );
    }

    if (!password) {
      throw new UnauthorizedException('Password is required.');
    }

    if (!user.password) {
      user.password = hashPassword(password);
      user.updatedAt = new Date().toISOString();
      this.db.persist();
    } else {
      const isValid = comparePassword(password, user.password);
      if (!isValid) {
        throw new UnauthorizedException('Invalid credentials. Incorrect password.');
      }
      // Upgrade plain text to bcrypt hash if not already hashed
      if (!user.password.startsWith('$2a$') && !user.password.startsWith('$2b$')) {
        user.password = hashPassword(password);
        user.updatedAt = new Date().toISOString();
        this.db.persist();
      }
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
      `User ${user.email} logged in successfully via ${isEmailInput ? 'email' : 'mobile number'}`,
      user.id,
    );

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone || '',
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
