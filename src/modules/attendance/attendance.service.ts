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
    if (actorUser && (actorUser.role === Role.ADMIN || actorUser.role === Role.EMPLOYEE)) {
      if (actorUser.companyId) {
        const companyEmpIds = new Set(
          this.db.employees.filter((e) => e.companyId === actorUser.companyId).map((e) => e.id),
        );
        list = list.filter((a) => companyEmpIds.has(a.employeeId));
      }
    }

    if (params?.employeeId) {
      list = list.filter((a) => a.employeeId === params.employeeId);
    }
    if (params?.date) {
      list = list.filter((a) => a.date === params.date);
    }
    if (params?.departmentId) {
      const empIdsInDept = this.db.employees
        .filter((e) => e.departmentId === params.departmentId)
        .map((e) => e.id);
      list = list.filter((a) => empIdsInDept.includes(a.employeeId));
    }

    return list.sort((a, b) => (b.date > a.date ? 1 : -1));
  }

  getTodayStatus(employeeId: string) {
    const today = new Date().toISOString().split('T')[0];
    const record = this.db.attendanceRecords.find(
      (a) => a.employeeId === employeeId && a.date === today,
    );

    if (!record) {
      return {
        isCheckedIn: false,
        isCheckedOut: false,
        checkInTime: null,
        checkOutTime: null,
        workingHours: 0,
        status: 'Not Checked In',
      };
    }

    return {
      isCheckedIn: Boolean(record.checkIn),
      isCheckedOut: Boolean(record.checkOut),
      checkInTime: record.checkIn,
      checkOutTime: record.checkOut,
      workingHours: record.workingHours,
      status: record.status,
      recordId: record.id,
    };
  }

  checkIn(dto: CheckInDto) {
    const { employeeId, remarks } = dto;
    const today = new Date().toISOString().split('T')[0];
    const employee = this.db.employees.find((e) => e.id === employeeId);
    if (!employee) throw new NotFoundException('Employee not found');

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 30);
    const punchStatus = isLate ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;

    let record = this.db.attendanceRecords.find(
      (a) => a.employeeId === employeeId && a.date === today,
    );

    if (record) {
      record.checkIn = record.checkIn || timeStr;
      record.checkOut = '';
      record.status = punchStatus;
      if (remarks) record.remarks = remarks;
    } else {
      record = {
        id: `att-${Date.now()}`,
        employeeId,
        employeeName: `${employee.firstName} ${employee.lastName}`,
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
      employee.id,
      `${employee.firstName} ${employee.lastName}`,
      'EMPLOYEE',
      'ATTENDANCE_CHECKIN',
      'Attendance',
      `Checked in at ${timeStr} (${record.status})`,
      record.id,
    );

    this.db.persist();

    if (this.eventsGateway) {
      this.eventsGateway.emitAttendancePunch({
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        time: timeStr,
        status: record.status,
      });
    }

    return record;
  }

  checkOut(dto: CheckOutDto) {
    const { employeeId, remarks } = dto;
    const today = new Date().toISOString().split('T')[0];
    let record = this.db.attendanceRecords.find(
      (a) => a.employeeId === employeeId && a.date === today,
    );

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    if (!record) {
      const employee = this.db.employees.find((e) => e.id === employeeId);
      record = {
        id: `att-${Date.now()}`,
        employeeId,
        employeeName: employee ? `${employee.firstName} ${employee.lastName}` : 'Employee',
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
      record.checkOut = timeStr;
      record.workingHours = record.workingHours > 0 ? record.workingHours : 8.5;
      record.overtimeHours =
        record.workingHours > 8.0 ? parseFloat((record.workingHours - 8.0).toFixed(1)) : 0;
      if (remarks) record.remarks = remarks;
    }

    this.db.logAudit(
      employeeId,
      record.employeeName || 'Employee',
      'EMPLOYEE',
      'ATTENDANCE_CHECKOUT',
      'Attendance',
      `Checked out at ${timeStr} with ${record.workingHours} working hours`,
      record.id,
    );

    this.db.persist();

    if (this.eventsGateway) {
      this.eventsGateway.emitNotification({
        title: 'Attendance Punch Out',
        message: `${record.employeeName} completed work shift at ${timeStr}.`,
        type: 'info',
        module: 'attendance',
      });
    }

    return record;
  }

  manualEntry(data: RegularizeAttendanceDto, actorName = 'HR Admin') {
    const employee = this.db.employees.find((e) => e.id === data.employeeId);
    if (!employee) throw new NotFoundException('Employee not found');

    const newRecord: AttendanceRecord = {
      id: `att-manual-${Date.now()}`,
      employeeId: data.employeeId,
      employeeName: `${employee.firstName} ${employee.lastName}`,
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
      `Manual attendance entry for ${employee.firstName} ${employee.lastName} on ${data.date}`,
      newRecord.id,
    );

    this.db.persist();
    return newRecord;
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
      throw new BadRequestException('No employee profile is linked to this authenticated user account.');
    }

    if (
      employee.status === EmployeeStatus.INACTIVE ||
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

    // 3. Fallback to active locations or headquarter if list is still empty
    if (offices.length === 0) {
      const hq = this.db.locations.find((l) => l.isHeadquarter && l.isActive !== false) || this.db.locations[0];
      if (hq) offices.push(hq);
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
      (ws) => ws.employeeId === employee.id && ws.status === WorkSessionStatus.ACTIVE,
    );

    const now = new Date();
    const serverTime = now.toISOString();
    const today = serverTime.split('T')[0];

    let elapsedSeconds = 0;
    if (activeSession) {
      const startMs = new Date(activeSession.startTime).getTime();
      elapsedSeconds = Math.max(0, Math.floor((now.getTime() - startMs) / 1000));
    }

    const todaySessions = this.db.workSessions.filter(
      (ws) => ws.employeeId === employee.id && ws.startTime.startsWith(today),
    );

    const totalSecondsWorked = todaySessions.reduce((acc, s) => {
      if (s.status === WorkSessionStatus.ACTIVE) {
        return acc + elapsedSeconds;
      }
      return acc + (s.durationSeconds || 0);
    }, 0);

    const lastCompletedSession = todaySessions
      .filter((s) => s.status === WorkSessionStatus.COMPLETED)
      .sort((a, b) => (b.endTime || '') > (a.endTime || '') ? 1 : -1)[0] || null;

    return {
      hasActiveSession: Boolean(activeSession),
      activeSession: activeSession
        ? {
            id: activeSession.id,
            status: activeSession.status,
            startTime: activeSession.startTime,
            officeLocationId: activeSession.officeLocationId,
            officeLocationName: activeSession.officeLocationName,
            startDistanceMeters: activeSession.startDistanceMeters,
            startAccuracy: activeSession.startAccuracy,
            elapsedSeconds,
            formattedElapsed: formatDurationSeconds(elapsedSeconds),
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
      // 1. Validate coordinate sanity
      if (!isValidCoordinate(dto.latitude, dto.longitude)) {
        throw new BadRequestException(
          `Invalid GPS coordinates. Latitude must be between -90 and 90, and Longitude between -180 and 180.`,
        );
      }

      // 2. Validate GPS accuracy threshold
      if (dto.accuracy !== undefined) {
        if (typeof dto.accuracy !== 'number' || Number.isNaN(dto.accuracy) || dto.accuracy < 0) {
          throw new BadRequestException('GPS accuracy must be a valid positive number in meters.');
        }
        if (dto.accuracy > DEFAULT_MAX_GPS_ACCURACY_METERS) {
          throw new BadRequestException(
            `GPS accuracy reading too low (${Math.round(dto.accuracy)}m). Maximum allowed threshold is ${DEFAULT_MAX_GPS_ACCURACY_METERS}m. Please ensure high-accuracy GPS is enabled.`,
          );
        }
      }

      // 3. Reject duplicate active sessions
      const existingActive = this.db.workSessions.find(
        (ws) => ws.employeeId === employee.id && ws.status === WorkSessionStatus.ACTIVE,
      );
      if (existingActive) {
        throw new BadRequestException(
          `Employee already has an active work session (ID: ${existingActive.id}, started at ${existingActive.startTime}). Please stop the active session first.`,
        );
      }

      // 4. Resolve office and geofence distance
      const authorizedOffices = this.resolveAuthorizedOffices(employee);
      if (authorizedOffices.length === 0) {
        throw new BadRequestException('No authorized office location is configured for this employee.');
      }

      let matchedOffice: Location | null = null;
      let matchedDistance = Number.MAX_VALUE;

      if (dto.officeLocationId) {
        const requestedOffice = authorizedOffices.find((o) => o.id === dto.officeLocationId);
        if (!requestedOffice) {
          throw new BadRequestException(`Office location "${dto.officeLocationId}" is not in employee's authorized offices.`);
        }
        const dist = calculateDistanceMeters(
          dto.latitude,
          dto.longitude,
          requestedOffice.latitude!,
          requestedOffice.longitude!,
        );
        if (dist <= (requestedOffice.radiusMeters || 200)) {
          matchedOffice = requestedOffice;
          matchedDistance = dist;
        } else {
          throw new BadRequestException(
            `Outside allowed office boundary. You are ${Math.round(dist)}m away from ${requestedOffice.name} (allowed radius: ${requestedOffice.radiusMeters || 200}m).`,
          );
        }
      } else {
        // Check all authorized offices
        let closestOffice = authorizedOffices[0];
        let closestDist = Number.MAX_VALUE;

        for (const office of authorizedOffices) {
          const dist = calculateDistanceMeters(
            dto.latitude,
            dto.longitude,
            office.latitude!,
            office.longitude!,
          );
          if (dist < closestDist) {
            closestDist = dist;
            closestOffice = office;
          }
          if (dist <= (office.radiusMeters || 200)) {
            matchedOffice = office;
            matchedDistance = dist;
            break;
          }
        }

        if (!matchedOffice) {
          throw new BadRequestException(
            `Outside allowed office boundary. You are ${Math.round(closestDist)}m away from ${closestOffice.name} (allowed radius: ${closestOffice.radiusMeters || 200}m).`,
          );
        }
      }

      // 5. Validate and securely store start selfie
      let startSelfieUrl = '';
      if (file) {
        startSelfieUrl = saveMulterSelfie(file, employee.id, 'start');
      } else if (dto.selfie) {
        startSelfieUrl = saveBase64Selfie(dto.selfie, employee.id, 'start');
      } else {
        throw new BadRequestException('Selfie capture is required to start work.');
      }

      // 6. Record authoritative server timestamp
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
        startLatitude: dto.latitude,
        startLongitude: dto.longitude,
        startAccuracy: dto.accuracy,
        startDistanceMeters: Math.round(matchedDistance * 100) / 100,
        startSelfieUrl,
        deviceInfo: dto.deviceInfo || '',
        ipAddress,
        createdAt: startTime,
        updatedAt: startTime,
      };

      this.db.workSessions.unshift(session);

      // 7. Synchronize daily AttendanceRecord check-in
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
          remarks: `Geo-fenced start at ${matchedOffice.name} (${Math.round(matchedDistance)}m)`,
          createdAt: startTime,
        };
        this.db.attendanceRecords.unshift(attRecord);
      } else if (!attRecord.checkIn) {
        attRecord.checkIn = timeStr;
      }

      // 8. Audit log & persistence
      this.db.logAudit(
        employee.id,
        `${employee.firstName} ${employee.lastName}`,
        actorUser.role,
        'WORK_SESSION_START',
        'Attendance',
        `Started work session at ${matchedOffice.name} (Distance: ${Math.round(matchedDistance)}m, Accuracy: ${dto.accuracy || 'N/A'}m)`,
        session.id,
        ipAddress,
      );

      this.db.persist();

      // 9. Real-time WebSocket emission
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
        (ws) => ws.employeeId === employee.id && ws.status === WorkSessionStatus.ACTIVE,
      );
      if (!activeSession) {
        throw new BadRequestException('No active work session found for employee.');
      }

      // 2. Validate coordinates
      if (!isValidCoordinate(dto.latitude, dto.longitude)) {
        throw new BadRequestException(
          `Invalid GPS coordinates. Latitude must be between -90 and 90, and Longitude between -180 and 180.`,
        );
      }

      // 3. Validate GPS accuracy threshold
      if (dto.accuracy !== undefined) {
        if (typeof dto.accuracy !== 'number' || Number.isNaN(dto.accuracy) || dto.accuracy < 0) {
          throw new BadRequestException('GPS accuracy must be a valid positive number in meters.');
        }
        if (dto.accuracy > DEFAULT_MAX_GPS_ACCURACY_METERS) {
          throw new BadRequestException(
            `GPS accuracy reading too low (${Math.round(dto.accuracy)}m). Maximum allowed threshold is ${DEFAULT_MAX_GPS_ACCURACY_METERS}m. Please ensure high-accuracy GPS is enabled.`,
          );
        }
      }

      // 4. Resolve office and validate geofence boundary
      const authorizedOffices = this.resolveAuthorizedOffices(employee);
      let targetOffice = authorizedOffices.find((o) => o.id === activeSession.officeLocationId);
      if (!targetOffice) {
        targetOffice = authorizedOffices[0];
      }

      const dist = calculateDistanceMeters(
        dto.latitude,
        dto.longitude,
        targetOffice.latitude!,
        targetOffice.longitude!,
      );

      if (dist > (targetOffice.radiusMeters || 200)) {
        throw new BadRequestException(
          `Outside allowed office boundary. You are ${Math.round(dist)}m away from ${targetOffice.name} (allowed radius: ${targetOffice.radiusMeters || 200}m).`,
        );
      }

      // 5. Validate and securely store stop selfie
      let stopSelfieUrl = '';
      if (file) {
        stopSelfieUrl = saveMulterSelfie(file, employee.id, 'stop');
      } else if (dto.selfie) {
        stopSelfieUrl = saveBase64Selfie(dto.selfie, employee.id, 'stop');
      } else {
        throw new BadRequestException('Selfie capture is required to stop work.');
      }

      // 6. Calculate authoritative server duration
      const serverNow = new Date();
      const endTime = serverNow.toISOString();
      const startMs = new Date(activeSession.startTime).getTime();
      const endMs = serverNow.getTime();
      const durationSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));
      const durationFormatted = formatDurationSeconds(durationSeconds);

      // 7. Update active session to COMPLETED
      activeSession.status = WorkSessionStatus.COMPLETED;
      activeSession.endTime = endTime;
      activeSession.durationSeconds = durationSeconds;
      activeSession.durationFormatted = durationFormatted;
      activeSession.stopLatitude = dto.latitude;
      activeSession.stopLongitude = dto.longitude;
      activeSession.stopAccuracy = dto.accuracy;
      activeSession.stopDistanceMeters = Math.round(dist * 100) / 100;
      activeSession.stopSelfieUrl = stopSelfieUrl;
      activeSession.updatedAt = endTime;

      // 8. Synchronize daily AttendanceRecord check-out and working hours
      const today = endTime.split('T')[0];
      const timeStr = serverNow.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      let attRecord = this.db.attendanceRecords.find(
        (a) => a.employeeId === employee.id && a.date === today,
      );

      if (attRecord) {
        attRecord.checkOut = timeStr;
        const totalHours = Math.round(((attRecord.workingHours || 0) + durationSeconds / 3600) * 100) / 100;
        attRecord.workingHours = totalHours;
        if (dto.remarks) {
          attRecord.remarks = attRecord.remarks ? `${attRecord.remarks} | ${dto.remarks}` : dto.remarks;
        }
      }

      // 9. Audit log & persist
      this.db.logAudit(
        employee.id,
        `${employee.firstName} ${employee.lastName}`,
        actorUser.role,
        'WORK_SESSION_STOP',
        'Attendance',
        `Stopped work session. Duration: ${durationFormatted} (${durationSeconds}s) at ${targetOffice.name}`,
        activeSession.id,
        ipAddress,
      );

      this.db.persist();

      // 10. Real-time WebSocket emission
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
        serverTime: new Date().toISOString(),
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
