import { Injectable, BadRequestException, NotFoundException, ForbiddenException, ConflictException, Optional } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { LeaveRequest, LeaveStatus, LeaveType, Role, User, NotificationItem, LeaveTypeItem } from '../../common/types.js';
import { EventsGateway } from '../events/events.gateway.js';
import { ApplyLeaveDto } from './dto/apply-leave.dto.js';
import { ApproveLeaveDto } from './dto/approve-leave.dto.js';
import { RejectLeaveDto } from './dto/reject-leave.dto.js';
import { QueryLeaveDto } from './dto/query-leave.dto.js';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto.js';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto.js';

export function normalizeQuota(val: any, defTotal: number): { total: number; used: number; remaining: number } {
  let p = val;
  while (typeof p === 'string') {
    try {
      p = JSON.parse(p);
    } catch {
      break;
    }
  }
  if (!p || typeof p !== 'object' || Array.isArray(p)) {
    return { total: defTotal, used: 0, remaining: defTotal };
  }
  const total = Number(p.total) || defTotal;
  const used = Number(p.used) || 0;
  const remaining = Number(p.remaining !== undefined ? p.remaining : total - used);
  return { total, used, remaining };
}

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
        list = list.filter((l) => {
          if ((l as any).companyId) {
            return (l as any).companyId === actorUser.companyId;
          }
          const user = this.db.users.find(
            (u) => u.id === l.employeeId || u.employeeId === l.employeeId || (l as any).userId === u.id,
          );
          return user ? user.companyId === actorUser.companyId : false;
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

  async getBalances(employeeId: string, actorUser?: User) {
    const user = this.db.resolveUser
      ? this.db.resolveUser(employeeId)
      : this.db.users?.find(
          (u) =>
            u.id === employeeId ||
            u.employeeId === employeeId ||
            (u.email && u.email.toLowerCase() === employeeId.toLowerCase()),
        );
    const targetUserId = user ? user.id : employeeId;

    if (actorUser && actorUser.role === Role.ADMIN) {
      if (user && actorUser.companyId && user.companyId && user.companyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot view leave balance of employee belonging to another company.');
      }
    } else if (actorUser && actorUser.role === Role.EMPLOYEE) {
      if (targetUserId !== actorUser.id) {
        throw new ForbiddenException('Employees can only view their own leave balances.');
      }
    }

    let balance = this.db.leaveBalances.find(
      (b) => b.employeeId === targetUserId || b.employeeId === employeeId,
    );
    if (!balance) {
      balance = {
        id: `bal-${targetUserId}`,
        companyId: user?.companyId || actorUser?.companyId || null,
        companyCode: user?.companyCode || actorUser?.companyCode || null,
        employeeId: targetUserId,
        year: 2026,
        casualLeave: { total: 12, used: 0, remaining: 12 },
        sickLeave: { total: 10, used: 0, remaining: 10 },
        paidLeave: { total: 15, used: 0, remaining: 15 },
      };
      this.db.leaveBalances.push(balance);
      await this.db.saveLeaveBalanceToMysql(balance);
      this.db.persist();
    } else {
      balance.casualLeave = normalizeQuota(balance.casualLeave, 12);
      balance.sickLeave = normalizeQuota(balance.sickLeave, 10);
      balance.paidLeave = normalizeQuota(balance.paidLeave, 15);
    }
    const { employeeId: _, id, ...rest } = balance;
    const resObj: any = {
      id,
      userId: targetUserId,
      role: user?.role || 'EMPLOYEE',
      ...rest,
      casualLeave: balance.casualLeave,
      sickLeave: balance.sickLeave,
      paidLeave: balance.paidLeave,
    };
    Object.defineProperty(resObj, 'employeeId', {
      value: targetUserId,
      enumerable: false,
      configurable: true,
      writable: true,
    });
    return resObj;
  }

  async apply(data: ApplyLeaveDto, actorUser?: User) {
    if (!data.startDate || !data.endDate) {
      throw new BadRequestException('Start date and end date are required');
    }
    if (new Date(data.endDate) < new Date(data.startDate)) {
      throw new BadRequestException('End date cannot be prior to start date');
    }

    let targetId = data.userId || data.employeeId;
    // Prevent spoofing by employee: an employee can only apply for themselves
    if (actorUser && actorUser.role === Role.EMPLOYEE) {
      targetId = actorUser.id;
    }

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

    if (actorUser && actorUser.role === Role.ADMIN) {
      if (actorUser.companyId && user.companyId && user.companyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot apply leave for an employee in another company.');
      }
    }

    const realUserId = user.id;
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
    const avatarUrl = user.avatarUrl || '';
    const deptName = user.departmentName || '';
    const managerId = user.reportingManagerId || '';
    const managerName = user.reportingManagerName || 'Team Manager';
    const userRole = user.role || Role.EMPLOYEE;
    const companyId = user.companyId || actorUser?.companyId || null;
    const companyCode = user.companyCode || actorUser?.companyCode || null;

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
    (newRequest as any).companyId = companyId;
    (newRequest as any).companyCode = companyCode;

    this.db.leaveRequests.unshift(newRequest);
    await this.db.saveLeaveRequestToMysql(newRequest);
    this.db.persist();

    this.db.logAudit(
      realUserId,
      fullName || 'Employee',
      userRole,
      'LEAVE_APPLIED',
      'Leave Management',
      `Applied for ${diffDays} day(s) of ${data.leaveType} (${data.startDate} to ${data.endDate})`,
      newRequest.id,
    );

    const notifObj: NotificationItem = {
      id: `notif-${Date.now()}`,
      companyId,
      companyCode,
      userId: realUserId,
      title: 'New Leave Application',
      message: `${fullName || 'Employee'} applied for ${data.leaveType} (${diffDays} days).`,
      type: 'leave',
      isRead: false,
      createdAt: new Date().toISOString(),
      link: '/leaves',
    };
    this.db.notifications.unshift(notifObj);
    void this.db.saveNotificationToMysql(notifObj);

    this.db.persist();

    if (this.eventsGateway) {
      this.eventsGateway.emitNotification({
        title: 'New Leave Request',
        message: `${fullName || 'Employee'} requested ${diffDays} day(s) of ${data.leaveType}.`,
        type: 'warning',
        module: 'leave',
        companyId,
        companyCode,
        userId: realUserId,
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

  async approve(id: string, dto: ApproveLeaveDto, actorUser?: User) {
    let request = this.db.leaveRequests.find((l) => l.id === id);
    if (!request && this.db.getMysqlPool() && this.db.isConnectedToMysql) {
      try {
        const [rows]: any = await this.db.getMysqlPool()!.query('SELECT * FROM leave_requests WHERE id = ? LIMIT 1', [id]);
        if (rows && rows.length > 0) {
          request = rows[0] as LeaveRequest;
          this.db.leaveRequests.unshift(request);
        }
      } catch {}
    }
    if (!request) throw new NotFoundException('Leave request not found');

    if (actorUser && actorUser.role === Role.ADMIN) {
      const reqCompanyId =
        (request as any).companyId ||
        this.db.users.find((u) => u.id === request.employeeId)?.companyId;
      if (actorUser.companyId && reqCompanyId && reqCompanyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot approve leave belonging to another company.');
      }
    } else if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees are not authorized to approve leave requests.');
    }

    if (request.status === LeaveStatus.APPROVED) {
      throw new BadRequestException('Leave request is already approved');
    }

    const approverRole = dto.role || actorUser?.role || 'ADMIN';
    const approverName = dto.approverName || (actorUser ? `${actorUser.firstName} ${actorUser.lastName}` : 'Approver');
    const comments = dto.comments || 'Leave application approved';

    request.status = LeaveStatus.APPROVED;
    request.comments = comments;

    if (approverRole === 'MANAGER') {
      request.managerApprovedAt = new Date().toISOString();
      request.managerApproverName = approverName;
    } else {
      request.hrApprovedAt = new Date().toISOString();
    }

    const balance = await this.getBalances(request.employeeId);
    balance.casualLeave = normalizeQuota(balance.casualLeave, 12);
    balance.sickLeave = normalizeQuota(balance.sickLeave, 10);
    balance.paidLeave = normalizeQuota(balance.paidLeave, 15);

    if (request.leaveType === LeaveType.CASUAL) {
      balance.casualLeave.used = (balance.casualLeave.used || 0) + request.daysCount;
      balance.casualLeave.remaining = Math.max(0, balance.casualLeave.total - balance.casualLeave.used);
    } else if (request.leaveType === LeaveType.SICK) {
      balance.sickLeave.used = (balance.sickLeave.used || 0) + request.daysCount;
      balance.sickLeave.remaining = Math.max(0, balance.sickLeave.total - balance.sickLeave.used);
    } else {
      balance.paidLeave.used = (balance.paidLeave.used || 0) + request.daysCount;
      balance.paidLeave.remaining = Math.max(0, balance.paidLeave.total - balance.paidLeave.used);
    }

    this.db.logAudit(
      actorUser?.id || 'sys',
      approverName,
      approverRole,
      'LEAVE_APPROVED',
      'Leave Management',
      `Approved leave request for ${request.employeeName} (${request.daysCount} days)`,
      request.id,
    );

    const user = this.db.users.find(
      (u) => u.id === request.employeeId || u.employeeId === request.employeeId,
    );
    const realUserId = user ? user.id : request.employeeId;
    const companyId = (request as any).companyId || user?.companyId || null;
    const companyCode = (request as any).companyCode || user?.companyCode || null;

    const approvedNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      companyId,
      companyCode,
      userId: realUserId,
      title: 'Leave Approved',
      message: `Your leave request for ${request.startDate} to ${request.endDate} has been approved.`,
      type: 'leave',
      isRead: false,
      createdAt: new Date().toISOString(),
      link: '/leaves',
    };
    this.db.notifications.unshift(approvedNotif);
    void this.db.saveNotificationToMysql(approvedNotif);

    this.db.persist();
    await this.db.saveLeaveRequestToMysql(request);
    const rawBalance = this.db.leaveBalances.find(
      (b) => b.employeeId === request.employeeId || (request as any).userId === b.employeeId,
    );
    if (rawBalance) {
      rawBalance.casualLeave = balance.casualLeave;
      rawBalance.sickLeave = balance.sickLeave;
      rawBalance.paidLeave = balance.paidLeave;
      await this.db.saveLeaveBalanceToMysql(rawBalance);
    }

    if (this.eventsGateway) {
      this.eventsGateway.emitLeaveUpdate({
        id: request.id,
        employeeName: request.employeeName,
        status: 'Approved',
        companyId,
        companyCode,
        userId: realUserId,
      });
    }
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

  async reject(id: string, dto: RejectLeaveDto, actorUser?: User) {
    let request = this.db.leaveRequests.find((l) => l.id === id);
    if (!request && this.db.getMysqlPool() && this.db.isConnectedToMysql) {
      try {
        const [rows]: any = await this.db.getMysqlPool()!.query('SELECT * FROM leave_requests WHERE id = ? LIMIT 1', [id]);
        if (rows && rows.length > 0) {
          request = rows[0] as LeaveRequest;
          this.db.leaveRequests.unshift(request);
        }
      } catch {}
    }
    if (!request) throw new NotFoundException('Leave request not found');

    if (actorUser && actorUser.role === Role.ADMIN) {
      const reqCompanyId =
        (request as any).companyId ||
        this.db.users.find((u) => u.id === request.employeeId)?.companyId;
      if (actorUser.companyId && reqCompanyId && reqCompanyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot reject leave belonging to another company.');
      }
    } else if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees are not authorized to reject leave requests.');
    }

    const approverName = dto.approverName || (actorUser ? `${actorUser.firstName} ${actorUser.lastName}` : 'Approver');
    const reason = dto.reason || 'Leave request rejected by management';

    request.status = LeaveStatus.REJECTED;
    request.comments = reason;

    this.db.logAudit(
      actorUser?.id || 'sys',
      approverName,
      actorUser?.role || 'MANAGER',
      'LEAVE_REJECTED',
      'Leave Management',
      `Rejected leave request for ${request.employeeName}. Reason: ${reason}`,
      request.id,
    );

    const user = this.db.users.find(
      (u) => u.id === request.employeeId || u.employeeId === request.employeeId,
    );
    const realUserId = user ? user.id : request.employeeId;
    const companyId = (request as any).companyId || user?.companyId || null;
    const companyCode = (request as any).companyCode || user?.companyCode || null;

    const rejectedNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      companyId,
      companyCode,
      userId: realUserId,
      title: 'Leave Rejected',
      message: `Your leave request for ${request.startDate} to ${request.endDate} was rejected. Reason: ${reason}`,
      type: 'leave',
      isRead: false,
      createdAt: new Date().toISOString(),
      link: '/leaves',
    };
    this.db.notifications.unshift(rejectedNotif);
    void this.db.saveNotificationToMysql(rejectedNotif);

    this.db.persist();
    await this.db.saveLeaveRequestToMysql(request);

    if (this.eventsGateway) {
      this.eventsGateway.emitLeaveUpdate({
        id: request.id,
        employeeName: request.employeeName,
        status: 'Rejected',
        companyId,
        companyCode,
        userId: realUserId,
      });
    }

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

  // ===================== LEAVE TYPES CRUD =====================

  /**
   * Helper to ensure default leave types exist for a company so list is never empty.
   */
  private async ensureDefaultLeaveTypes(companyId?: string | null, companyCode?: string | null): Promise<void> {
    const existing = this.db.leaveTypes.filter(
      (lt) => (companyId && lt.companyId === companyId) || (!companyId && !lt.companyId),
    );
    if (existing.length > 0) return;

    const defaults = [
      { name: 'Casual Leave', code: 'CL', daysAllowed: 12, isPaid: true, color: '#3b82f6', description: 'Annual casual leave allowance' },
      { name: 'Sick Leave', code: 'SL', daysAllowed: 10, isPaid: true, color: '#ef4444', description: 'Medical and sick leave' },
      { name: 'Paid Leave', code: 'PL', daysAllowed: 15, isPaid: true, color: '#10b981', description: 'Annual earned paid leave' },
      { name: 'Maternity Leave', code: 'ML', daysAllowed: 90, isPaid: true, color: '#ec4899', description: 'Maternity leave benefit' },
      { name: 'Unpaid Leave', code: 'UL', daysAllowed: 0, isPaid: false, color: '#6b7280', description: 'Leave without pay' },
    ];

    const now = new Date().toISOString();
    for (let i = 0; i < defaults.length; i++) {
      const def = defaults[i];
      const lt: LeaveTypeItem = {
        id: `lt-${Date.now()}-${i}`,
        companyId: companyId || null,
        companyCode: companyCode || null,
        name: def.name,
        code: def.code,
        description: def.description,
        daysAllowed: def.daysAllowed,
        isPaid: def.isPaid,
        requiresApproval: true,
        carryForward: def.code === 'PL',
        maxCarryForwardDays: def.code === 'PL' ? 5 : 0,
        status: 'Active',
        color: def.color,
        createdAt: now,
        updatedAt: now,
      };
      this.db.leaveTypes.push(lt);
      await this.db.saveLeaveTypeToMysql(lt);
    }
    this.db.persist();
  }

  async getLeaveTypes(actorUser?: User, companyFilter?: string): Promise<LeaveTypeItem[]> {
    let targetCompanyId: string | null = null;
    let targetCompanyCode: string | null = null;

    if (actorUser) {
      if (actorUser.role === Role.ADMIN || actorUser.role === Role.EMPLOYEE) {
        targetCompanyId = actorUser.companyId || null;
        targetCompanyCode = actorUser.companyCode || null;
      } else if (actorUser.role === Role.SUPER_ADMIN && companyFilter) {
        targetCompanyId = companyFilter;
      }
    }

    if (targetCompanyId) {
      await this.ensureDefaultLeaveTypes(targetCompanyId, targetCompanyCode);
    }

    let list = [...this.db.leaveTypes];

    if (actorUser) {
      if (actorUser.role === Role.ADMIN || actorUser.role === Role.EMPLOYEE) {
        list = list.filter((lt) => !lt.companyId || lt.companyId === actorUser.companyId);
      } else if (actorUser.role === Role.SUPER_ADMIN && companyFilter) {
        list = list.filter(
          (lt) =>
            !lt.companyId ||
            lt.companyId === companyFilter ||
            (lt.companyCode && lt.companyCode.toLowerCase() === companyFilter.toLowerCase()),
        );
      }
    }

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getLeaveTypeById(id: string, actorUser?: User): Promise<LeaveTypeItem> {
    let lt = this.db.leaveTypes.find((item) => item.id === id);

    if (!lt && (this.db as any).mysqlPool && (this.db as any).isMysqlConnected) {
      try {
        const pool = (this.db as any).mysqlPool;
        const [rows]: any = await pool.query('SELECT * FROM leave_types WHERE id = ? LIMIT 1', [id]);
        if (rows && rows.length > 0) {
          const loaded: LeaveTypeItem = {
            ...rows[0],
            daysAllowed: Number(rows[0].daysAllowed) || 0,
            isPaid: Boolean(rows[0].isPaid),
            requiresApproval: Boolean(rows[0].requiresApproval),
            carryForward: Boolean(rows[0].carryForward),
            maxCarryForwardDays: Number(rows[0].maxCarryForwardDays) || 0,
          };
          this.db.leaveTypes.push(loaded);
          lt = loaded;
        }
      } catch {}
    }

    if (!lt) {
      throw new NotFoundException(`Leave type with ID "${id}" not found.`);
    }

    if (actorUser && (actorUser.role === Role.ADMIN || actorUser.role === Role.EMPLOYEE)) {
      if (lt.companyId && actorUser.companyId && lt.companyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot access leave type belonging to another company.');
      }
    }

    return lt;
  }

  async createLeaveType(dto: CreateLeaveTypeDto, actorUser?: User): Promise<LeaveTypeItem> {
    if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees are not authorized to create leave types.');
    }

    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestException('Leave type name is required.');
    }

    let companyId: string | null = null;
    let companyCode: string | null = null;

    if (actorUser && actorUser.role === Role.ADMIN) {
      if (!actorUser.companyId) {
        throw new ForbiddenException('Admin user is not associated with any company.');
      }
      companyId = actorUser.companyId;
      companyCode = actorUser.companyCode || null;
    } else if (actorUser && actorUser.role === Role.SUPER_ADMIN) {
      if (dto.companyId) {
        const comp = this.db.companies.find((c) => c.id === dto.companyId || c.companyCode === dto.companyId);
        companyId = comp?.id || dto.companyId;
        companyCode = comp?.companyCode || null;
      }
    }

    const trimmedName = dto.name.trim();

    // Check for duplicate name in the company
    const duplicate = this.db.leaveTypes.find(
      (lt) =>
        lt.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
        ((!companyId && !lt.companyId) || (companyId && lt.companyId === companyId)),
    );

    if (duplicate) {
      throw new ConflictException(`Leave type with name "${trimmedName}" already exists for this company.`);
    }

    const now = new Date().toISOString();
    const newLt: LeaveTypeItem = {
      id: `lt-${Date.now()}`,
      companyId,
      companyCode,
      name: trimmedName,
      code: dto.code ? dto.code.trim().toUpperCase() : trimmedName.substring(0, 3).toUpperCase(),
      description: dto.description || '',
      daysAllowed: dto.daysAllowed !== undefined ? Number(dto.daysAllowed) : 12,
      isPaid: dto.isPaid !== undefined ? Boolean(dto.isPaid) : true,
      requiresApproval: dto.requiresApproval !== undefined ? Boolean(dto.requiresApproval) : true,
      carryForward: dto.carryForward !== undefined ? Boolean(dto.carryForward) : false,
      maxCarryForwardDays: dto.maxCarryForwardDays !== undefined ? Number(dto.maxCarryForwardDays) : 0,
      status: dto.status || 'Active',
      color: dto.color || '#3b82f6',
      createdAt: now,
      updatedAt: now,
    };

    this.db.leaveTypes.push(newLt);
    await this.db.saveLeaveTypeToMysql(newLt);
    this.db.persist();

    const actorName = actorUser ? `${actorUser.firstName || ''} ${actorUser.lastName || ''}`.trim() || actorUser.email : 'Admin';
    this.db.logAudit(
      actorUser?.id || 'sys',
      actorName,
      actorUser?.role || 'ADMIN',
      'CREATE_LEAVE_TYPE',
      'Leave Management',
      `Created new leave type "${newLt.name}" (${newLt.code}) with quota ${newLt.daysAllowed} days`,
      newLt.id,
      undefined,
      companyId || undefined,
      companyCode || undefined,
    );

    return newLt;
  }

  async updateLeaveType(id: string, dto: UpdateLeaveTypeDto, actorUser?: User): Promise<LeaveTypeItem> {
    if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees are not authorized to update leave types.');
    }

    const lt = await this.getLeaveTypeById(id, actorUser);

    if (actorUser && actorUser.role === Role.ADMIN) {
      if (lt.companyId && actorUser.companyId && lt.companyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot modify leave type belonging to another company.');
      }
    }

    if (dto.name && dto.name.trim().toLowerCase() !== lt.name.toLowerCase()) {
      const duplicate = this.db.leaveTypes.find(
        (other) =>
          other.id !== lt.id &&
          other.name.trim().toLowerCase() === dto.name!.trim().toLowerCase() &&
          ((!lt.companyId && !other.companyId) || (lt.companyId && other.companyId === lt.companyId)),
      );
      if (duplicate) {
        throw new ConflictException(`Leave type "${dto.name}" already exists for this company.`);
      }
    }

    const updated: LeaveTypeItem = {
      ...lt,
      name: dto.name !== undefined ? dto.name.trim() : lt.name,
      code: dto.code !== undefined ? dto.code.trim().toUpperCase() : lt.code,
      description: dto.description !== undefined ? dto.description : lt.description,
      daysAllowed: dto.daysAllowed !== undefined ? Number(dto.daysAllowed) : lt.daysAllowed,
      isPaid: dto.isPaid !== undefined ? Boolean(dto.isPaid) : lt.isPaid,
      requiresApproval: dto.requiresApproval !== undefined ? Boolean(dto.requiresApproval) : lt.requiresApproval,
      carryForward: dto.carryForward !== undefined ? Boolean(dto.carryForward) : lt.carryForward,
      maxCarryForwardDays: dto.maxCarryForwardDays !== undefined ? Number(dto.maxCarryForwardDays) : lt.maxCarryForwardDays,
      status: dto.status !== undefined ? dto.status : lt.status,
      color: dto.color !== undefined ? dto.color : lt.color,
      updatedAt: new Date().toISOString(),
    };

    const idx = this.db.leaveTypes.findIndex((item) => item.id === id);
    if (idx !== -1) {
      this.db.leaveTypes[idx] = updated;
    } else {
      this.db.leaveTypes.push(updated);
    }

    await this.db.saveLeaveTypeToMysql(updated);
    this.db.persist();

    const actorName = actorUser ? `${actorUser.firstName || ''} ${actorUser.lastName || ''}`.trim() || actorUser.email : 'Admin';
    this.db.logAudit(
      actorUser?.id || 'sys',
      actorName,
      actorUser?.role || 'ADMIN',
      'UPDATE_LEAVE_TYPE',
      'Leave Management',
      `Updated leave type "${updated.name}" (${updated.id})`,
      updated.id,
      undefined,
      updated.companyId || undefined,
      updated.companyCode || undefined,
    );

    return updated;
  }

  async deleteLeaveType(id: string, actorUser?: User): Promise<{ success: boolean; message: string; deleted: LeaveTypeItem }> {
    if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees are not authorized to delete leave types.');
    }

    const lt = await this.getLeaveTypeById(id, actorUser);

    if (actorUser && actorUser.role === Role.ADMIN) {
      if (lt.companyId && actorUser.companyId && lt.companyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot delete leave type belonging to another company.');
      }
    }

    const idx = this.db.leaveTypes.findIndex((item) => item.id === id);
    if (idx !== -1) {
      this.db.leaveTypes.splice(idx, 1);
    }

    await this.db.deleteLeaveTypeFromMysql(id);
    this.db.persist();

    const actorName = actorUser ? `${actorUser.firstName || ''} ${actorUser.lastName || ''}`.trim() || actorUser.email : 'Admin';
    this.db.logAudit(
      actorUser?.id || 'sys',
      actorName,
      actorUser?.role || 'ADMIN',
      'DELETE_LEAVE_TYPE',
      'Leave Management',
      `Deleted leave type "${lt.name}" (${lt.id})`,
      lt.id,
      undefined,
      lt.companyId || undefined,
      lt.companyCode || undefined,
    );

    return {
      success: true,
      message: `Leave type "${lt.name}" deleted successfully.`,
      deleted: lt,
    };
  }
}
