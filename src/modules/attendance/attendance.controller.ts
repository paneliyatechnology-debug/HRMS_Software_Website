import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Req,
  Res,
  Ip,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { AttendanceService } from './attendance.service.js';
import { CheckInDto } from './dto/check-in.dto.js';
import { CheckOutDto } from './dto/check-out.dto.js';
import { RegularizeAttendanceDto } from './dto/regularize-attendance.dto.js';
import { BiometricSyncDto } from './dto/biometric-sync.dto.js';
import { QueryAttendanceDto } from './dto/query-attendance.dto.js';
import { StartWorkDto } from './dto/start-work.dto.js';
import { StopWorkDto } from './dto/stop-work.dto.js';
import { QueryWorkHistoryDto } from './dto/query-work-history.dto.js';

@ApiTags('Attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  @ApiOperation({
    summary: 'List attendance records with filters',
    description: 'Retrieves attendance logs filtered by employee, date, or department.',
  })
  @ApiResponse({ status: 200, description: 'Filtered list of attendance records' })
  findAll(@Query() query: QueryAttendanceDto, @Req() req: any) {
    return this.attendanceService.findAll(query, req.user);
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

  // =========================================================================
  // SECURE GEO-FENCED WORK TIMER ENDPOINTS
  // =========================================================================

  @Get('work/status')
  @ApiOperation({
    summary: 'Get active work timer status for current authenticated employee',
    description:
      'Returns whether the employee has an active session, elapsed seconds, authoritative server clock, assigned office geofence details, and today’s summary.',
  })
  @ApiResponse({ status: 200, description: 'Current work timer state' })
  getWorkStatus(@Req() req: any) {
    return this.attendanceService.getWorkStatus(req.user);
  }

  @Post('work/start')
  @ApiOperation({
    summary: 'Start geo-fenced employee work timer session',
    description:
      'Validates employee assignment, office geofence radius, GPS accuracy, confirms required selfie upload, and records authoritative server start timestamp.',
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({ type: StartWorkDto })
  @ApiResponse({ status: 201, description: 'Work session started successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed (out of geofence, missing selfie, low GPS accuracy, active session)' })
  @UseInterceptors(
    FileInterceptor('selfie', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  startWork(
    @Body() body: StartWorkDto,
    @Req() req: any,
    @Ip() ip: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.attendanceService.startWork(body, req.user, file, ip);
  }

  @Post('work/stop')
  @ApiOperation({
    summary: 'Stop active employee work timer session',
    description:
      'Validates employee is inside assigned office geofence, verifies fresh stop selfie, computes authoritative duration on server, and marks session completed.',
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({ type: StopWorkDto })
  @ApiResponse({ status: 201, description: 'Work session stopped and duration calculated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed (out of geofence, missing selfie, no active session)' })
  @UseInterceptors(
    FileInterceptor('selfie', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  stopWork(
    @Body() body: StopWorkDto,
    @Req() req: any,
    @Ip() ip: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.attendanceService.stopWork(body, req.user, file, ip);
  }

  @Get('work/history')
  @ApiOperation({
    summary: 'Get paginated work timer session history',
    description:
      'Employees view only their own sessions. Admins view sessions within their company. SuperAdmins can query across all companies.',
  })
  @ApiResponse({ status: 200, description: 'Paginated work session history' })
  getWorkHistory(@Query() query: QueryWorkHistoryDto, @Req() req: any) {
    return this.attendanceService.getWorkHistory(query, req.user);
  }

  @Get('work/selfie/:sessionId/:type')
  @ApiOperation({
    summary: 'Securely retrieve start or stop selfie image for a work session',
    description:
      'Protected endpoint. Employees can view their own selfies; Admins view their company; SuperAdmins view all.',
  })
  @ApiParam({ name: 'sessionId', description: 'Work session ID' })
  @ApiParam({ name: 'type', enum: ['start', 'stop'], description: 'Selfie capture type' })
  @ApiResponse({ status: 200, description: 'Selfie image stream' })
  getSelfie(
    @Param('sessionId') sessionId: string,
    @Param('type') type: 'start' | 'stop',
    @Req() req: any,
    @Res() res: Response,
  ) {
    const { filePath, mimeType } = this.attendanceService.getSelfieFile(sessionId, type, req.user);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    return res.sendFile(filePath);
  }
}
