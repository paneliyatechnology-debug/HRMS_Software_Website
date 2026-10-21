import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service.js';
import { AttendanceStatus } from '../common/types.js';

@ApiTags('Attendance')
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  @ApiOperation({ summary: 'List attendance records with filters' })
  findAll(
    @Query('employeeId') employeeId?: string,
    @Query('date') date?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.attendanceService.findAll({ employeeId, date, departmentId });
  }

  @Get('my-status/:employeeId')
  @ApiOperation({ summary: 'Get current punch clock state for employee' })
  getMyStatus(@Param('employeeId') employeeId: string) {
    return this.attendanceService.getTodayStatus(employeeId);
  }

  @Post('check-in')
  @ApiOperation({ summary: 'Employee Clock-in' })
  checkIn(@Body() body: { employeeId: string; remarks?: string }) {
    return this.attendanceService.checkIn(body.employeeId, body.remarks);
  }

  @Post('check-out')
  @ApiOperation({ summary: 'Employee Clock-out' })
  checkOut(@Body() body: { employeeId: string; remarks?: string }) {
    return this.attendanceService.checkOut(body.employeeId, body.remarks);
  }

  @Post('regularize')
  @ApiOperation({ summary: 'HR manual regularization / correction entry' })
  regularize(
    @Body()
    body: {
      employeeId: string;
      date: string;
      checkIn: string;
      checkOut?: string;
      status: AttendanceStatus;
      remarks: string;
    },
  ) {
    return this.attendanceService.manualEntry(body);
  }

  @Post('biometric-sync')
  @ApiOperation({ summary: 'Biometric hardware machine sync (ZKTeco / eSSL device webhook)' })
  biometricSync(
    @Body()
    body: {
      deviceId?: string;
      logs: Array<{
        deviceId: string;
        employeeCode: string;
        punchTime: string;
        type?: 'IN' | 'OUT';
      }>;
    },
  ) {
    return this.attendanceService.syncBiometricLogs(body.logs || []);
  }
}
