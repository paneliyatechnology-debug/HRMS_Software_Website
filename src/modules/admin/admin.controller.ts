import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { AdminService } from './admin.service.js';
import { AdminGuard } from './guards/admin.guard.js';
import { CreateAdminEmployeeDto } from './dto/create-admin-employee.dto.js';
import { UpdateAdminEmployeeDto } from './dto/update-admin-employee.dto.js';
import { QueryAdminEmployeesDto } from './dto/query-admin-employees.dto.js';
import { UpdateAdminCompanyDto } from './dto/update-admin-company.dto.js';
import { AdminManualAttendanceDto } from './dto/admin-manual-attendance.dto.js';
import { CreateAdminDepartmentDto } from './dto/create-admin-department.dto.js';
import { CreateAdminDesignationDto } from './dto/create-admin-designation.dto.js';
import { LeaveStatus } from '../../common/types.js';

@ApiTags('Admin (Company Level)')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // -------------------------------------------------------------
  // 1. DASHBOARD & SYSTEM VITALS
  // -------------------------------------------------------------
  @Get('dashboard')
  @ApiOperation({
    summary: 'Company Admin Dashboard Snapshot',
    description: 'Retrieves overview stats, today attendance summary, and pending approval metrics for the admin company.',
  })
  @ApiQuery({ name: 'companyId', required: false, description: 'Super Admin company switcher' })
  @ApiResponse({ status: 200, description: 'Dashboard metrics dataset' })
  getDashboard(@Req() req: any, @Query('companyId') companyId?: string) {
    return this.adminService.getDashboard(req.user, companyId);
  }

  // -------------------------------------------------------------
  // 2. COMPANY PROFILE & SETTINGS
  // -------------------------------------------------------------
  @Get('company')
  @ApiOperation({
    summary: 'Get assigned Company Profile',
    description: 'Retrieves full dossier of the company the logged-in administrator oversees.',
  })
  @ApiResponse({ status: 200, description: 'Company profile dossier' })
  getCompany(@Req() req: any) {
    return this.adminService.getCompany(req.user);
  }

  @Put('company')
  @ApiOperation({
    summary: 'Update Company Profile and Contact Info',
    description: 'Updates corporate phone, address, and legal name.',
  })
  @ApiBody({ type: UpdateAdminCompanyDto })
  @ApiResponse({ status: 200, description: 'Company profile updated successfully' })
  updateCompany(@Req() req: any, @Body() body: UpdateAdminCompanyDto) {
    return this.adminService.updateCompany(req.user, body);
  }

  // -------------------------------------------------------------
  // 3. EMPLOYEE ROSTER MANAGEMENT (COMPANY SCOPED)
  // -------------------------------------------------------------
  @Get('employees')
  @ApiOperation({
    summary: 'List and filter company employees',
    description: 'Retrieves paginated employee roster of the admin company with filters for department, designation, and status.',
  })
  @ApiResponse({ status: 200, description: 'Paginated employee list' })
  getEmployees(@Req() req: any, @Query() query: QueryAdminEmployeesDto) {
    return this.adminService.getEmployees(req.user, query);
  }

  @Get('employees/:id')
  @ApiOperation({
    summary: 'Get employee details by ID or employeeCode',
    description: 'Retrieves complete profile, linked login credentials, and leave balance of a company employee.',
  })
  @ApiParam({ name: 'id', description: 'Employee ID or employeeCode' })
  @ApiResponse({ status: 200, description: 'Employee dossier' })
  @ApiResponse({ status: 404, description: 'Employee not found in your company' })
  getEmployeeById(@Req() req: any, @Param('id') id: string) {
    return this.adminService.getEmployeeById(req.user, id);
  }

  @Post('employees')
  @ApiOperation({
    summary: 'Create and onboard new employee into company',
    description: 'Enforces strict global email uniqueness, provisions both Employee profile and unified User account, and initializes leave balances.',
  })
  @ApiBody({ type: CreateAdminEmployeeDto })
  @ApiResponse({ status: 201, description: 'Employee onboarded successfully' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  createEmployee(@Req() req: any, @Body() body: CreateAdminEmployeeDto) {
    return this.adminService.createEmployee(req.user, body);
  }

  @Put('employees/:id')
  @ApiOperation({
    summary: 'Update employee profile',
    description: 'Updates employee attributes and synchronizes linked user login credentials.',
  })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiBody({ type: UpdateAdminEmployeeDto })
  @ApiResponse({ status: 200, description: 'Employee updated successfully' })
  @ApiResponse({ status: 404, description: 'Employee not found in your company' })
  updateEmployee(@Req() req: any, @Param('id') id: string, @Body() body: UpdateAdminEmployeeDto) {
    return this.adminService.updateEmployee(req.user, id, body);
  }

  @Delete('employees/:id')
  @ApiOperation({
    summary: 'Delete employee record from company',
    description: 'Removes employee from company and deletes associated user credentials.',
  })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiResponse({ status: 200, description: 'Employee deleted successfully' })
  deleteEmployee(@Req() req: any, @Param('id') id: string) {
    return this.adminService.deleteEmployee(req.user, id);
  }

  @Post('employees/:id/resend-invitation')
  @ApiOperation({
    summary: 'Resend password setup email invitation to employee',
    description: 'Generates a new secure 30-minute one-time token, revokes previous invitations, and dispatches email via SMTP.',
  })
  @ApiParam({ name: 'id', description: 'Employee ID, code, or registered email' })
  @ApiResponse({ status: 200, description: 'Invitation email resent successfully' })
  @ApiResponse({ status: 404, description: 'Employee not found in company' })
  resendInvitation(@Req() req: any, @Param('id') id: string) {
    return this.adminService.resendEmployeeInvitation(req.user, id);
  }

  // -------------------------------------------------------------
  // 4. ATTENDANCE MANAGEMENT (COMPANY SCOPED)
  // -------------------------------------------------------------
  @Get('attendance')
  @ApiOperation({
    summary: 'Get attendance logs for company employees',
    description: 'Returns attendance records filtered by date (YYYY-MM-DD), month (YYYY-MM), or employeeId.',
  })
  @ApiQuery({ name: 'date', required: false, example: '2026-10-30', description: 'Attendance date' })
  @ApiQuery({ name: 'month', required: false, example: '2026-10', description: 'Month prefix' })
  @ApiQuery({ name: 'userId', required: false, description: 'Specific user ID' })
  @ApiQuery({ name: 'employeeId', required: false, description: 'Specific employee ID (legacy alias for userId)' })
  @ApiResponse({ status: 200, description: 'Attendance records' })
  getAttendance(
    @Req() req: any,
    @Query('date') date?: string,
    @Query('month') month?: string,
    @Query('userId') userId?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.adminService.getAttendance(req.user, { date, month, employeeId: userId || employeeId });
  }

  @Post('attendance/manual')
  @ApiOperation({
    summary: 'Regularize or manually insert attendance punch',
    description: 'Admin override punch for attendance adjustments, late regularizations, or manual check-ins.',
  })
  @ApiBody({ type: AdminManualAttendanceDto })
  @ApiResponse({ status: 200, description: 'Attendance regularized successfully' })
  manualAttendance(@Req() req: any, @Body() body: AdminManualAttendanceDto) {
    return this.adminService.manualAttendance(req.user, body);
  }

  // -------------------------------------------------------------
  // 5. PAYROLL RECORDS (COMPANY SCOPED)
  // -------------------------------------------------------------
  @Get('payroll')
  @ApiOperation({
    summary: 'View company payroll disbursement records',
    description: 'Retrieves salary slips and payroll calculations for employees in the administrator company.',
  })
  @ApiQuery({ name: 'month', required: false, example: 'October 2026', description: 'Pay period or month' })
  @ApiResponse({ status: 200, description: 'Payroll records' })
  getPayroll(@Req() req: any, @Query('month') month?: string) {
    return this.adminService.getPayroll(req.user, { month });
  }

  // -------------------------------------------------------------
  // 7. DEPARTMENTS & DESIGNATIONS
  // -------------------------------------------------------------
  @Get('departments')
  @ApiOperation({ summary: 'List all departments' })
  getDepartments(@Req() req: any) {
    return this.adminService.getDepartments(req.user);
  }

  @Post('departments')
  @ApiOperation({ summary: 'Create a new department' })
  @ApiBody({ type: CreateAdminDepartmentDto })
  createDepartment(@Req() req: any, @Body() body: CreateAdminDepartmentDto) {
    return this.adminService.createDepartment(req.user, body);
  }

  @Get('designations')
  @ApiOperation({ summary: 'List all designations' })
  getDesignations(@Req() req: any) {
    return this.adminService.getDesignations(req.user);
  }

  @Post('designations')
  @ApiOperation({ summary: 'Create a new designation' })
  @ApiBody({ type: CreateAdminDesignationDto })
  createDesignation(@Req() req: any, @Body() body: CreateAdminDesignationDto) {
    return this.adminService.createDesignation(req.user, body);
  }

  // -------------------------------------------------------------
  // 8. ADMIN PROFILE
  // -------------------------------------------------------------
  @Get('profile')
  @ApiOperation({ summary: 'Get current logged-in Administrator profile & company linkage' })
  @ApiResponse({ status: 200, description: 'Admin profile dossier' })
  getProfile(@Req() req: any) {
    return this.adminService.getProfile(req.user);
  }
}

