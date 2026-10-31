import { describe, it, expect, beforeEach } from 'vitest';
import { PayrollService } from './payroll.service.js';
import { Role } from '../../common/types.js';

describe('PayrollService', () => {
  let service: PayrollService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      payrollRecords: [
        {
          id: 'pay-1',
          employeeId: 'emp-1',
          employeeCode: 'EMP-001',
          employeeName: 'John Doe',
          payrollMonth: '2026-10',
          grossPay: 5000,
          totalDeductions: 500,
          netPay: 4500,
          status: 'Paid',
        },
        {
          id: 'pay-2',
          employeeId: 'emp-2',
          employeeCode: 'EMP-002',
          employeeName: 'Jane Smith',
          payrollMonth: '2026-10',
          grossPay: 6000,
          totalDeductions: 600,
          netPay: 5400,
          status: 'Pending',
        },
      ],
      employees: [
        {
          id: 'emp-1',
          companyId: 'cmp-1',
          employeeCode: 'EMP-001',
          firstName: 'John',
          lastName: 'Doe',
        },
        {
          id: 'emp-2',
          companyId: 'cmp-2',
          employeeCode: 'EMP-002',
          firstName: 'Jane',
          lastName: 'Smith',
        },
      ],
      users: [
        {
          id: 'user-1',
          email: 'john@cmp1.com',
          role: Role.EMPLOYEE,
          companyId: 'cmp-1',
          employeeId: 'emp-1',
          employeeCode: 'EMP-001',
        },
        {
          id: 'admin-1',
          email: 'admin@cmp1.com',
          role: Role.ADMIN,
          companyId: 'cmp-1',
        },
      ],
    };
    service = new PayrollService(mockDb as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return all payroll records for Super Admin', () => {
    const records = service.findAll();
    expect(records.length).toBe(2);
  });

  it('should enforce company isolation for Admin', () => {
    const adminUser = mockDb.users[1];
    const records = service.findAll(undefined, adminUser);
    expect(records.length).toBe(1);
    expect(records[0].employeeId).toBe('user-1');
    expect(records[0].userId).toBe('user-1');
  });

  it('should return payslip details', () => {
    const slip = service.getPayslip('pay-1');
    expect(slip).toBeDefined();
    expect(slip.payslipId).toBe('pay-1');
    expect(slip.employee.name).toBe('John Doe');
  });
});

