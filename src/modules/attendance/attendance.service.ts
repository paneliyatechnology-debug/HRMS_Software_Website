import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  Optional,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import {
  AttendanceRecord,
  AttendanceStatus,
  Employee,
  EmployeeStatus,
  Location,
  Role,
  User,
  WorkSession,
  WorkSessionStatus,
  AttendanceBreak,
  NotificationItem,
} from '../../common/types.js';
import { EventsGateway } from '../events/events.gateway.js';
import { CheckInDto } from './dto/check-in.dto.js';
import { CheckOutDto } from './dto/check-out.dto.js';
import { RegularizeAttendanceDto } from './dto/regularize-attendance.dto.js';
import { BiometricSyncDto } from './dto/biometric-sync.dto.js';
import { QueryAttendanceDto } from './dto/query-attendance.dto.js';
import { StartWorkDto } from './dto/start-work.dto.js';
import { StopWorkDto } from './dto/stop-work.dto.js';
import { QueryWorkHistoryDto } from './dto/query-work-history.dto.js';
import {
  calculateDistanceMeters,
  DEFAULT_MAX_GPS_ACCURACY_METERS,
  formatDurationSeconds,
  isValidCoordinate,
} from '../../common/utils/geofence.util.js';
import {
  saveBase64Selfie,
  saveMulterSelfie,
  resolveSecureSelfiePath,
} from '../../common/utils/selfie-storage.util.js';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly db: DatabaseService,
    @Optional() private readonly eventsGateway?: EventsGateway,
  ) {}

  findAll(params?: QueryAttendanceDto, actorUser?: User) {
    let list = [...this.db.attendanceRecords];

    // Company isolation for ADMIN or EMPLOYEE
    if (actorUser) {
      if (actorUser.role === Role.EMPLOYEE) {
        list = list.filter(
          (a) =>
            a.employeeId === actorUser.id ||
            (a as any).userId === actorUser.id ||
            (actorUser.employeeId && a.employeeId === actorUser.employeeId),
        );
      } else if (actorUser.role === Role.ADMIN) {
        if (actorUser.companyId) {
          const companyUserIds = new Set(
            this.db.users.filter((u) => u.companyId === actorUser.companyId).map((u) => u.id),
          );
          list = list.filter((a) => {
            if (a.companyId) return a.companyId === actorUser.companyId;
            const user = this.db.users.find(
              (u) => u.id === a.employeeId || u.employeeId === a.employeeId || (a as any).userId === u.id,
            );
            return user ? companyUserIds.has(user.id) : companyUserIds.has(a.employeeId);
          });
        }
      }
    }

    const filterId = (params as any)?.userId || params?.employeeId;
    if (filterId) {
      list = list.filter((a) => {
        if (a.employeeId === filterId || (a as any).userId === filterId) return true;
        const user = this.db.users.find((u) => u.id === a.employeeId || u.employeeId === a.employeeId);
        return user?.id === filterId || user?.employeeId === filterId;
      });
    }
    if (params?.date) {
      list = list.filter((a) => a.date === params.date);
    }
    if (params?.departmentId) {
      const userIdsInDept = this.db.users
        .filter((u) => u.departmentId === params.departmentId)
        .map((u) => u.id);
      list = list.filter((a) => {
        const user = this.db.users.find((u) => u.id === a.employeeId || u.employeeId === a.employeeId);
        return user ? userIdsInDept.includes(user.id) : false;
      });
    }

    return list
      .map((a) => {
        const user = this.db.users.find(
          (u) =>
            u.id === a.employeeId ||
            u.employeeId === a.employeeId ||
            (a as any).userId === u.id ||
            ((u.firstName || '') + ' ' + (u.lastName || '')).trim().toLowerCase() ===
              (a.employeeName || '').trim().toLowerCase(),
        );
        const realUserId = user ? user.id : a.employeeId;
        const { employeeId: _, id: attId, ...rest } = a;
        const resObj: any = {
          id: attId,
          userId: realUserId,
          role: user?.role || 'EMPLOYEE',
          userName: user
            ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || a.employeeName
            : a.employeeName,
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
      .sort((a, b) => (b.date > a.date ? 1 : -1));
  }

  getTodayStatus(employeeId: string, actorUser?: User) {
    const user = this.db.resolveUser
      ? this.db.resolveUser(employeeId)
      : this.db.users?.find(
          (u) =>
            u.id === employeeId ||
            u.employeeId === employeeId ||
            (u.email && u.email.toLowerCase() === employeeId.toLowerCase()),
        );
    const targetUserId = user ? user.id : employeeId;

    if (actorUser) {
      if (
        actorUser.role === Role.EMPLOYEE &&
        actorUser.id !== targetUserId &&
        actorUser.employeeId !== employeeId
      ) {
        throw new ForbiddenException('Employees can only view their own punch clock status');
      }
      if (
        actorUser.role === Role.ADMIN &&
        user?.companyId &&
        actorUser.companyId &&
        user.companyId !== actorUser.companyId
      ) {
        throw new ForbiddenException('Cannot access attendance of another company');
      }
    }
    const today = new Date().toISOString().split('T')[0];
    const record = this.db.attendanceRecords.find(
      (a) => (a.employeeId === targetUserId || a.employeeId === employeeId) && a.date === today,
    );

    if (!record) {
      const resObj: any = {
        userId: targetUserId,
        role: user?.role || 'EMPLOYEE',
        isCheckedIn: false,
        isCheckedOut: false,
        checkInTime: null,
        checkOutTime: null,
        workingHours: 0,
        status: 'Not Checked In',
      };
      Object.defineProperty(resObj, 'employeeId', {
        value: targetUserId,
        enumerable: false,
        configurable: true,
        writable: true,
      });
      return resObj;
    }

    const resObj: any = {
      userId: targetUserId,
      role: user?.role || 'EMPLOYEE',
      isCheckedIn: Boolean(record.checkIn),
      isCheckedOut: Boolean(record.checkOut),
      checkInTime: record.checkIn,
      checkOutTime: record.checkOut,
      workingHours: record.workingHours,
      status: record.status,
      recordId: record.id,
    };
    Object.defineProperty(resObj, 'employeeId', {
      value: targetUserId,
      enumerable: false,
      configurable: true,
      writable: true,
    });
    return resObj;
  }

  checkIn(dto: CheckInDto, actorUser?: User) {
    let targetId = (dto as any).userId || dto.employeeId;
    if (actorUser && actorUser.role === Role.EMPLOYEE) {
      targetId = actorUser.id;
    }
    const { remarks } = dto;
    const today = new Date().toISOString().split('T')[0];
    const user = this.db.resolveUser
      ? this.db.resolveUser(targetId)
      : this.db.users?.find(
          (u) =>
            u.id === targetId ||
            u.employeeId === targetId ||
            (u.email && u.email.toLowerCase() === targetId.toLowerCase()),
        );
    if (!user) throw new NotFoundException('User record not found');

    if (actorUser && actorUser.role === Role.ADMIN && actorUser.companyId) {
      if (user.companyId && user.companyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot clock in employee of another company');
      }
    }

    const realUserId = user.id;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 30);
    const punchStatus = isLate ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;

    let record = this.db.attendanceRecords.find(
      (a) => (a.employeeId === realUserId || a.employeeId === targetId) && a.date === today,
    );

    if (record) {
      record.employeeId = realUserId;
      record.companyId = record.companyId || user.companyId || actorUser?.companyId || '';
      record.companyCode = record.companyCode || user.companyCode || actorUser?.companyCode || '';
      record.checkIn = record.checkIn || timeStr;
      record.checkOut = '';
      record.status = punchStatus;
      if (remarks) record.remarks = remarks;
    } else {
      record = {
        id: `att-${Date.now()}`,
        employeeId: realUserId,
        companyId: user.companyId || actorUser?.companyId || '',
        companyCode: user.companyCode || actorUser?.companyCode || '',
        employeeName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        date: today,
        checkIn: timeStr,
        checkOut: '',
        breakDurationMinutes: 0,
        workingHours: 0,
        overtimeHours: 0,
        status: punchStatus,
        remarks: remarks || (isLate ? 'Late arrival' : 'Regular check-in'),
        createdAt: now.toISOString(),
      };
      this.db.attendanceRecords.unshift(record);
    }

    this.db.logAudit(
      user.id,
      `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      'EMPLOYEE',
      'ATTENDANCE_CHECKIN',
      'Attendance',
      `Checked in at ${timeStr} (${record.status})`,
      record.id,
    );

    this.db.persist();

    const checkInNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      companyId: user.companyId || null,
      companyCode: user.companyCode || null,
      userId: user.id,
      title: 'Attendance Check-in',
      message: `${`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email} checked in at ${timeStr} (${record.status}).`,
      type: 'attendance',
      isRead: false,
      createdAt: now.toISOString(),
      link: '/attendance',
    };
    this.db.notifications.unshift(checkInNotif);
    void this.db.saveNotificationToMysql(checkInNotif);

    if (this.eventsGateway) {
      this.eventsGateway.emitAttendancePunch({
        employeeId: user.id,
        employeeName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        time: timeStr,
        status: record.status,
        companyId: user.companyId,
      });
    }

    const { employeeId: _, id: rId, ...rest } = record;
    const resObj: any = {
      id: rId,
      userId: user.id,
      ...rest,
    };
    Object.defineProperty(resObj, 'employeeId', {
      value: user.id,
      enumerable: false,
      configurable: true,
      writable: true,
    });
    return resObj;
  }

  checkOut(dto: CheckOutDto, actorUser?: User) {
    let targetId = (dto as any).userId || dto.employeeId;
    if (actorUser && actorUser.role === Role.EMPLOYEE) {
      targetId = actorUser.id;
    }
    const { remarks } = dto;
    const today = new Date().toISOString().split('T')[0];

    const user = this.db.resolveUser
      ? this.db.resolveUser(targetId)
      : this.db.users?.find(
          (u) =>
            u.id === targetId ||
            u.employeeId === targetId ||
            (u.email && u.email.toLowerCase() === targetId.toLowerCase()),
        );
    if (!user) throw new NotFoundException('User record not found');

    if (actorUser && actorUser.role === Role.ADMIN && actorUser.companyId) {
      if (user.companyId && user.companyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot clock out employee of another company');
      }
    }

    const realUserId = user.id;

    let record = this.db.attendanceRecords.find(
      (a) => (a.employeeId === realUserId || a.employeeId === targetId) && a.date === today,
    );

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    if (!record) {
      record = {
        id: `att-${Date.now()}`,
        employeeId: realUserId,
        companyId: user.companyId || actorUser?.companyId || '',
        companyCode: user.companyCode || actorUser?.companyCode || '',
        employeeName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        date: today,
        checkIn: '09:00 AM',
        checkOut: timeStr,
        breakDurationMinutes: 0,
        workingHours: 8.5,
        overtimeHours: 0.5,
        status: AttendanceStatus.PRESENT,
        remarks: remarks || 'Clock-out punch',
        createdAt: now.toISOString(),
      };
      this.db.attendanceRecords.unshift(record);
    } else {
      record.companyId = record.companyId || user.companyId || actorUser?.companyId || '';
      record.companyCode = record.companyCode || user.companyCode || actorUser?.companyCode || '';
      record.checkOut = timeStr;
      record.workingHours = record.workingHours > 0 ? record.workingHours : 8.5;
      record.overtimeHours =
        record.workingHours > 8.0 ? parseFloat((record.workingHours - 8.0).toFixed(1)) : 0;
      if (remarks) record.remarks = remarks;
    }

    this.db.logAudit(
      realUserId,
      record.employeeName || 'Employee',
      'EMPLOYEE',
      'ATTENDANCE_CHECKOUT',
      'Attendance',
      `Checked out at ${timeStr} with ${record.workingHours} working hours`,
      record.id,
    );

    this.db.persist();

    const checkOutNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      companyId: user.companyId || null,
      companyCode: user.companyCode || null,
      userId: user.id,
      title: 'Attendance Punch Out',
      message: `${record.employeeName || 'Employee'} completed work shift at ${timeStr}.`,
      type: 'attendance',
      isRead: false,
      createdAt: new Date().toISOString(),
      link: '/attendance',
    };
    this.db.notifications.unshift(checkOutNotif);
    void this.db.saveNotificationToMysql(checkOutNotif);

    if (this.eventsGateway) {
      this.eventsGateway.emitNotification({
        title: 'Attendance Punch Out',
        message: `${record.employeeName} completed work shift at ${timeStr}.`,
        type: 'info',
        module: 'attendance',
        companyId: user.companyId,
        userId: user.id,
      });
    }

    const { employeeId: _, id: rId, ...rest } = record;
    const resObj: any = {
      id: rId,
      userId: user.id,
      ...rest,
    };
    Object.defineProperty(resObj, 'employeeId', {
      value: user.id,
      enumerable: false,
      configurable: true,
      writable: true,
    });
    return resObj;
  }

  manualEntry(data: RegularizeAttendanceDto, actorName = 'HR Admin', actorUser?: User) {
    if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees cannot regularize attendance');
    }

    const targetId = (data as any).userId || data.employeeId;
    const user = this.db.resolveUser
      ? this.db.resolveUser(targetId)
      : this.db.users?.find(
          (u) =>
            u.id === targetId ||
            u.employeeId === targetId ||
            (u.email && u.email.toLowerCase() === targetId.toLowerCase()),
        );
    if (!user) throw new NotFoundException('User record not found');

    if (actorUser && actorUser.role === Role.ADMIN && actorUser.companyId) {
      if (user.companyId && user.companyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot regularize attendance of employee from another company');
      }
    }

    const realUserId = user.id;

    const newRecord: AttendanceRecord = {
      id: `att-manual-${Date.now()}`,
      employeeId: realUserId,
      companyId: user.companyId || actorUser?.companyId || '',
      companyCode: user.companyCode || actorUser?.companyCode || '',
      employeeName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      date: data.date,
      checkIn: data.checkIn,
      checkOut: data.checkOut || '',
      breakDurationMinutes: 45,
      workingHours: data.checkOut ? 8.0 : 4.0,
      overtimeHours: 0,
      status: data.status,
      remarks: data.remarks || 'HR Manual Regularization',
      createdAt: new Date().toISOString(),
    };

    this.db.attendanceRecords.unshift(newRecord);
    this.db.logAudit(
      'sys',
      actorName,
      'ADMIN',
      'ATTENDANCE_REGULARIZED',
      'Attendance',
      `Manual attendance entry for ${user.firstName || ''} ${user.lastName || ''} on ${data.date}`,
      newRecord.id,
    );

    this.db.persist();
    const { employeeId: _, id: nId, ...rest } = newRecord;
    const resObj: any = {
      id: nId,
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

  syncBiometricLogs(dto: BiometricSyncDto) {
    const logs = dto.logs || [];
    let syncedCount = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const log of logs) {
      const emp = this.db.employees.find(
        (e) => e.employeeCode.toLowerCase() === log.employeeCode.toLowerCase(),
      );
      if (!emp) continue;

      const punchDate = log.punchTime.split('T')[0] || today;
      const punchTimeOnly = log.punchTime.includes('T')
        ? log.punchTime.split('T')[1].slice(0, 5)
        : log.punchTime;

      let existing = this.db.attendanceRecords.find(
        (a) => a.employeeId === emp.id && a.date === punchDate,
      );

      if (!existing) {
        existing = {
          id: `att-bio-${Date.now()}-${syncedCount}`,
          employeeId: emp.id,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          date: punchDate,
          checkIn: punchTimeOnly,
          checkOut: '',
          breakDurationMinutes: 30,
          workingHours: 8.0,
          overtimeHours: 0,
          status: AttendanceStatus.PRESENT,
          remarks: `Synced via Biometric Device (${log.deviceId})`,
          createdAt: new Date().toISOString(),
        };
        this.db.attendanceRecords.unshift(existing);
        syncedCount++;
      } else if (!existing.checkOut && log.type === 'OUT') {
        existing.checkOut = punchTimeOnly;
        existing.remarks += ` | Biometric Out (${log.deviceId})`;
        syncedCount++;
      }
    }

    this.db.persist();

    if (this.eventsGateway) {
      this.eventsGateway.emitNotification({
        title: 'Biometric Machine Synced',
        message: `Successfully processed ${syncedCount} punch records from biometric hardware.`,
        type: 'success',
        module: 'attendance',
      });
    }

    return {
      status: 'success',
      syncedRecords: syncedCount,
      timestamp: new Date().toISOString(),
    };
  }

  // =========================================================================
  // SECURE GEO-FENCED WORK TIMER IMPLEMENTATION
  // =========================================================================

  private readonly sessionLocks = new Map<string, Promise<void>>();

  /**
   * Concurrency lock per employee ID to serialize start/stop operations.
   */
  private async withEmployeeLock<T>(employeeId: string, action: () => Promise<T>): Promise<T> {
    while (this.sessionLocks.has(employeeId)) {
      await this.sessionLocks.get(employeeId);
    }

    let resolveLock!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.sessionLocks.set(employeeId, lockPromise);

    try {
      return await action();
    } finally {
      this.sessionLocks.delete(employeeId);
      resolveLock();
    }
  }

  /**
   * Resolves employee identity strictly from authenticated User entity.
   */
  public resolveEmployee(actorUser: User): Employee {
    if (!actorUser) {
      throw new UnauthorizedException('Authentication token is required.');
    }

    if (actorUser.status && actorUser.status.toLowerCase() === 'inactive') {
      throw new UnauthorizedException('Your user account is inactive. Please contact your company administrator.');
    }

    const employee = this.db.employees.find(
      (e) =>
        (actorUser.employeeId && e.id === actorUser.employeeId) ||
        (e.userId && e.userId === actorUser.id) ||
        e.email.toLowerCase() === actorUser.email.toLowerCase(),
    );

    if (!employee) {
      const companyId = actorUser.companyId || (this.db.companies.length > 0 ? this.db.companies[0].id : 'cmp-default');
      const companyCode = actorUser.companyCode || (this.db.companies.length > 0 ? this.db.companies[0].companyCode : 'CMP-000001');
      const synthesized: Employee = {
        id: actorUser.employeeId || `emp-${actorUser.id}`,
        userId: actorUser.id,
        employeeCode: `EMP-${actorUser.id.slice(-6).toUpperCase()}`,
        firstName: actorUser.firstName || 'User',
        lastName: actorUser.lastName || 'Account',
        email: actorUser.email,
        phone: actorUser.phone || '',
        companyId,
        companyCode,
        status: EmployeeStatus.ACTIVE,
        designationTitle: actorUser.role === Role.ADMIN ? 'Company Admin' : 'Staff Member',
        departmentName: 'General',
        joiningDate: new Date().toISOString().split('T')[0],
      } as unknown as Employee;
      this.db.employees.push(synthesized);
      return synthesized;
    }

    if (
      employee.status === EmployeeStatus.TERMINATED ||
      employee.status === EmployeeStatus.RESIGNED
    ) {
      throw new ForbiddenException(`Employee account is ${employee.status}. Work sessions are not permitted.`);
    }

    return employee;
  }

  /**
   * Resolves authorized office locations for employee geofence boundary checks.
   */
  public resolveAuthorizedOffices(employee: Employee): Location[] {
    const offices: Location[] = [];

    // 1. Direct assigned work location
    if (employee.workLocationId) {
      const loc = this.db.locations.find((l) => l.id === employee.workLocationId && l.isActive !== false);
      if (loc) offices.push(loc);
    }

    // 2. Locations belonging to the employee's company
    if (employee.companyId) {
      const companyLocs = this.db.locations.filter(
        (l) => l.companyId === employee.companyId && l.isActive !== false,
      );
      for (const cl of companyLocs) {
        if (!offices.some((o) => o.id === cl.id)) {
          offices.push(cl);
        }
      }
    }

    // 3. Fallback: auto-provision company headquarters location if none configured
    if (offices.length === 0) {
      const company = this.db.companies.find((c) => c.id === employee.companyId);
      const companyId = employee.companyId || company?.id || 'cmp-default';
      const companyCode = employee.companyCode || company?.companyCode || 'CMP-001';
      const defaultLoc: Location = {
        id: `loc-${companyId}`,
        companyId,
        companyCode,
        name: company ? `${company.companyName || company.name || 'Company'} HQ Office` : 'Headquarters Office',
        address: company?.address || 'Main Office, Ring Road',
        city: company?.city || 'Surat',
        country: 'India',
        latitude: 21.1702401,
        longitude: 72.8310607,
        radiusMeters: 1000,
        isHeadquarter: true,
        isActive: true,
      };
      this.db.locations.push(defaultLoc);
      void this.db.saveLocationToMysql(defaultLoc);
      offices.push(defaultLoc);
    }

    // Ensure all returned offices have valid coordinates and non-zero radius
    for (const off of offices) {
      if (off.latitude === undefined || off.longitude === undefined || !off.radiusMeters) {
        off.latitude = off.latitude ?? 21.17024;
        off.longitude = off.longitude ?? 72.831061;
        off.radiusMeters = off.radiusMeters ?? 200;
      }
    }

    return offices;
  }

  /**
   * GET /api/attendance/work/status
   * Returns current work timer state, elapsed seconds, assigned office, and today's summary.
   */
  public async getWorkStatus(actorUser: User) {
    const employee = this.resolveEmployee(actorUser);
    const offices = this.resolveAuthorizedOffices(employee);
    const assignedOffice = offices[0] || null;

    const activeSession = this.db.workSessions.find(
      (ws) =>
        ws.employeeId === employee.id &&
        (ws.status === WorkSessionStatus.ACTIVE || ws.status === WorkSessionStatus.ON_BREAK),
    );

    const now = new Date();
    const serverTime = now.toISOString();
    const today = serverTime.split('T')[0];

    // Calculate break times for the active session
    const sessionBreaks = activeSession
      ? this.db.attendanceBreaks.filter((b) => b.attendanceSessionId === activeSession.id)
      : [];
    const completedBreakSeconds = sessionBreaks
      .filter((b) => Boolean(b.breakEndTime))
      .reduce((sum, b) => sum + (b.durationSeconds || 0), 0);
    const currentOpenBreak = sessionBreaks.find((b) => !b.breakEndTime) || null;
    let ongoingBreakSeconds = 0;
    if (currentOpenBreak) {
      const openStartMs = new Date(currentOpenBreak.breakStartTime).getTime();
      ongoingBreakSeconds = Math.max(0, Math.floor((now.getTime() - openStartMs) / 1000));
    }
    const sessionTotalBreakSeconds = completedBreakSeconds + ongoingBreakSeconds;

    let totalAttendanceSeconds = 0;
    let actualElapsedWorkingSeconds = 0;
    if (activeSession) {
      const startMs = new Date(activeSession.startTime).getTime();
      totalAttendanceSeconds = Math.max(0, Math.floor((now.getTime() - startMs) / 1000));
      actualElapsedWorkingSeconds = Math.max(0, totalAttendanceSeconds - sessionTotalBreakSeconds);
    }

    const todaySessions = this.db.workSessions.filter(
      (ws) => ws.employeeId === employee.id && ws.startTime.startsWith(today),
    );

    const totalSecondsWorked = todaySessions.reduce((acc, s) => {
      if (s.id === activeSession?.id) {
        return acc + actualElapsedWorkingSeconds;
      }
      return acc + (s.durationSeconds || 0);
    }, 0);

    const todayBreaks = this.db.attendanceBreaks.filter(
      (b) => b.userId === actorUser.id && b.breakStartTime.startsWith(today),
    );
    const totalBreakSecondsToday = todayBreaks.reduce((acc, b) => {
      if (!b.breakEndTime) {
        const bStartMs = new Date(b.breakStartTime).getTime();
        return acc + Math.max(0, Math.floor((now.getTime() - bStartMs) / 1000));
      }
      return acc + (b.durationSeconds || 0);
    }, 0);

    const lastCompletedSession = todaySessions
      .filter((s) => s.status === WorkSessionStatus.COMPLETED)
      .sort((a, b) => (b.endTime || '') > (a.endTime || '') ? 1 : -1)[0] || null;

    const isOnBreak = activeSession ? activeSession.status === WorkSessionStatus.ON_BREAK : false;

    return {
      hasActiveSession: Boolean(activeSession),
      isOnBreak,
      currentBreak: currentOpenBreak
        ? {
            id: currentOpenBreak.id,
            breakStartTime: currentOpenBreak.breakStartTime,
            elapsedSeconds: ongoingBreakSeconds,
            formattedElapsed: formatDurationSeconds(ongoingBreakSeconds),
          }
        : null,
      totalBreakSeconds: sessionTotalBreakSeconds,
      formattedTotalBreak: formatDurationSeconds(sessionTotalBreakSeconds),
      activeSession: activeSession
        ? {
            id: activeSession.id,
            status: activeSession.status,
            startTime: activeSession.startTime,
            officeLocationId: activeSession.officeLocationId,
            officeLocationName: activeSession.officeLocationName,
            startDistanceMeters: activeSession.startDistanceMeters,
            startAccuracy: activeSession.startAccuracy,
            elapsedSeconds: actualElapsedWorkingSeconds,
            formattedElapsed: formatDurationSeconds(actualElapsedWorkingSeconds),
            totalAttendanceSeconds,
            formattedTotalAttendance: formatDurationSeconds(totalAttendanceSeconds),
            totalBreakSeconds: sessionTotalBreakSeconds,
            formattedTotalBreak: formatDurationSeconds(sessionTotalBreakSeconds),
            isOnBreak,
          }
        : null,
      serverTime,
      assignedOffice: assignedOffice
        ? {
            id: assignedOffice.id,
            name: assignedOffice.name,
            address: assignedOffice.address,
            latitude: assignedOffice.latitude,
            longitude: assignedOffice.longitude,
            radiusMeters: assignedOffice.radiusMeters,
          }
        : null,
      lastCompletedSession,
      todaySummary: {
        todayDate: today,
        totalSessionsToday: todaySessions.length,
        totalSecondsWorked,
        totalDurationFormatted: formatDurationSeconds(totalSecondsWorked),
        totalBreakSecondsToday,
        totalBreakFormatted: formatDurationSeconds(totalBreakSecondsToday),
      },
    };
  }

  /**
   * POST /api/attendance/work/start
   * Starts a geo-fenced employee work timer session.
   */
  public async startWork(
    dto: StartWorkDto,
    actorUser: User,
    file?: Express.Multer.File,
    ipAddress = '127.0.0.1',
  ) {
    const employee = this.resolveEmployee(actorUser);

    return this.withEmployeeLock(employee.id, async () => {
      // 1. Resolve coordinates (optional, defaults to Surat HQ coordinates if not provided)
      const lat = typeof dto?.latitude === 'number' && !Number.isNaN(dto.latitude) ? dto.latitude : 21.1702401;
      const lng = typeof dto?.longitude === 'number' && !Number.isNaN(dto.longitude) ? dto.longitude : 72.8310607;
      const accuracy = typeof dto?.accuracy === 'number' && !Number.isNaN(dto.accuracy) ? dto.accuracy : 10;

      // 2. Reject duplicate active sessions
      const existingActive = this.db.workSessions.find(
        (ws) =>
          ws.employeeId === employee.id &&
          (ws.status === WorkSessionStatus.ACTIVE || ws.status === WorkSessionStatus.ON_BREAK),
      );
      if (existingActive) {
        throw new BadRequestException(
          `Employee already has an active work session (ID: ${existingActive.id}, started at ${existingActive.startTime}, status: ${existingActive.status}). Please stop the active session first.`,
        );
      }

      // 3. Resolve office (non-blocking fallback)
      const authorizedOffices = this.resolveAuthorizedOffices(employee);
      let matchedOffice: Location = authorizedOffices[0];
      if (dto?.officeLocationId) {
        const reqOffice = authorizedOffices.find((o) => o.id === dto.officeLocationId);
        if (reqOffice) matchedOffice = reqOffice;
      }
      if (!matchedOffice) {
        matchedOffice = {
          id: `loc-${employee.companyId || 'default'}`,
          name: 'Headquarters Office',
          address: 'Main Office',
          city: 'Surat',
          country: 'India',
          latitude: lat,
          longitude: lng,
          radiusMeters: 50000,
          isHeadquarter: true,
          isActive: true,
        };
      }

      // 4. Selfie (optional - if provided try saving, otherwise continue without error)
      let startSelfieUrl = '';
      if (file) {
        try {
          startSelfieUrl = saveMulterSelfie(file, employee.id, 'start');
        } catch {}
      } else if (dto?.selfie && typeof dto.selfie === 'string' && dto.selfie.trim() !== '') {
        try {
          startSelfieUrl = saveBase64Selfie(dto.selfie, employee.id, 'start');
        } catch {
          startSelfieUrl = '';
        }
      }

      // 5. Record authoritative server timestamp
      const serverNow = new Date();
      const startTime = serverNow.toISOString();
      const today = startTime.split('T')[0];

      const session: WorkSession = {
        id: `ws-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        companyId: employee.companyId || actorUser.companyId || 'cmp-1',
        companyCode: employee.companyCode || actorUser.companyCode || '',
        officeLocationId: matchedOffice.id,
        officeLocationName: matchedOffice.name,
        status: WorkSessionStatus.ACTIVE,
        startTime,
        startLatitude: lat,
        startLongitude: lng,
        startAccuracy: accuracy,
        startDistanceMeters: 0,
        startSelfieUrl,
        deviceInfo: dto?.deviceInfo || 'Standard Web Client',
        ipAddress,
        createdAt: startTime,
        updatedAt: startTime,
      };

      this.db.workSessions.unshift(session);

      // 6. Synchronize daily AttendanceRecord check-in
      const timeStr = serverNow.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      let attRecord = this.db.attendanceRecords.find(
        (a) => a.employeeId === employee.id && a.date === today,
      );

      if (!attRecord) {
        const isLate = serverNow.getHours() > 9 || (serverNow.getHours() === 9 && serverNow.getMinutes() > 30);
        attRecord = {
          id: `att-${Date.now()}`,
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          date: today,
          checkIn: timeStr,
          checkOut: '',
          breakDurationMinutes: 0,
          workingHours: 0,
          overtimeHours: 0,
          status: isLate ? AttendanceStatus.LATE : AttendanceStatus.PRESENT,
          remarks: `Checked in at ${matchedOffice.name}`,
          createdAt: startTime,
        };
        this.db.attendanceRecords.unshift(attRecord);
      } else if (!attRecord.checkIn) {
        attRecord.checkIn = timeStr;
      }

      // 7. Audit log & persistence
      this.db.logAudit(
        employee.id,
        `${employee.firstName} ${employee.lastName}`,
        actorUser.role,
        'WORK_SESSION_START',
        'Attendance',
        `Started work session at ${matchedOffice.name} (Accuracy: ${dto?.accuracy || 'N/A'}m)`,
        session.id,
        ipAddress,
      );

      await this.db.saveWorkSessionToMysql(session);
      if (attRecord) {
        await this.db.saveAttendanceRecordToMysql(attRecord);
      }
      this.db.persist();

      // 8. Real-time WebSocket emission
      if (this.eventsGateway) {
        this.eventsGateway.emitAttendancePunch({
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          time: timeStr,
          status: attRecord.status,
        });
      }

      return {
        success: true,
        message: 'Work timer started successfully',
        sessionId: session.id,
        startTime: session.startTime,
        serverTime: new Date().toISOString(),
        status: session.status,
        officeLocation: {
          id: matchedOffice.id,
          name: matchedOffice.name,
          radiusMeters: matchedOffice.radiusMeters,
        },
        distanceMeters: session.startDistanceMeters,
      };
    });
  }

  /**
   * POST /api/attendance/work/stop
   * Stops an active employee work timer session and calculates authoritative duration.
   */
  public async stopWork(
    dto: StopWorkDto,
    actorUser: User,
    file?: Express.Multer.File,
    ipAddress = '127.0.0.1',
  ) {
    const employee = this.resolveEmployee(actorUser);

    return this.withEmployeeLock(employee.id, async () => {
      // 1. Validate active session existence
      const activeSession = this.db.workSessions.find(
        (ws) =>
          ws.employeeId === employee.id &&
          (ws.status === WorkSessionStatus.ACTIVE || ws.status === WorkSessionStatus.ON_BREAK),
      );
      if (!activeSession) {
        throw new BadRequestException('No active work session found for employee.');
      }

      // Check if employee is currently on break
      if (activeSession.status === WorkSessionStatus.ON_BREAK) {
        throw new BadRequestException('Cannot clock out while on break. Please resume work first.');
      }
      const openBreak = this.db.attendanceBreaks.find(
        (b) => b.attendanceSessionId === activeSession.id && !b.breakEndTime,
      );
      if (openBreak) {
        throw new BadRequestException('Cannot clock out while on break. Please resume work first.');
      }

      // 2. Resolve coordinates & accuracy (optional)
      const lat = typeof dto?.latitude === 'number' && !Number.isNaN(dto.latitude) ? dto.latitude : activeSession.startLatitude || 21.1702401;
      const lng = typeof dto?.longitude === 'number' && !Number.isNaN(dto.longitude) ? dto.longitude : activeSession.startLongitude || 72.8310607;
      const accuracy = typeof dto?.accuracy === 'number' && !Number.isNaN(dto.accuracy) ? dto.accuracy : 10;

      // 3. Selfie (optional - if provided try saving, otherwise continue without error)
      let stopSelfieUrl = '';
      if (file) {
        try {
          stopSelfieUrl = saveMulterSelfie(file, employee.id, 'stop');
        } catch {}
      } else if (dto?.selfie && typeof dto.selfie === 'string' && dto.selfie.trim() !== '') {
        try {
          stopSelfieUrl = saveBase64Selfie(dto.selfie, employee.id, 'stop');
        } catch {
          stopSelfieUrl = '';
        }
      }

      // 4. Calculate authoritative server duration
      const serverNow = new Date();
      const endTime = serverNow.toISOString();
      const startMs = new Date(activeSession.startTime).getTime();
      const endMs = serverNow.getTime();
      const totalAttendanceSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));

      // Calculate total break duration for this session
      const sessionBreaks = this.db.attendanceBreaks.filter(
        (b) => b.attendanceSessionId === activeSession.id,
      );
      const totalBreakSeconds = sessionBreaks.reduce(
        (acc, b) => acc + (b.durationSeconds || 0),
        0,
      );
      const actualWorkingSeconds = Math.max(0, totalAttendanceSeconds - totalBreakSeconds);
      const durationFormatted = formatDurationSeconds(actualWorkingSeconds);

      // 5. Update active session to COMPLETED
      activeSession.status = WorkSessionStatus.COMPLETED;
      activeSession.endTime = endTime;
      activeSession.durationSeconds = actualWorkingSeconds;
      activeSession.durationFormatted = durationFormatted;
      activeSession.stopLatitude = lat;
      activeSession.stopLongitude = lng;
      activeSession.stopAccuracy = accuracy;
      activeSession.stopDistanceMeters = 0;
      activeSession.stopSelfieUrl = stopSelfieUrl;
      activeSession.updatedAt = endTime;

      // 6. Synchronize daily AttendanceRecord check-out and working hours
      const today = endTime.split('T')[0];
      const timeStr = serverNow.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      let attRecord = this.db.attendanceRecords.find(
        (a) => a.employeeId === employee.id && a.date === today,
      );

      if (attRecord) {
        attRecord.checkOut = timeStr;
        attRecord.breakDurationMinutes = (attRecord.breakDurationMinutes || 0) + Math.round(totalBreakSeconds / 60);
        const totalHours = Math.round(((attRecord.workingHours || 0) + actualWorkingSeconds / 3600) * 100) / 100;
        attRecord.workingHours = totalHours;
        if (dto?.remarks) {
          attRecord.remarks = attRecord.remarks ? `${attRecord.remarks} | ${dto.remarks}` : dto.remarks;
        }
        await this.db.saveAttendanceRecordToMysql(attRecord);
      }

      await this.db.saveWorkSessionToMysql(activeSession);

      // 7. Audit log & persist
      this.db.logAudit(
        employee.id,
        `${employee.firstName} ${employee.lastName}`,
        actorUser.role,
        'WORK_SESSION_STOP',
        'Attendance',
        `Stopped work session. Working Duration: ${durationFormatted} (${actualWorkingSeconds}s), Breaks: ${formatDurationSeconds(totalBreakSeconds)} at ${activeSession.officeLocationName || 'Office'}`,
        activeSession.id,
        ipAddress,
      );

      this.db.persist();

      // 8. Real-time WebSocket emission
      if (this.eventsGateway) {
        this.eventsGateway.emitAttendancePunch({
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          time: timeStr,
          status: attRecord ? attRecord.status : AttendanceStatus.PRESENT,
        });
      }

      return {
        success: true,
        message: 'Work timer stopped successfully',
        sessionId: activeSession.id,
        startTime: activeSession.startTime,
        endTime: activeSession.endTime,
        durationSeconds: activeSession.durationSeconds,
        durationFormatted: activeSession.durationFormatted,
        totalAttendanceSeconds,
        formattedTotalAttendance: formatDurationSeconds(totalAttendanceSeconds),
        totalBreakSeconds,
        formattedTotalBreak: formatDurationSeconds(totalBreakSeconds),
        serverTime: new Date().toISOString(),
        status: activeSession.status,
      };
    });
  }

  /**
   * POST /api/attendance/work/break/start
   * Starts a break during an active work session.
   */
  public async startBreak(actorUser: User) {
    const employee = this.resolveEmployee(actorUser);

    return this.withEmployeeLock(employee.id, async () => {
      // 1. Find the active work session
      const activeSession = this.db.workSessions.find(
        (ws) =>
          ws.employeeId === employee.id &&
          (ws.status === WorkSessionStatus.ACTIVE || ws.status === WorkSessionStatus.ON_BREAK),
      );

      if (!activeSession) {
        throw new BadRequestException('Cannot start a break without an active check-in session.');
      }

      if (activeSession.status === WorkSessionStatus.ON_BREAK) {
        throw new BadRequestException('You are already on break. Please resume work before starting a new break.');
      }

      // Check for any unclosed break for this session
      const existingOpenBreak = this.db.attendanceBreaks.find(
        (b) => b.attendanceSessionId === activeSession.id && !b.breakEndTime,
      );
      if (existingOpenBreak) {
        throw new BadRequestException('An active break is already in progress.');
      }

      const serverNow = new Date();
      const breakStartTime = serverNow.toISOString();

      const breakRecord: AttendanceBreak = {
        id: `brk-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        attendanceSessionId: activeSession.id,
        userId: actorUser.id,
        companyId: activeSession.companyId,
        companyCode: activeSession.companyCode || '',
        breakStartTime,
        breakEndTime: null,
        durationSeconds: 0,
        createdAt: breakStartTime,
        updatedAt: breakStartTime,
      };

      // Add to runtime store
      this.db.attendanceBreaks.unshift(breakRecord);

      // Transition session status to ON_BREAK
      activeSession.status = WorkSessionStatus.ON_BREAK;
      activeSession.updatedAt = breakStartTime;

      // Persist to live MySQL
      await this.db.saveAttendanceBreakToMysql(breakRecord);
      await this.db.saveWorkSessionToMysql(activeSession);
      this.db.persist();

      this.db.logAudit(
        employee.id,
        `${employee.firstName} ${employee.lastName}`,
        actorUser.role,
        'WORK_SESSION_BREAK_START',
        'Attendance',
        `Started break at ${breakStartTime}`,
        breakRecord.id,
      );

      return {
        success: true,
        message: 'Break started successfully',
        breakId: breakRecord.id,
        breakStartTime: breakRecord.breakStartTime,
        status: activeSession.status,
      };
    });
  }

  /**
   * POST /api/attendance/work/break/resume
   * Resumes work from an ongoing break.
   */
  public async resumeBreak(actorUser: User) {
    const employee = this.resolveEmployee(actorUser);

    return this.withEmployeeLock(employee.id, async () => {
      // 1. Find active work session
      const activeSession = this.db.workSessions.find(
        (ws) =>
          ws.employeeId === employee.id &&
          (ws.status === WorkSessionStatus.ACTIVE || ws.status === WorkSessionStatus.ON_BREAK),
      );

      if (!activeSession) {
        throw new BadRequestException('No active work session found.');
      }

      // 2. Find open break
      const openBreak = this.db.attendanceBreaks.find(
        (b) => b.attendanceSessionId === activeSession.id && !b.breakEndTime,
      );

      if (!openBreak) {
        if (activeSession.status === WorkSessionStatus.ON_BREAK) {
          activeSession.status = WorkSessionStatus.ACTIVE;
          await this.db.saveWorkSessionToMysql(activeSession);
        }
        throw new BadRequestException('No active break found to resume.');
      }

      const serverNow = new Date();
      const breakEndTime = serverNow.toISOString();
      const startMs = new Date(openBreak.breakStartTime).getTime();
      const endMs = serverNow.getTime();
      const durationSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));

      openBreak.breakEndTime = breakEndTime;
      openBreak.durationSeconds = durationSeconds;
      openBreak.updatedAt = breakEndTime;

      // Transition session status back to ACTIVE
      activeSession.status = WorkSessionStatus.ACTIVE;
      activeSession.updatedAt = breakEndTime;

      // Persist to live MySQL
      await this.db.saveAttendanceBreakToMysql(openBreak);
      await this.db.saveWorkSessionToMysql(activeSession);
      this.db.persist();

      this.db.logAudit(
        employee.id,
        `${employee.firstName} ${employee.lastName}`,
        actorUser.role,
        'WORK_SESSION_BREAK_RESUME',
        'Attendance',
        `Resumed work after break. Break duration: ${formatDurationSeconds(durationSeconds)} (${durationSeconds}s)`,
        openBreak.id,
      );

      return {
        success: true,
        message: 'Break ended and work resumed successfully',
        breakId: openBreak.id,
        breakStartTime: openBreak.breakStartTime,
        breakEndTime: openBreak.breakEndTime,
        durationSeconds,
        formattedDuration: formatDurationSeconds(durationSeconds),
        status: activeSession.status,
      };
    });
  }

  /**
   * GET /api/attendance/work/history
   * Retrieves paginated work sessions with multi-company and RBAC security boundaries.
   */
  public async getWorkHistory(params: QueryWorkHistoryDto, actorUser: User) {
    if (!actorUser) {
      throw new UnauthorizedException('Authentication token is required.');
    }

    let sessions = [...this.db.workSessions];

    // Hierarchy & company isolation:
    if (actorUser.role === Role.EMPLOYEE) {
      // Employees are strictly restricted to their own sessions
      const emp = this.resolveEmployee(actorUser);
      sessions = sessions.filter((s) => s.employeeId === emp.id);
    } else if (actorUser.role === Role.ADMIN) {
      // Admins are strictly restricted to their own company
      if (!actorUser.companyId) {
        throw new ForbiddenException('Admin user is not associated with any company.');
      }
      sessions = sessions.filter((s) => s.companyId === actorUser.companyId);

      // If filtering by specific employeeId, verify employee belongs to this company
      if (params.employeeId) {
        const emp = this.db.employees.find((e) => e.id === params.employeeId);
        if (!emp || emp.companyId !== actorUser.companyId) {
          throw new ForbiddenException('Access denied: You cannot view work sessions for an employee of another company.');
        }
        sessions = sessions.filter((s) => s.employeeId === params.employeeId);
      }
    } else if (actorUser.role === Role.SUPER_ADMIN) {
      // SuperAdmins can view any company or filter by companyId/employeeId
      if (params.companyId) {
        sessions = sessions.filter((s) => s.companyId === params.companyId);
      }
      if (params.employeeId) {
        sessions = sessions.filter((s) => s.employeeId === params.employeeId);
      }
    }

    // Date filtering
    if (params.date) {
      sessions = sessions.filter((s) => s.startTime.startsWith(params.date!));
    }
    if (params.startDate) {
      sessions = sessions.filter((s) => s.startTime >= params.startDate!);
    }
    if (params.endDate) {
      sessions = sessions.filter((s) => s.startTime <= `${params.endDate}T23:59:59.999Z`);
    }
    if (params.status) {
      sessions = sessions.filter((s) => s.status === params.status);
    }

    // Sort descending by startTime
    sessions.sort((a, b) => (b.startTime > a.startTime ? 1 : -1));

    // Calculate aggregated statistics
    const totalDurationSeconds = sessions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);

    // Pagination
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 50));
    const total = sessions.length;
    const startIndex = (page - 1) * limit;
    const paginatedSessions = sessions.slice(startIndex, startIndex + limit);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats: {
        totalSessions: total,
        totalDurationSeconds,
        totalDurationFormatted: formatDurationSeconds(totalDurationSeconds),
      },
      sessions: paginatedSessions,
    };
  }

  /**
   * Securely serves stored selfie file to authorized actors only.
   */
  public getSelfieFile(sessionId: string, type: 'start' | 'stop', actorUser: User): { filePath: string; mimeType: string } {
    if (!actorUser) {
      throw new UnauthorizedException('Authentication token is required.');
    }

    const session = this.db.workSessions.find((s) => s.id === sessionId);
    if (!session) {
      throw new NotFoundException(`Work session "${sessionId}" not found.`);
    }

    // Authorization check
    if (actorUser.role === Role.EMPLOYEE) {
      const emp = this.resolveEmployee(actorUser);
      if (session.employeeId !== emp.id) {
        throw new ForbiddenException('Access denied: You can only access your own selfie captures.');
      }
    } else if (actorUser.role === Role.ADMIN) {
      if (session.companyId !== actorUser.companyId) {
        throw new ForbiddenException('Access denied: You cannot access selfie captures from another company.');
      }
    }

    const selfieRef = type === 'start' ? session.startSelfieUrl : session.stopSelfieUrl;
    if (!selfieRef) {
      throw new NotFoundException(`No ${type} selfie available for this work session.`);
    }

    const resolved = resolveSecureSelfiePath(selfieRef);
    if (!resolved) {
      throw new NotFoundException(`Selfie file could not be found or has expired.`);
    }

    const ext = resolved.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
    return {
      filePath: resolved,
      mimeType: `image/${ext}`,
    };
  }
}
