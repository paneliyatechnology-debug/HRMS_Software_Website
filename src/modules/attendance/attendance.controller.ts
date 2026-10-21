import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service.js';
import { CheckInDto } from './dto/check-in.dto.js';
import { CheckOutDto } from './dto/check-out.dto.js';
import { RegularizeAttendanceDto } from './dto/regularize-attendance.dto.js';
import { BiometricSyncDto } from './dto/biometric-sync.dto.js';
import { QueryAttendanceDto } from './dto/query-attendance.dto.js';

@ApiTags('Attendance')
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  @ApiOperation({
    summary: 'List attendance records with filters',
    description: 'Retrieves attendance logs filtered by employee, date, or department.',
  })
  @ApiResponse({ status: 200, description: 'Filtered list of attendance records' })
  findAll(@Query() query: QueryAttendanceDto) {
    return this.attendanceService.findAll(query);
  }

  @Get('my-status/:employeeId')
  @ApiOperation({
    summary: 'Get current punch clock state for employee',
    description: 'Returns today’s check-in time, check-out time, current status, and hours logged so far.',
  })
  @ApiParam({ name: 'employeeId', description: 'Employee ID' })
  @ApiResponse({ status: 200, description: 'Today attendance state' })
  getMyStatus(@Param('employeeId') employeeId: string) {
    return this.attendanceService.getTodayStatus(employeeId);
  }

  @Post('check-in')
  @ApiOperation({
    summary: 'Employee Clock-in',
    description: 'Records time-stamp punch for start of workday and emits WebSocket event.',
  })
  @ApiBody({ type: CheckInDto })
  @ApiResponse({ status: 201, description: 'Check-in recorded successfully' })
  checkIn(@Body() body: CheckInDto) {
    return this.attendanceService.checkIn(body);
  }

  @Post('check-out')
  @ApiOperation({
    summary: 'Employee Clock-out',
    description: 'Records end-of-day clock out and calculates total hours and overtime.',
  })
  @ApiBody({ type: CheckOutDto })
  @ApiResponse({ status: 201, description: 'Check-out recorded successfully' })
  checkOut(@Body() body: CheckOutDto) {
    return this.attendanceService.checkOut(body);
  }

  @Post('regularize')
  @ApiOperation({
    summary: 'HR manual regularization / correction entry',
    description: 'Allows HR admins to insert or correct missed punches for attendance audits.',
  })
  @ApiBody({ type: RegularizeAttendanceDto })
  @ApiResponse({ status: 201, description: 'Attendance regularized successfully' })
  regularize(@Body() body: RegularizeAttendanceDto) {
    return this.attendanceService.manualEntry(body);
  }

  @Post('biometric-sync')
  @ApiOperation({
    summary: 'Biometric hardware machine sync (ZKTeco / eSSL device webhook)',
    description: 'Processes batched hardware reader punch logs and maps them to employee daily records.',
  })
  @ApiBody({ type: BiometricSyncDto })
  @ApiResponse({ status: 200, description: 'Biometric logs synchronized successfully' })
  biometricSync(@Body() body: BiometricSyncDto) {
    return this.attendanceService.syncBiometricLogs(body);
  }
}
