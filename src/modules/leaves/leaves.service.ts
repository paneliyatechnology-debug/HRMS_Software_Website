import { Injectable, BadRequestException, NotFoundException, Optional } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { LeaveRequest, LeaveStatus, LeaveType, Role, User } from '../../common/types.js';
import { EventsGateway } from '../events/events.gateway.js';
import { ApplyLeaveDto } from './dto/apply-leave.dto.js';
import { ApproveLeaveDto } from './dto/approve-leave.dto.js';
import { RejectLeaveDto } from './dto/reject-leave.dto.js';
import { QueryLeaveDto } from './dto/query-leave.dto.js';

@Injectable()
export class LeavesService {
  constructor(
    private readonly db: DatabaseService,
    @Optional() private readonly eventsGateway?: EventsGateway,
  ) {}

  findAll(params?: QueryLeaveDto, actorUser?: User) {
    let list = [...this.db.leaveRequests];

    // Company isolation for ADMIN or EMPLOYEE
    if (actorUser && (actorUser.role === Role.ADMIN || actorUser.role === Role.EMPLOYEE)) {
      if (actorUser.companyId) {
        const companyUserIds = new Set(
          this.db.users.filter((u) => u.companyId === actorUser.companyId).map((u) => u.id),
        );
        list = list.filter((l) => {
          const user = this.db.users.find(
            (u) => u.id === l.employeeId || u.employeeId === l.employeeId || (l as any).userId === u.id,
          );
          return user ? companyUserIds.has(user.id) : companyUserIds.has(l.employeeId);
        });
      }
    }

    const filterId = params?.userId || params?.employeeId;
    if (filterId) {
      list = list.filter((l) => {
        if (l.employeeId === filterId || (l as any).userId === filterId) return true;
        const user = this.db.users.find((u) => u.id === l.employeeId || u.employeeId === l.employeeId);
        return user?.id === filterId || user?.employeeId === filterId;
      });
    }
    if (params?.status && params.status !== 'ALL') {
      list = list.filter((l) => l.status === params.status);
    }

    return list
      .map((l) => {
        const user = this.db.users.find(
          (u) =>
            u.id === l.employeeId ||
            u.employeeId === l.employeeId ||
            (l as any).userId === u.id ||
            ((u.firstName || '') + ' ' + (u.lastName || '')).trim().toLowerCase() ===
              (l.employeeName || '').trim().toLowerCase(),
        );
        const realUserId = user ? user.id : l.employeeId;
        const { employeeId: _, id, employeeName: _empName, departmentName: _deptName, ...rest } = l;
        const resObj: any = {
          id,
          userId: realUserId,
          role: user?.role || 'EMPLOYEE',
          userName: user
            ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || l.employeeName
            : l.employeeName,
          employeeName: user
            ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || l.employeeName
            : l.employeeName,
          employeeAvatar: user?.avatarUrl || l.employeeAvatar,
          departmentName: user?.departmentName || l.departmentName,
          ...rest,
        };
        Object.defineProperty(resObj, 'employeeId', {
          value: realUserId,
          enumerable: false,
          configurable: true,
          writable: true,
        });
        return resObj;
      })
      .sort((a, b) => (b.appliedDate > a.appliedDate ? 1 : -1));
  }

  getBalances(employeeId: string) {
    const user = this.db.resolveUser
      ? this.db.resolveUser(employeeId)
      : this.db.users?.find(
          (u) =>
            u.id === employeeId ||
            u.employeeId === employeeId ||
            (u.email && u.email.toLowerCase() === employeeId.toLowerCase()),
        );
    const targetUserId = user ? user.id : employeeId;

    let balance = this.db.leaveBalances.find(
      (b) => b.employeeId === targetUserId || b.employeeId === employeeId,
    );
    if (!balance) {
      balance = {
        id: `bal-${targetUserId}`,
        employeeId: targetUserId,
        year: 2026,
        casualLeave: { total: 12, used: 0, remaining: 12 },
        sickLeave: { total: 10, used: 0, remaining: 10 },
        paidLeave: { total: 15, used: 0, remaining: 15 },
      };
      this.db.leaveBalances.push(balance);
      this.db.persist();
    }
    const { employeeId: _, id, ...rest } = balance;
    const resObj: any = {
      id,
      userId: targetUserId,
      role: user?.role || 'EMPLOYEE',
      ...rest,
    };
    Object.defineProperty(resObj, 'employeeId', {
      value: targetUserId,
      enumerable: false,
      configurable: true,
      writable: true,
    });
    return resObj;
  }

