import { Injectable, BadRequestException, NotFoundException, Optional } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { LeaveRequest, LeaveStatus, LeaveType } from '../common/types.js';
import { EventsGateway } from '../events/events.gateway.js';

@Injectable()
export class LeavesService {
  constructor(
    private readonly db: DatabaseService,
    @Optional() private readonly eventsGateway?: EventsGateway,
  ) {}

  findAll(params?: { employeeId?: string; status?: string; departmentId?: string }) {
    let list = [...this.db.leaveRequests];

    if (params?.employeeId) {
      list = list.filter((l) => l.employeeId === params.employeeId);
    }
    if (params?.status && params.status !== 'ALL') {
      list = list.filter((l) => l.status === params.status);
    }

    return list.sort((a, b) => (b.appliedDate > a.appliedDate ? 1 : -1));
  }

  getBalances(employeeId: string) {
    let balance = this.db.leaveBalances.find((b) => b.employeeId === employeeId);
    if (!balance) {
      balance = {
        id: `bal-${employeeId}`,
        employeeId,
        year: 2026,
        casualLeave: { total: 12, used: 2, remaining: 10 },
        sickLeave: { total: 10, used: 1, remaining: 9 },
        paidLeave: { total: 15, used: 3, remaining: 12 },
      };
      this.db.leaveBalances.push(balance);
      this.db.persist();
    }
    return balance;
  }

  apply(data: {
    employeeId: string;
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    isHalfDay?: boolean;
    reason: string;
  }) {
    if (!data.startDate || !data.endDate) {
      throw new BadRequestException('Start date and end date are required');
    }
    if (new Date(data.endDate) < new Date(data.startDate)) {
      throw new BadRequestException('End date cannot be prior to start date');
    }

    const employee = this.db.employees.find((e) => e.id === data.employeeId);
    if (!employee) throw new NotFoundException('Employee not found');

    // Calculate days count
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = data.isHalfDay ? 0.5 : Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const newRequest: LeaveRequest = {
      id: `lr-${Date.now()}`,
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      employeeAvatar: employee.avatarUrl,
      departmentName: employee.departmentName,
      leaveType: data.leaveType,
      startDate: data.startDate,
      endDate: data.endDate,
      daysCount: diffDays,
      isHalfDay: Boolean(data.isHalfDay),
      reason: data.reason,
      status: LeaveStatus.PENDING,
      appliedDate: new Date().toISOString().split('T')[0],
      managerApproverId: employee.reportingManagerId,
      managerApproverName: employee.reportingManagerName || 'Team Manager',
      comments: 'Pending review',
    };

    this.db.leaveRequests.unshift(newRequest);

    this.db.logAudit(
      employee.id,
      `${employee.firstName} ${employee.lastName}`,
      'EMPLOYEE',
      'LEAVE_APPLIED',
      'Leave Management',
      `Applied for ${diffDays} day(s) of ${data.leaveType} (${data.startDate} to ${data.endDate})`,
      newRequest.id
    );

    // Notify Manager / HR
    this.db.notifications.unshift({
      id: `notif-${Date.now()}`,
      title: 'New Leave Application',
      message: `${employee.firstName} ${employee.lastName} applied for ${data.leaveType} (${diffDays} days).`,
      type: 'leave',
      isRead: false,
      createdAt: new Date().toISOString(),
      link: '/leaves',
    });

    this.db.persist();

    if (this.eventsGateway) {
      this.eventsGateway.emitNotification({
        title: 'New Leave Request',
        message: `${employee.firstName} ${employee.lastName} requested ${diffDays} day(s) of ${data.leaveType}.`,
        type: 'warning',
        module: 'leave',
      });
    }

    return newRequest;
  }

  approve(id: string, approverRole: string, approverName = 'Approver', comments?: string) {
    const request = this.db.leaveRequests.find((l) => l.id === id);
    if (!request) throw new NotFoundException('Leave request not found');

    if (request.status === LeaveStatus.APPROVED) {
      throw new BadRequestException('Leave request is already approved');
    }

    request.status = LeaveStatus.APPROVED;
    request.comments = comments || 'Leave application approved';

    if (approverRole === 'MANAGER') {
      request.managerApprovedAt = new Date().toISOString();
      request.managerApproverName = approverName;
    } else {
      request.hrApprovedAt = new Date().toISOString();
    }

    // Business Rule: Update balance ONLY after approval
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
      request.id
    );

    // Send confirmation notification to employee
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

    return request;
  }

  reject(id: string, approverName = 'Approver', reason = 'Leave request rejected by management') {
    const request = this.db.leaveRequests.find((l) => l.id === id);
    if (!request) throw new NotFoundException('Leave request not found');

    request.status = LeaveStatus.REJECTED;
    request.comments = reason;

    this.db.logAudit(
      'sys',
      approverName,
      'MANAGER',
      'LEAVE_REJECTED',
      'Leave Management',
      `Rejected leave request for ${request.employeeName}. Reason: ${reason}`,
      request.id
    );

    this.db.persist();

    if (this.eventsGateway) {
      this.eventsGateway.emitLeaveUpdate({
        id: request.id,
        employeeName: request.employeeName,
        status: 'Rejected',
      });
    }

    return request;
  }
}
