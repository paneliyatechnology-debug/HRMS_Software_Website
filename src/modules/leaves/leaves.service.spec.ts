import { describe, it, expect, beforeEach } from 'vitest';
import { LeavesService } from './leaves.service.js';
import { LeaveType, LeaveStatus, Role } from '../../common/types.js';

describe('LeavesService - Role Wise Unified User ID Detection', () => {
  let service: LeavesService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      users: [
        {
          id: 'user-1793190505324',
          email: 'ravi@paneliya.com',
          firstName: 'Ravi',
          lastName: 'Khunt',
          role: Role.EMPLOYEE,
          companyId: 'cmp-1',
          employeeId: 'user-1793190505324',
          avatarUrl: 'https://cloudinary.com/avatar.jpg',
          departmentName: 'Engineering',
        },
        {
          id: 'user-admin-1',
          email: 'admin@paneliya.com',
          firstName: 'Admin',
          lastName: 'User',
          role: Role.ADMIN,
          companyId: 'cmp-1',
        },
      ],
      employees: [
        {
          id: 'user-1793190505324',
          userId: 'user-1793190505324',
          firstName: 'Ravi',
          lastName: 'Khunt',
          companyId: 'cmp-1',
          departmentName: 'Engineering',
          avatarUrl: 'https://cloudinary.com/avatar.jpg',
        },
      ],
      leaveRequests: [
        {
          id: 'lr-1',
          employeeId: 'user-1793190505324',
          employeeName: 'Ravi Khunt',
          employeeAvatar: 'https://cloudinary.com/avatar.jpg',
          departmentName: 'Engineering',
          leaveType: LeaveType.SICK,
          startDate: '2026-10-20',
          endDate: '2026-10-20',
          daysCount: 1,
          isHalfDay: false,
          reason: 'Fever',
          status: LeaveStatus.PENDING,
          appliedDate: '2026-10-29',
        },
      ],
      leaveBalances: [
        {
          id: 'bal-user-1793190505324',
          employeeId: 'user-1793190505324',
          year: 2026,
          casualLeave: { total: 12, used: 2, remaining: 10 },
          sickLeave: { total: 10, used: 1, remaining: 9 },
          paidLeave: { total: 15, used: 3, remaining: 12 },
        },
      ],
      notifications: [],
      auditLogs: [],
      persist: () => {},
      logAudit: () => {},
    };
    service = new LeavesService(mockDb as any);
  });

  it('should return userId and employeeId matching phpMyAdmin users table id', () => {
    const leaves = service.findAll();
    expect(leaves.length).toBe(1);
    expect(leaves[0].userId).toBe('user-1793190505324');
    expect(leaves[0].employeeId).toBe('user-1793190505324');
    expect(leaves[0].role).toBe(Role.EMPLOYEE);
  });

  it('should filter leaves by userId or employeeId', () => {
    const byUserId = service.findAll({ userId: 'user-1793190505324' } as any);
    expect(byUserId.length).toBe(1);
    expect(byUserId[0].userId).toBe('user-1793190505324');

    const byEmpId = service.findAll({ employeeId: 'user-1793190505324' });
    expect(byEmpId.length).toBe(1);
  });

  it('should return balances with matching userId', () => {
    const balances = service.getBalances('user-1793190505324');
    expect(balances.userId).toBe('user-1793190505324');
    expect(balances.employeeId).toBe('user-1793190505324');
    expect(balances.role).toBe(Role.EMPLOYEE);
  });

  it('should apply leave using user id and return unified user id', () => {
    const applied = service.apply({
      userId: 'user-1793190505324',
      leaveType: LeaveType.CASUAL,
      startDate: '2026-11-05',
      endDate: '2026-11-06',
      reason: 'Personal work',
    } as any);

    expect(applied.userId).toBe('user-1793190505324');
    expect(applied.employeeId).toBe('user-1793190505324');
    expect(applied.role).toBe(Role.EMPLOYEE);
  });
});