  apply(data: ApplyLeaveDto) {
    if (!data.startDate || !data.endDate) {
      throw new BadRequestException('Start date and end date are required');
    }
    if (new Date(data.endDate) < new Date(data.startDate)) {
      throw new BadRequestException('End date cannot be prior to start date');
    }

    const targetId = data.userId || data.employeeId;
    if (!targetId) {
      throw new BadRequestException('userId is required');
    }

    const user = this.db.resolveUser
      ? this.db.resolveUser(targetId)
      : this.db.users?.find(
          (u) =>
            u.id === targetId ||
            u.employeeId === targetId ||
            (u.email && u.email.toLowerCase() === targetId.toLowerCase()),
        );
    if (!user) throw new NotFoundException('User record not found');

    const realUserId = user.id;
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
    const avatarUrl = user.avatarUrl || '';
    const deptName = user.departmentName || '';
    const managerId = user.reportingManagerId || '';
    const managerName = user.reportingManagerName || 'Team Manager';
    const userRole = user.role || Role.EMPLOYEE;

    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = data.isHalfDay ? 0.5 : Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const newRequest: LeaveRequest = {
      id: `lr-${Date.now()}`,
      employeeId: realUserId,
      employeeName: fullName || 'Employee',
      employeeAvatar: avatarUrl,
      departmentName: deptName,
      leaveType: data.leaveType,
      startDate: data.startDate,
      endDate: data.endDate,
      daysCount: diffDays,
      isHalfDay: Boolean(data.isHalfDay),
      reason: data.reason,
      status: LeaveStatus.PENDING,
      appliedDate: new Date().toISOString().split('T')[0],
      managerApproverId: managerId,
      managerApproverName: managerName,
      comments: 'Pending review',
    };
    (newRequest as any).userId = realUserId;
    (newRequest as any).role = userRole;

    this.db.leaveRequests.unshift(newRequest);

    this.db.logAudit(
      realUserId,
      fullName || 'Employee',
      userRole,
      'LEAVE_APPLIED',
      'Leave Management',
      `Applied for ${diffDays} day(s) of ${data.leaveType} (${data.startDate} to ${data.endDate})`,
      newRequest.id,
    );

    this.db.notifications.unshift({
      id: `notif-${Date.now()}`,
      title: 'New Leave Application',
      message: `${fullName || 'Employee'} applied for ${data.leaveType} (${diffDays} days).`,
      type: 'leave',
      isRead: false,
      createdAt: new Date().toISOString(),
      link: '/leaves',
    });

    this.db.persist();

    if (this.eventsGateway) {
      this.eventsGateway.emitNotification({
        title: 'New Leave Request',
        message: `${fullName || 'Employee'} requested ${diffDays} day(s) of ${data.leaveType}.`,
        type: 'warning',
        module: 'leave',
      });
    }

    const { employeeId: _, id, ...rest } = newRequest;
    const responseObj: any = {
      id,
      userId: realUserId,
      userName: fullName || 'Employee',
      role: userRole,
      ...rest,
    };
    Object.defineProperty(responseObj, 'employeeId', {
      value: realUserId,
      enumerable: false,
      configurable: true,
      writable: true,
    });
    return responseObj;
  }

  approve(id: string, dto: ApproveLeaveDto) {
    const request = this.db.leaveRequests.find((l) => l.id === id);
    if (!request) throw new NotFoundException('Leave request not found');

    if (request.status === LeaveStatus.APPROVED) {
      throw new BadRequestException('Leave request is already approved');
    }

    const approverRole = dto.role || 'ADMIN';
    const approverName = dto.approverName || 'Approver';
    const comments = dto.comments || 'Leave application approved';

    request.status = LeaveStatus.APPROVED;
    request.comments = comments;

    if (approverRole === 'MANAGER') {
      request.managerApprovedAt = new Date().toISOString();
      request.managerApproverName = approverName;
    } else {
      request.hrApprovedAt = new Date().toISOString();
    }

    const balance = this.getBalances(request.employeeId);
    if (request.leaveType === LeaveType.CASUAL) {
      balance.casualLeave.used += request.daysCount;
      balance.casualLeave.remaining = Math.max(0, balance.casualLeave.total - balance.casualLeave.used);
    } else if (request.leaveType === LeaveType.SICK) {
      balance.sickLeave.used += request.daysCount;
      balance.sickLeave.remaining = Math.max(0, balance.sickLeave.total - balance.sickLeave.used);
    } else {
      balance.paidLeave.used += request.daysCount;
      balance.paidLeave.remaining = Math.max(0, balance.paidLeave.total - balance.paidLeave.used);
    }

    this.db.logAudit(
      'sys',
      approverName,
      approverRole,
      'LEAVE_APPROVED',
      'Leave Management',
      `Approved leave request for ${request.employeeName} (${request.daysCount} days)`,
      request.id,
    );

    this.db.notifications.unshift({
      id: `notif-${Date.now()}`,
      title: 'Leave Approved',
      message: `Your leave request for ${request.startDate} to ${request.endDate} has been approved.`,
      type: 'leave',
      isRead: false,
      createdAt: new Date().toISOString(),
      link: '/leaves',
    });

    this.db.persist();

    if (this.eventsGateway) {
      this.eventsGateway.emitLeaveUpdate({
        id: request.id,
        employeeName: request.employeeName,
        status: 'Approved',
      });
    }

    const user = this.db.users.find(
      (u) => u.id === request.employeeId || u.employeeId === request.employeeId,
    );
    const realUserId = user ? user.id : request.employeeId;
    const { employeeId: _, id: reqId, ...rest } = request;
    const resObj: any = {
      id: reqId,
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
  }

  reject(id: string, dto: RejectLeaveDto) {
    const request = this.db.leaveRequests.find((l) => l.id === id);
    if (!request) throw new NotFoundException('Leave request not found');

    const approverName = dto.approverName || 'Approver';
    const reason = dto.reason || 'Leave request rejected by management';

    request.status = LeaveStatus.REJECTED;
    request.comments = reason;

    this.db.logAudit(
      'sys',
      approverName,
      'MANAGER',
      'LEAVE_REJECTED',
      'Leave Management',
      `Rejected leave request for ${request.employeeName}. Reason: ${reason}`,
      request.id,
    );

    this.db.persist();

    if (this.eventsGateway) {
      this.eventsGateway.emitLeaveUpdate({
        id: request.id,
        employeeName: request.employeeName,
        status: 'Rejected',
      });
    }

    const user = this.db.users.find(
      (u) => u.id === request.employeeId || u.employeeId === request.employeeId,
    );
    const realUserId = user ? user.id : request.employeeId;
    const { employeeId: _, id: reqId, ...rest } = request;
    const resObj: any = {
      id: reqId,
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
  }
}
