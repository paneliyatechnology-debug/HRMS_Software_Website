import { Injectable, NotFoundException, ForbiddenException, Optional } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { PayrollRecord, Role, User } from '../../common/types.js';
import { EventsGateway } from '../events/events.gateway.js';
import { GeneratePayrollDto } from './dto/generate-payroll.dto.js';
import { UpdatePayrollStatusDto } from './dto/update-payroll-status.dto.js';
import { QueryPayrollDto } from './dto/query-payroll.dto.js';

@Injectable()
export class PayrollService {
  constructor(
    private readonly db: DatabaseService,
    @Optional() private readonly eventsGateway?: EventsGateway,
  ) {}

  findAll(params?: QueryPayrollDto, actorUser?: User) {
    let list = [...this.db.payrollRecords];

    // Multi-company isolation
    if (actorUser) {
      if (actorUser.role === Role.EMPLOYEE) {
        list = list.filter(
          (p) =>
            p.employeeId === actorUser.id ||
            (p as any).userId === actorUser.id ||
            (actorUser.employeeId && p.employeeId === actorUser.employeeId),
        );
      } else if (actorUser.role === Role.ADMIN) {
        if (actorUser.companyId) {
          const companyUserIds = new Set(
            this.db.users.filter((u) => u.companyId === actorUser.companyId).map((u) => u.id),
          );
          list = list.filter((p) => {
            if (p.companyId) return p.companyId === actorUser.companyId;
            const user = this.db.users.find(
              (u) => u.id === p.employeeId || u.employeeId === p.employeeId || (p as any).userId === u.id,
            );
            return user ? companyUserIds.has(user.id) : companyUserIds.has(p.employeeId);
          });
        }
      }
    }

    if (params?.month) {
      list = list.filter((p) => p.payrollMonth === params.month);
    }
    if (params?.status && params.status !== 'ALL') {
      list = list.filter((p) => p.status === params.status);
    }
    const filterId = (params as any)?.userId || params?.employeeId;
    if (filterId) {
      list = list.filter((p) => {
        if (p.employeeId === filterId || (p as any).userId === filterId) return true;
        const user = this.db.users.find((u) => u.id === filterId || u.employeeId === filterId);
        return user?.id === p.employeeId || user?.employeeId === p.employeeId;
      });
    }

    return list.map((p) => {
      const user = this.db.users.find(
        (u) =>
          u.id === p.employeeId ||
          u.employeeId === p.employeeId ||
          (p as any).userId === u.id ||
          ((u.firstName || '') + ' ' + (u.lastName || '')).trim().toLowerCase() ===
            (p.employeeName || '').trim().toLowerCase(),
      );
      const realUserId = user ? user.id : p.employeeId;
      const { employeeId: _, id: pId, employeeName: _empName, ...rest } = p;
      const resObj: any = {
        id: pId,
        userId: realUserId,
        role: user?.role || 'EMPLOYEE',
        userName: user
          ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || p.employeeName
          : p.employeeName,
        employeeName: user
          ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || p.employeeName
          : p.employeeName,
        companyId: p.companyId || user?.companyId || '',
        companyCode: p.companyCode || user?.companyCode || '',
        ...rest,
      };
      Object.defineProperty(resObj, 'employeeId', {
        value: realUserId,
        enumerable: false,
        configurable: true,
        writable: true,
      });
      return resObj;
    });
  }

  getPayslip(id: string, actorUser?: User) {
    const record = this.db.payrollRecords.find((p) => p.id === id);
    if (!record) throw new NotFoundException('Payslip not found');

    const user = this.db.users.find(
      (u) => u.id === record.employeeId || u.employeeId === record.employeeId,
    );
    const employee = user || this.db.employees.find((e) => e.id === record.employeeId);
    const realUserId = user ? user.id : (employee ? employee.id : record.employeeId);

    // Multi-company and Role verification
    if (actorUser) {
      if (actorUser.role === Role.EMPLOYEE) {
        const isOwner =
          realUserId === actorUser.id ||
          record.employeeId === actorUser.id ||
          (record as any).userId === actorUser.id ||
          (actorUser.employeeId && record.employeeId === actorUser.employeeId);
        if (!isOwner) {
          throw new ForbiddenException('You can only view your own payslip');
        }
      } else if (actorUser.role === Role.ADMIN) {
        const recordCompanyId = record.companyId || user?.companyId || (employee as any)?.companyId;
        if (recordCompanyId && actorUser.companyId && recordCompanyId !== actorUser.companyId) {
          throw new ForbiddenException('You cannot access payslips from another company');
        }
      }
    }

    const company = this.db.companies.find(
      (c) => c.id === (record.companyId || user?.companyId || actorUser?.companyId),
    );

    return {
      payslipId: record.id,
      company: {
        name: company?.companyName || 'Paneliya Technology Inc.',
        taxId: company?.companyCode || 'US-EIN-984102941',
        address: company?.city || '100 Silicon Vista Blvd, Suite 800, San Francisco, CA 94105',
        phone: company?.phone || '+1 (415) 555-0199',
        email: company?.email || 'payroll@paneliya.com',
      },
      employee: {
        id: realUserId,
        userId: realUserId,
        role: user?.role || 'EMPLOYEE',
        code: record.employeeCode,
        name: record.employeeName,
        designation: record.designationTitle,
        department: record.departmentName,
        joiningDate: (employee as any)?.joiningDate || '2023-01-10',
        panOrSsn: (employee as any)?.taxInformation?.panOrSsn || '***-**-4910',
        bankName: (employee as any)?.bankDetails?.bankName || 'Direct Deposit',
        accountNumber: (employee as any)?.bankDetails?.accountNumber
          ? `•••• ${(employee as any).bankDetails.accountNumber.slice(-4)}`
          : '•••• 4910',
      },
      payPeriod: record.payrollMonth,
      paymentDate: record.paymentDate || '2026-10-31',
      paymentMethod: record.paymentMethod || 'Direct Bank Transfer',
      earnings: [
        { item: 'Basic Salary', amount: record.basicSalary },
        { item: 'House Rent Allowance (HRA)', amount: record.hra },
        { item: 'Special Allowances', amount: record.allowances },
        { item: 'Performance Bonus', amount: record.bonus },
        { item: 'Overtime Compensation', amount: record.overtimePay },
      ],
      deductions: [
        { item: 'Provident Fund (PF)', amount: record.pfDeduction },
        { item: 'Income Tax (TDS / Federal Tax)', amount: record.taxDeduction },
        { item: 'Professional Tax (PT)', amount: record.professionalTax },
        { item: 'Other Deductions', amount: record.otherDeductions },
      ],
      summary: {
        grossSalary: record.grossSalary,
        totalDeductions: record.totalDeductions,
        netSalary: record.netSalary,
        currency: 'USD ($)',
        status: record.status,
      },
    };
  }

