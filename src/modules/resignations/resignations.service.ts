import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { Resignation, ResignationStatus, EmployeeStatus } from '../../common/types.js';
import { SubmitResignationDto } from './dto/submit-resignation.dto.js';
import { UpdateClearanceDto } from './dto/update-clearance.dto.js';

@Injectable()
export class ResignationsService {
  constructor(private readonly db: DatabaseService) { }

  findAll() {
    return this.db.resignations.map((r) => {
      const user = this.db.users.find(
        (u) => u.id === r.employeeId || u.employeeId === r.employeeId || (r as any).userId === u.id,
      );
      const realUserId = user ? user.id : r.employeeId;
      const { employeeId: _, id: resId, ...rest } = r;
      const resObj: any = {
        id: resId,
        userId: realUserId,
        role: user?.role || 'EMPLOYEE',
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

  submit(data: SubmitResignationDto) {
    const targetId = (data as any).userId || data.employeeId;
    const user = this.db.resolveUser(targetId);
    if (!user) throw new NotFoundException('User not found');
    const realUserId = user.id;
    const employee = user;

    const noticeDays = data.noticePeriodDays || 30;
    const now = new Date();
    const lDate = new Date(now.getTime() + noticeDays * 24 * 60 * 60 * 1000);

    const newResignation: Resignation = {
      id: `res-${Date.now()}`,
      employeeId: realUserId,
      employeeName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'Employee',
      employeeCode: (employee as any).employeeCode || 'EMP-001',
      departmentName: (employee as any).departmentName || 'General',
      resignationDate: now.toISOString().split('T')[0],
      lastWorkingDay: lDate.toISOString().split('T')[0],
      noticePeriodDays: noticeDays,
      reason: data.reason,
      status: ResignationStatus.SUBMITTED,
      managerApproval: {
        status: 'Pending',
      },
      clearance: {
        departmentClearance: false,
        assetReturned: false,
        financeSettlement: false,
        exitInterviewCompleted: false,
      },
    };
    (newResignation as any).userId = realUserId;
    (newResignation as any).role = user?.role || 'EMPLOYEE';

    employee.status = EmployeeStatus.ON_NOTICE;

    this.db.resignations.unshift(newResignation);
    this.db.logAudit(
      realUserId,
      `${employee.firstName} ${employee.lastName}`,
      'EMPLOYEE',
      'RESIGNATION_SUBMITTED',
      'Exit Management',
      `Submitted resignation. Last working day: ${newResignation.lastWorkingDay}`,
      newResignation.id,
    );

    this.db.persist();

    const { employeeId: _, id: resId, ...rest } = newResignation;
    const resObj: any = {
      id: resId,
      userId: realUserId,
      ...rest,
    };
    Object.defineProperty(resObj, 'employeeId', {
      value: realUserId,
      enumerable: false,
      configurable: true,
      writable: true,
    });
    return resObj;
  }

  updateClearance(id: string, dto: UpdateClearanceDto) {
    const record = this.db.resignations.find((r) => r.id === id);
    if (!record) throw new NotFoundException('Resignation record not found');

    const clearanceData = dto.clearance || {};
    record.clearance = { ...record.clearance, ...clearanceData };

    const allClear =
      Boolean(record.clearance.departmentClearance) &&
      Boolean(record.clearance.assetReturned) &&
      Boolean(record.clearance.financeSettlement) &&
      Boolean(record.clearance.exitInterviewCompleted);

    if (allClear) {
      record.status = ResignationStatus.COMPLETED;
      const emp = this.db.employees.find((e) => e.id === record.employeeId);
      if (emp) {
        emp.status = EmployeeStatus.RESIGNED;
      }
    }

    const actorName = dto.actorName || 'HR Admin';
    this.db.logAudit(
      'sys',
      actorName,
      'ADMIN',
      'EXIT_CLEARANCE_UPDATED',
      'Exit Management',
      `Updated exit clearance for ${record.employeeName}. All clear: ${allClear}`,
      record.id,
    );

    this.db.persist();
    return record;
  }
}
