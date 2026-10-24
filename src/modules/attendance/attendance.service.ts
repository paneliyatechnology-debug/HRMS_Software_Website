import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { AttendanceRecord, AttendanceStatus } from '../../common/types.js';
import { EventsGateway } from '../events/events.gateway.js';
import { CheckInDto } from './dto/check-in.dto.js';
import { CheckOutDto } from './dto/check-out.dto.js';
import { RegularizeAttendanceDto } from './dto/regularize-attendance.dto.js';
import { BiometricSyncDto } from './dto/biometric-sync.dto.js';
import { QueryAttendanceDto } from './dto/query-attendance.dto.js';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly db: DatabaseService,
    @Optional() private readonly eventsGateway?: EventsGateway,
  ) {}

  findAll(params?: QueryAttendanceDto) {
    let list = [...this.db.attendanceRecords];

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
}
