import { Injectable, UnauthorizedException, ConflictException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { User, Role, Employee, EmployeeStatus, isSuperAdminUser } from '../../common/types.js';
import { RegisterDto } from './dto/register.dto.js';
import { hashPassword, comparePassword } from '../../common/utils/password.util.js';
import { signAccessToken, verifyAccessToken } from '../../common/utils/jwt.util.js';
import { SuperAdminService } from '../super-admin/super-admin.service.js';
import { CreateCompanyDto } from '../super-admin/dto/create-company.dto.js';

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
  constructor(
    private readonly db: DatabaseService,
    private readonly superAdminService: SuperAdminService,
  ) {}

  registerCompany(dto: CreateCompanyDto) {
    if (!dto.adminEmail || !dto.adminPassword) {
      throw new BadRequestException('Admin email and password are required.');
    }
    return this.superAdminService.createCompany(dto);
  }

  private withCompanyName(user: User) {
    const company = user.companyId
      ? this.db.companies.find((c) => c.id === user.companyId)
      : undefined;
    return {
      companyName: company?.companyName || company?.name || '',
    };
  }

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

    const token = signAccessToken(newUser.id);
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
        ...this.withCompanyName(newUser),
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
      // 1. Search directly by email in users
      user = this.db.users.find(
        (u) => u.email && u.email.toLowerCase() === cleanInput.toLowerCase(),
      );

      // 1b. Check in employees list if user account not found yet
      if (!user) {
        const emp = this.db.employees.find(
          (e) => e.email && e.email.toLowerCase() === cleanInput.toLowerCase(),
        );
        if (emp) {
          user = this.db.users.find(
            (u) =>
              u.id === emp.userId ||
              u.employeeId === emp.id ||
              (u.email && u.email.toLowerCase() === emp.email.toLowerCase()),
          );
          if (!user && emp.email) {
            user = {
              id: emp.userId || `user-${emp.id}`,
              email: emp.email,
              firstName: emp.firstName,
              lastName: emp.lastName,
              role: (emp as any).role || Role.EMPLOYEE,
              isSuperAdmin: Boolean((emp as any).isSuperAdmin),
              status: emp.status || 'Active',
              companyId: emp.companyId || this.db.companies[0]?.id || 'cmp-1',
              companyCode: emp.companyCode || this.db.companies[0]?.companyCode || 'CMP-000001',
              employeeId: emp.id,
              phone: emp.phone,
              avatarUrl: emp.avatarUrl,
              password: emp.password || hashPassword(password || 'Employee@123'),
              createdAt: emp.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            this.db.users.push(user);
            this.db.persist();
          }
        }
      }

      // 1c. Check company contact/admin email
      if (!user) {
        const comp = this.db.companies.find(
          (c) => c.email && c.email.toLowerCase() === cleanInput.toLowerCase(),
        );
        if (comp && comp.adminUserId) {
          user = this.db.users.find((u) => u.id === comp.adminUserId);
        }
      }

      // 1d. Fallback for admin aliases (e.g. admin@paneliya.com -> superadmin@paneliya.com or super admin user)
      if (!user && (cleanInput.toLowerCase() === 'admin@paneliya.com' || cleanInput.toLowerCase() === 'admin@gmail.com')) {
        user = this.db.users.find(
          (u) => u.email.toLowerCase() === 'superadmin@paneliya.com' || u.role === Role.SUPER_ADMIN,
        );
      }
    } else {
      // 2. Search by employee code (e.g. PAN-001, DEM-001, EMP-000002)
      const empByCode = this.db.employees.find(
        (e) => e.employeeCode && e.employeeCode.toLowerCase() === cleanInput.toLowerCase(),
      );
      if (empByCode) {
        user = this.db.users.find(
          (u) =>
            u.id === empByCode.userId ||
            u.employeeId === empByCode.id ||
            (u.email && empByCode.email && u.email.toLowerCase() === empByCode.email.toLowerCase()),
        );
        if (!user && empByCode.email) {
          user = {
            id: empByCode.userId || `user-${empByCode.id}`,
            email: empByCode.email,
            firstName: empByCode.firstName,
            lastName: empByCode.lastName,
            role: (empByCode as any).role || Role.EMPLOYEE,
            isSuperAdmin: Boolean((empByCode as any).isSuperAdmin),
            status: empByCode.status || 'Active',
            companyId: empByCode.companyId,
            companyCode: empByCode.companyCode,
            employeeId: empByCode.id,
            phone: empByCode.phone,
            avatarUrl: empByCode.avatarUrl,
            password: empByCode.password || hashPassword(password || 'Employee@123'),
            createdAt: empByCode.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          this.db.users.push(user);
          this.db.persist();
        }
      }

      // 2b. Search by company code (e.g. CMP-000001, CMP-000002)
      if (!user) {
        const compByCode = this.db.companies.find(
          (c) => c.companyCode && c.companyCode.toLowerCase() === cleanInput.toLowerCase(),
        );
        if (compByCode && compByCode.adminUserId) {
          user = this.db.users.find((u) => u.id === compByCode.adminUserId);
        }
      }

      // 2c. Search by user ID or employee ID
      if (!user) {
        user = this.db.users.find(
          (u) =>
            u.id.toLowerCase() === cleanInput.toLowerCase() ||
            (u.employeeId && u.employeeId.toLowerCase() === cleanInput.toLowerCase()),
        );
      }

      // 2d. Search by mobile/phone number
      if (!user) {
        const candidateUsers: User[] = [];

        // Direct user phone
        for (const u of this.db.users) {
          if (u.phone && matchPhone(u.phone, cleanInput)) {
            if (!candidateUsers.some((c) => c.id === u.id)) candidateUsers.push(u);
          }
        }

        // Linked employee phone
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

        // Company admin phone
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
          if (password) {
            user = candidateUsers.find((u) => u.password && comparePassword(password, u.password));
          }
          if (!user) {
            user = candidateUsers[0];
          }
        }
      }

      // 2e. Fallback: match by email string without @
      if (!user) {
        user = this.db.users.find(
          (u) => u.email && u.email.toLowerCase() === cleanInput.toLowerCase(),
        );
      }
    }

    if (!user) {
      throw new UnauthorizedException(
        isEmailInput
          ? 'Invalid credentials. Please check email and password.'
          : 'Invalid credentials. Please check employee code / mobile number and password.',
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
      let isValid = comparePassword(password, user.password);

      // Master password fallback: allow standard enterprise passwords for emergency access / demos
      if (!isValid) {
        if (
          (password === 'Admin@123' || password === 'Password@123') &&
          (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN || user.isSuperAdmin)
        ) {
          user.password = hashPassword(password);
          user.updatedAt = new Date().toISOString();
          this.db.persist();
          isValid = true;
        } else if (
          (password === 'Employee@123' || password === 'Password@123') &&
          user.role === Role.EMPLOYEE
        ) {
          user.password = hashPassword(password);
          user.updatedAt = new Date().toISOString();
          this.db.persist();
          isValid = true;
        }
      }

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

    const token = signAccessToken(user.id);
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
        ...this.withCompanyName(user),
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

    const payload = verifyAccessToken(clean);
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid or expired session token. Please login again.');
    }
    return payload.sub;
  }

  getCurrentUser(rawAuthHeader?: string) {
    if (!rawAuthHeader) {
      throw new UnauthorizedException('Authentication token required. Please login first.');
    }

    const identifier = this.extractUserId(rawAuthHeader);

    // Search strictly by user ID or email
    const user = this.db.users.find((u) => u.id === identifier);

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
      ...this.withCompanyName(user),
    };
  }

  switchRole(targetRole: Role, actor?: User) {
    if (!isSuperAdminUser(actor)) {
      throw new ForbiddenException('Only Super Admin can switch roles.');
    }
    const matchedUser = this.db.users.find((u) => u.role === targetRole);
    if (!matchedUser) {
      throw new NotFoundException(`No user found with role "${targetRole}"`);
    }
    const { password: _, ...safeUser } = matchedUser;
    return {
      accessToken: signAccessToken(matchedUser.id),
      user: {
        ...safeUser,
        isSuperAdmin: matchedUser.isSuperAdmin ?? (matchedUser.role === Role.SUPER_ADMIN),
        status: matchedUser.status || 'Active',
        ...this.withCompanyName(matchedUser),
      },
    };
  }

  getAllUsers(): User[] {
    return this.db.users.map(({ password: _, ...rest }) => rest as User);
  }
}
