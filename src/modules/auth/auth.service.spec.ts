import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from './auth.service.js';
import { Role } from '../../common/types.js';
import { hashPassword } from '../../common/utils/password.util.js';

describe('AuthService - Unified Users Architecture', () => {
  let authService: AuthService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      companies: [
        { id: 'cmp-1', companyCode: 'CMP-000001', name: 'Paneliya Corp' },
        { id: 'cmp-2', companyCode: 'CMP-000002', name: 'Beta Ltd' },
      ],
      departments: [{ id: 'dept-1', name: 'Engineering', employeeCount: 0 }],
      designations: [{ id: 'desig-1', title: 'Developer' }],
      locations: [{ id: 'loc-1', name: 'HQ' }],
      leaveBalances: [],
      auditLogs: [],
      employees: [
        {
          id: 'emp-1',
          employeeCode: 'EMP-000001',
          companyId: 'cmp-1',
          email: 'worker@paneliya.com',
          phone: '9876543210',
          firstName: 'John',
          lastName: 'Worker',
        },
      ],
      users: [
        {
          id: 'user-super',
          email: 'super@paneliya.com',
          role: Role.SUPER_ADMIN,
          isSuperAdmin: true,
          companyId: null,
          companyCode: null,
          employeeId: null,
          employeeCode: null,
          permissions: ['*'],
          password: hashPassword('SuperPass123!'),
          firstName: 'Super',
          lastName: 'Admin',
        },
        {
          id: 'user-admin',
          email: 'admin@paneliya.com',
          role: Role.ADMIN,
          companyId: 'cmp-1',
          companyCode: 'CMP-000001',
          password: hashPassword('AdminPass123!'),
          firstName: 'Company',
          lastName: 'Admin',
        },
        {
          id: 'user-worker',
          email: 'worker@paneliya.com',
          role: Role.EMPLOYEE,
          companyId: 'cmp-1',
          companyCode: 'CMP-000001',
          employeeId: 'emp-1',
          employeeCode: 'EMP-000001',
          password: hashPassword('WorkerPass123!'),
          firstName: 'John',
          lastName: 'Worker',
        },
      ],
      persist: () => {},
      logAudit: () => {},
    };

    authService = new AuthService(mockDb as any);
  });

  it('should authenticate SUPER_ADMIN from unified users table', () => {
    const res = authService.login('super@paneliya.com', 'SuperPass123!');
    expect(res).toBeDefined();
    expect(res.user.role).toBe(Role.SUPER_ADMIN);
    expect(res.user.isSuperAdmin).toBe(true);
    expect(res.user.companyId).toBeNull();
  });

  it('should authenticate ADMIN from unified users table with company isolation', () => {
    const res = authService.login('admin@paneliya.com', 'AdminPass123!');
    expect(res).toBeDefined();
    expect(res.user.role).toBe(Role.ADMIN);
    expect(res.user.companyId).toBe('cmp-1');
  });

  it('should authenticate EMPLOYEE from unified users table with employee linkage', () => {
    const res = authService.login('worker@paneliya.com', 'WorkerPass123!');
    expect(res).toBeDefined();
    expect(res.user.role).toBe(Role.EMPLOYEE);
    expect(res.user.companyId).toBe('cmp-1');
    expect(res.user.employeeId).toBe('emp-1');
    expect(res.user.employeeCode).toBe('EMP-000001');
  });

  it('should reject invalid password for any user', () => {
    expect(() => authService.login('worker@paneliya.com', 'WrongPassword!')).toThrow();
  });
});