  generateBatch(dto: GeneratePayrollDto, actorUser?: User) {
    if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees cannot generate payroll batches');
    }

    const { month: payrollMonth, actorName = 'Finance Admin' } = dto;
    let activeEmployees = this.db.employees.filter(
      (e) => e.status !== 'Inactive' && e.status !== 'Resigned',
    );

    if (actorUser && actorUser.role === Role.ADMIN && actorUser.companyId) {
      activeEmployees = activeEmployees.filter(
        (e) => e.companyId === actorUser.companyId,
      );
    }

    let createdCount = 0;
    activeEmployees.forEach((emp) => {
      const existing = this.db.payrollRecords.find(
        (p) => p.employeeId === emp.id && p.payrollMonth === payrollMonth,
      );

      if (!existing) {
        const overtimePay = 0;
        const grossSalary = emp.salary.gross + overtimePay;
        const totalDeductions = emp.salary.pf + emp.salary.tax + emp.salary.professionalTax;
        const netSalary = grossSalary - totalDeductions;

        const record: PayrollRecord = {
          id: `pr-${payrollMonth}-${emp.id}`,
          payrollMonth,
          employeeId: emp.id,
          companyId: emp.companyId || actorUser?.companyId || '',
          companyCode: emp.companyCode || actorUser?.companyCode || '',
          employeeName: `${emp.firstName} ${emp.lastName}`,
          employeeCode: emp.employeeCode,
          designationTitle: emp.designationTitle,
          departmentName: emp.departmentName,
          basicSalary: emp.salary.basic,
          hra: emp.salary.hra,
          allowances: emp.salary.allowances,
          bonus: emp.salary.bonus,
          overtimePay,
          grossSalary,
          pfDeduction: emp.salary.pf,
          taxDeduction: emp.salary.tax,
          professionalTax: emp.salary.professionalTax,
          otherDeductions: 0,
          totalDeductions,
          netSalary,
          status: 'Approved',
          paymentDate: `${payrollMonth}-28`,
          paymentMethod: 'Direct Bank Transfer',
        };

        this.db.payrollRecords.push(record);
        createdCount++;
      }
    });

    this.db.logAudit(
      actorUser?.id || 'sys',
      actorName,
      actorUser?.role || 'FINANCE_ADMIN',
      'PAYROLL_GENERATED',
      'Payroll',
      `Generated payroll run for month ${payrollMonth} (${createdCount} records created)`,
    );

    this.db.persist();

    if (this.eventsGateway) {
      this.eventsGateway.emitNotification({
        title: 'Payroll Generated',
        message: `Monthly payroll run for ${payrollMonth} completed (${createdCount} payslips processed).`,
        type: 'success',
        module: 'payroll',
      });
    }

    return {
      success: true,
      month: payrollMonth,
      recordsGenerated: createdCount,
      totalRecords: this.db.payrollRecords.filter((p) => p.payrollMonth === payrollMonth).length,
    };
  }

  updateStatus(id: string, dto: UpdatePayrollStatusDto, actorUser?: User) {
    if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees cannot update payroll status');
    }

    const record = this.db.payrollRecords.find((p) => p.id === id);
    if (!record) throw new NotFoundException('Payroll record not found');

    if (actorUser && actorUser.role === Role.ADMIN) {
      if (record.companyId && actorUser.companyId && record.companyId !== actorUser.companyId) {
        throw new ForbiddenException('You cannot update payroll records of another company');
      }
    }

    const { status, actorName = 'Finance Admin' } = dto;
    record.status = status;
    if (status === 'Paid') {
      record.paymentDate = new Date().toISOString().split('T')[0];
    }

    this.db.logAudit(
      actorUser?.id || 'sys',
      actorName,
      actorUser?.role || 'FINANCE_ADMIN',
      'PAYROLL_STATUS_CHANGED',
      'Payroll',
      `Changed payroll status for ${record.employeeName} (${record.payrollMonth}) to ${status}`,
      record.id,
    );

    this.db.persist();
    return record;
  }
}
