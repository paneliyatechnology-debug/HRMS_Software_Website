import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { Resignation, ResignationStatus, EmployeeStatus } from '../../common/types.js';
import { SubmitResignationDto } from './dto/submit-resignation.dto.js';
import { UpdateClearanceDto } from './dto/update-clearance.dto.js';

@Injectable()
export class ResignationsService {
  constructor(private readonly db: DatabaseService) { }

  findAll() {
    return this.db.resignations;
  }

  submit(data: SubmitResignationDto) {
    const employee = this.db.employees.find((e) => e.id === data.employeeId);
    if (!employee) throw new NotFoundException('Employee not found');

    const noticeDays = data.noticePeriodDays || 30;
    const now = new Date();
    const lDate = new Date(now.getTime() + noticeDays * 24 * 60 * 60 * 1000);

    const newResignation: Resignation = {
      id: `res-${Date.now()}`,
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      employeeCode: employee.employeeCode,
      departmentName: employee.departmentName,
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

    employee.status = EmployeeStatus.ON_NOTICE;

    this.db.resignations.unshift(newResignation);
    this.db.logAudit(
      employee.id,
      `${employee.firstName} ${employee.lastName}`,
      'EMPLOYEE',
      'RESIGNATION_SUBMITTED',
      'Exit Management',
      `Submitted resignation. Last working day: ${newResignation.lastWorkingDay}`,
      newResignation.id,
    );

    this.db.persist();
    return newResignation;
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
