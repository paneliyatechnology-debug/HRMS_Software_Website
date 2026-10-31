import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { Resignation, ResignationStatus, EmployeeStatus, Role, User } from '../../common/types.js';
import { SubmitResignationDto } from './dto/submit-resignation.dto.js';
import { UpdateClearanceDto } from './dto/update-clearance.dto.js';

@Injectable()
export class ResignationsService {
  constructor(private readonly db: DatabaseService) {}

  findAll(actorUser?: User) {
    let list = this.db.resignations;

    if (actorUser) {
      if (actorUser.role === Role.EMPLOYEE) {
        list = list.filter(
          (r) =>
            r.employeeId === actorUser.id ||
            (r as any).userId === actorUser.id ||
            (actorUser.employeeId && r.employeeId === actorUser.employeeId),
        );
      } else if (actorUser.role === Role.ADMIN) {
        if (actorUser.companyId) {
          list = list.filter((r) => {
            if (r.companyId) return r.companyId === actorUser.companyId;
            const u = this.db.users.find(
              (usr) => usr.id === r.employeeId || usr.employeeId === r.employeeId || (r as any).userId === usr.id,
            );
            return u?.companyId === actorUser.companyId;
          });
        }
      }
    }

    return list.map((r) => {
      const user = this.db.users.find(
        (u) => u.id === r.employeeId || u.employeeId === r.employeeId || (r as any).userId === u.id,
      );
      const realUserId = user ? user.id : r.employeeId;
      const { employeeId: _, id: resId, ...rest } = r;
      const resObj: any = {
        id: resId,
        userId: realUserId,
        role: user?.role || 'EMPLOYEE',
        companyId: r.companyId || user?.companyId || 'cmp-1',
        companyCode: r.companyCode || user?.companyCode || 'CMP-000001',
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

  submit(data: SubmitResignationDto, actorUser?: User) {
    let targetId = (data as any).userId || data.employeeId;
    if (actorUser && actorUser.role === Role.EMPLOYEE) {
      targetId = actorUser.id;
    }
    const user = this.db.resolveUser(targetId);
    if (!user) throw new NotFoundException('User not found');
    const realUserId = user.id;

    if (actorUser && actorUser.role === Role.ADMIN) {
      if (user.companyId && actorUser.companyId && user.companyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot submit resignation for employee of another company');
      }
    }

    const noticeDays = data.noticePeriodDays || 30;
    const now = new Date();
    const lDate = new Date(now.getTime() + noticeDays * 24 * 60 * 60 * 1000);

    const newResignation: Resignation = {
      id: `res-${Date.now()}`,
      employeeId: realUserId,
      companyId: user.companyId || actorUser?.companyId || 'cmp-1',
      companyCode: user.companyCode || actorUser?.companyCode || 'CMP-000001',
      employeeName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Employee',
      employeeCode: (user as any).employeeCode || 'EMP-001',
      departmentName: (user as any).departmentName || 'General',
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

    (user as any).status = EmployeeStatus.ON_NOTICE;

    this.db.resignations.unshift(newResignation);
    this.db.logAudit(
      realUserId,
      `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      user.role || 'EMPLOYEE',
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

  updateClearance(id: string, dto: UpdateClearanceDto, actorUser?: User) {
    if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees cannot update exit clearance');
    }

    const record = this.db.resignations.find((r) => r.id === id);
    if (!record) throw new NotFoundException('Resignation record not found');

    if (actorUser && actorUser.role === Role.ADMIN) {
      if (record.companyId && actorUser.companyId && record.companyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot modify resignation of another company');
      }
    }

    const clearanceData = dto.clearance || {};
    record.clearance = { ...record.clearance, ...clearanceData };

    const allClear =
      Boolean(record.clearance.departmentClearance) &&
      Boolean(record.clearance.assetReturned) &&
      Boolean(record.clearance.financeSettlement) &&
      Boolean(record.clearance.exitInterviewCompleted);

    if (allClear) {
      record.status = ResignationStatus.COMPLETED;
      const emp = this.db.users.find((u) => u.id === record.employeeId);
      if (emp) {
        (emp as any).status = EmployeeStatus.RESIGNED;
      }
    }

    const actorName = dto.actorName || actorUser?.email || 'HR Admin';
    this.db.logAudit(
      actorUser?.id || 'sys',
      actorName,
      actorUser?.role || 'ADMIN',
      'EXIT_CLEARANCE_UPDATED',
      'Exit Management',
      `Updated exit clearance for ${record.employeeName}. All clear: ${allClear}`,
      record.id,
    );

    this.db.persist();
    return record;
  }
}
