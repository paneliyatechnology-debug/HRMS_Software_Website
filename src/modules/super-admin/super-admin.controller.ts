import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
import { SuperAdminService } from './super-admin.service.js';
import { SuperAdminGuard } from './guards/super-admin.guard.js';
import { CreateSuperAdminUserDto } from './dto/create-super-admin-user.dto.js';
import { UpdateSuperAdminUserDto } from './dto/update-super-admin-user.dto.js';
import { UpdateUserRoleDto } from './dto/update-user-role.dto.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto.js';
import { QuerySuperAdminUsersDto } from './dto/query-super-admin-users.dto.js';
import { UpdateSystemSettingsDto } from './dto/system-settings.dto.js';
import { LeaveOverrideDto } from './dto/leave-override.dto.js';
import { CreateCompanyDto } from './dto/create-company.dto.js';
import { UpdateCompanyDto } from './dto/update-company.dto.js';
import { CreateAdminDto } from './dto/create-admin.dto.js';
import { UpdateAdminDto } from './dto/update-admin.dto.js';
import { QueryAdminsDto } from './dto/query-admins.dto.js';

@ApiTags('Super Admin')
@ApiBearerAuth()
@UseGuards(SuperAdminGuard)
@Controller('super-admin')
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  // -------------------------------------------------------------
  // 1. DASHBOARD & SYSTEM OVERVIEW (Badhu access kari sake che)
  // -------------------------------------------------------------
  @Get('dashboard')
  @ApiOperation({
    summary: 'Master Super Admin Dashboard & System Vitality',
    description:
      'Provides high-level cross-module insights: user role distribution, employee statuses, live attendance snapshot, pending approvals, financial payroll metrics, and system memory/hardware health.',
  })
  @ApiResponse({ status: 200, description: 'Unified master metrics dataset' })
  getDashboard() {
    return this.superAdminService.getDashboardOverview();
  }

  @Get('database-stats')
  @ApiOperation({
    summary: 'Master Database Collection Counts',
    description: 'Retrieves item counts for all internal data models and tables in HRMS.',
  })
  @ApiResponse({ status: 200, description: 'Complete database entity counts' })
  getDatabaseStats() {
    return this.superAdminService.getDatabaseStats();
  }

  // -------------------------------------------------------------
  // 1.1 MULTI-COMPANY MANAGEMENT (SUPER_ADMIN ONLY)
  // -------------------------------------------------------------
  @Get('companies')
  @ApiOperation({
    summary: 'List all registered companies',
    description: 'Retrieves all registered companies along with employee count and admin details.',
  })
  @ApiResponse({ status: 200, description: 'List of companies' })
  getCompanies() {
    return this.superAdminService.getCompanies();
  }

  @Post('companies')
  @ApiOperation({
    summary: 'Create and register a new company (auto-generates CMP-000001 code)',
    description: 'Registers a new enterprise client company with auto-generated unique Company Code.',
  })
  @ApiBody({ type: CreateCompanyDto })
  @ApiResponse({ status: 201, description: 'Company registered successfully' })
  createCompany(@Body() body: CreateCompanyDto, @Req() req: any) {
    return this.superAdminService.createCompany(body, req.user);
  }

  @Get('companies/:id')
  @ApiOperation({
    summary: 'Get company details',
    description: 'Retrieves complete company profile, assigned admin, and employee roster count.',
  })
  @ApiParam({ name: 'id', description: 'Company ID or Company Code' })
  @ApiResponse({ status: 200, description: 'Company dossier' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  getCompanyById(@Param('id') id: string) {
    return this.superAdminService.getCompanyById(id);
  }

  @Put('companies/:id')
  @ApiOperation({
    summary: 'Update company profile or status (Active/Inactive)',
    description: 'Updates company metadata, assigned administrator, or activates/suspends the company.',
  })
  @ApiParam({ name: 'id', description: 'Company ID or Company Code' })
  @ApiBody({ type: UpdateCompanyDto })
  @ApiResponse({ status: 200, description: 'Company updated successfully' })
  updateCompany(
    @Param('id') id: string,
    @Body() body: UpdateCompanyDto,
    @Req() req: any,
  ) {
    return this.superAdminService.updateCompany(id, body, req.user);
  }

  @Get('companies/:id/employees')
  @ApiOperation({
    summary: 'View employees of a selected company',
    description: 'Retrieves all employees belonging to the specified company ID or Company Code.',
  })
  @ApiParam({ name: 'id', description: 'Company ID or Company Code' })
  @ApiResponse({ status: 200, description: 'Company employees list' })
  getCompanyEmployees(@Param('id') id: string) {
    return this.superAdminService.getCompanyEmployees(id);
  }

  @Post('companies/:id/assign-admin')
  @ApiOperation({
    summary: 'Assign Admin account to a company',
    description: 'Associates an existing or newly created user as the designated Administrator for a company.',
  })
  @ApiParam({ name: 'id', description: 'Company ID' })
  @ApiBody({ schema: { properties: { userId: { type: 'string', example: 'user-1793000000000' } } } })
  @ApiResponse({ status: 200, description: 'Admin assigned to company successfully' })
  assignCompanyAdmin(
    @Param('id') id: string,
    @Body('userId') userId: string,
    @Req() req: any,
  ) {
    return this.superAdminService.assignCompanyAdmin(id, userId, req.user);
  }

  @Delete('companies/:id')
  @ApiOperation({
    summary: 'Delete company and cleanup associated data',
    description: 'Permanently removes a company and cleans up associated users/employees.',
  })
  @ApiParam({ name: 'id', description: 'Company ID or Company Code' })
  @ApiResponse({ status: 200, description: 'Company deleted successfully' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  deleteCompany(@Param('id') id: string, @Req() req: any) {
    return this.superAdminService.deleteCompany(id, req.user);
  }

  // -------------------------------------------------------------
  // 1.2 COMPANY ADMINISTRATORS MANAGEMENT
  // -------------------------------------------------------------
  @Get('admins')
  @ApiOperation({
    summary: 'List all Company Administrators',
    description: 'Retrieves all Company Admins with associated company metadata, status, and filtering options.',
  })
  @ApiResponse({ status: 200, description: 'Paginated administrator list' })
  getAdmins(@Query() query: QueryAdminsDto) {
    return this.superAdminService.getAdmins(query);
  }

  @Get('admins/:id')
  @ApiOperation({
    summary: 'Get Administrator details by ID or email',
    description: 'Retrieves administrator record with company dossier.',
  })
  @ApiParam({ name: 'id', description: 'Admin ID or email' })
  @ApiResponse({ status: 200, description: 'Administrator dossier' })
  @ApiResponse({ status: 404, description: 'Administrator not found' })
  getAdminById(@Param('id') id: string) {
    return this.superAdminService.getAdminById(id);
  }

  @Post('admins')
  @ApiOperation({
    summary: 'Provision new Company Administrator',
    description: 'Creates a new Company Administrator, assigns them to a company, and enforces global email uniqueness.',
  })
  @ApiBody({ type: CreateAdminDto })
  @ApiResponse({ status: 201, description: 'Administrator created successfully' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  createAdmin(@Body() body: CreateAdminDto, @Req() req: any) {
    return this.superAdminService.createAdmin(body, req.user);
  }

  @Put('admins/:id')
  @ApiOperation({
    summary: 'Update Administrator profile or assigned company',
    description: 'Updates administrator details, password, status, or reassigns company.',
  })
  @ApiParam({ name: 'id', description: 'Admin ID' })
  @ApiBody({ type: UpdateAdminDto })
  @ApiResponse({ status: 200, description: 'Administrator updated successfully' })
  updateAdmin(@Param('id') id: string, @Body() body: UpdateAdminDto, @Req() req: any) {
    return this.superAdminService.updateAdmin(id, body, req.user);
  }

  @Delete('admins/:id')
  @ApiOperation({
    summary: 'Delete Company Administrator account',
    description: 'Removes the administrator account.',
  })
  @ApiParam({ name: 'id', description: 'Admin ID' })
  @ApiResponse({ status: 200, description: 'Administrator deleted successfully' })
  deleteAdmin(@Param('id') id: string, @Req() req: any) {
    return this.superAdminService.deleteAdmin(id, req.user);
  }

  // -------------------------------------------------------------
  // 2. USER & RBAC ACCOUNT MANAGEMENT
  // -------------------------------------------------------------
  @Get('users')
  @ApiOperation({
    summary: 'List and filter all system users with RBAC perspectives',
    description:
      'Allows super admins to view all accounts, filter by keyword, system role (SUPER_ADMIN, ADMIN, EMPLOYEE), active/suspended status, or isSuperAdmin flag.',
  })
  @ApiResponse({ status: 200, description: 'Paginated user list with employee linkage' })
  getUsers(@Query() query: QuerySuperAdminUsersDto) {
    return this.superAdminService.getUsers(query);
  }

  @Post('users')
  @ApiOperation({
    summary: 'Create new user account (SUPER_ADMIN, ADMIN, or EMPLOYEE)',
    description:
      'Super Admin direct user provisioning. Allows setting isSuperAdmin flag, custom role, status, and creates the corresponding employee record automatically.',
  })
  @ApiBody({ type: CreateSuperAdminUserDto })
  @ApiResponse({ status: 201, description: 'User account created successfully' })
  @ApiResponse({ status: 409, description: 'User with this email already exists' })
  createUser(@Body() body: CreateSuperAdminUserDto, @Req() req: any) {
    return this.superAdminService.createUser(body, req.user);
  }

  @Get('users/:id')
  @ApiOperation({
    summary: 'Get detailed user dossier',
    description: 'Retrieves complete user record, linked employee record, and recent audit activity.',
  })
  @ApiParam({ name: 'id', description: 'User ID or user email address' })
  @ApiResponse({ status: 200, description: 'Full user dossier' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getUserById(@Param('id') id: string) {
    return this.superAdminService.getUserById(id);
  }

  @Put('users/:id')
  @ApiOperation({
    summary: 'Update user account profile',
    description: 'Updates user contact info, role, isSuperAdmin status, and avatar.',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ type: UpdateSuperAdminUserDto })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  updateUser(
    @Param('id') id: string,
    @Body() body: UpdateSuperAdminUserDto,
    @Req() req: any,
  ) {
    return this.superAdminService.updateUser(id, body, req.user);
  }

  @Put('users/:id/role')
  @ApiOperation({
    summary: 'Change user role (Promote to Super Admin, HR, Manager, etc.)',
    description:
      'Modifies user role and synchronizes isSuperAdmin boolean status. Enforces protection to ensure at least one active Super Admin remains.',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ type: UpdateUserRoleDto })
  @ApiResponse({ status: 200, description: 'Role changed successfully' })
  @ApiResponse({ status: 400, description: 'Cannot demote the only remaining Super Admin' })
  @ApiResponse({ status: 404, description: 'User not found' })
  updateUserRole(
    @Param('id') id: string,
    @Body() body: UpdateUserRoleDto,
    @Req() req: any,
  ) {
    return this.superAdminService.updateUserRole(id, body, req.user);
  }

  @Put('users/:id/status')
  @ApiOperation({
    summary: 'Change user account status (Active, Suspended, Inactive)',
    description:
      'Enables super admins to suspend suspicious accounts or activate users. Prevents suspending the sole active Super Admin.',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ type: UpdateUserStatusDto })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 400, description: 'Cannot suspend the only Super Admin' })
  @ApiResponse({ status: 404, description: 'User not found' })
  updateUserStatus(
    @Param('id') id: string,
    @Body() body: UpdateUserStatusDto,
    @Req() req: any,
  ) {
    return this.superAdminService.updateUserStatus(id, body, req.user);
  }

  @Put('users/:id/reset-password')
  @ApiOperation({
    summary: 'Force reset user password',
    description: 'Super admin override to immediately set a new password for any user account.',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ type: ResetUserPasswordDto })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  resetUserPassword(
    @Param('id') id: string,
    @Body() body: ResetUserPasswordDto,
    @Req() req: any,
  ) {
    return this.superAdminService.resetUserPassword(id, body, req.user);
  }

  @Delete('users/all/clear')
  @ApiOperation({
    summary: 'Permanently delete all user entries (Super Admin, Admin, and User)',
    description: 'Bulk deletes all user entries from both memory, database.json, and MySQL.',
  })
  @ApiResponse({ status: 200, description: 'All user entries permanently deleted' })
  clearAllUsers(@Req() req: any) {
    return this.superAdminService.clearAllUsers(req.user);
  }

  @Delete('users/:id')
  @ApiOperation({
    summary: 'Permanently delete user account',
    description:
      'Deletes user record with safety checks (super admins cannot delete themselves or the last remaining super admin).',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User account deleted' })
  @ApiResponse({ status: 400, description: 'Cannot delete self or last super admin' })
  @ApiResponse({ status: 404, description: 'User not found' })
  deleteUser(@Param('id') id: string, @Req() req: any) {
    return this.superAdminService.deleteUser(id, req.user);
  }

  // -------------------------------------------------------------
  // 3. MASTER CROSS-MODULE ACCESS & OVERRIDES
  // -------------------------------------------------------------
  @Get('employees')
  @ApiOperation({
    summary: 'Master Employee Directory (Full Unredacted Dossier)',
    description:
      'Super Admin view of all employees across all branches, including sensitive compensation, bank information, and status.',
  })
  @ApiQuery({ name: 'departmentId', required: false, description: 'Filter by Department' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by Employment Status' })
  @ApiResponse({ status: 200, description: 'Complete employee dossier records' })
  getEmployeesMaster(
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: string,
  ) {
    return this.superAdminService.getAllEmployeesMaster(departmentId, status);
  }

  @Get('departments')
  @ApiOperation({
    summary: 'Master Departments & Designations Structure',
    description: 'Retrieves all departments with calculated headcounts and designations list.',
  })
  @ApiResponse({ status: 200, description: 'Full organizational hierarchy breakdown' })
  getDepartmentsMaster() {
    return this.superAdminService.getAllDepartmentsMaster();
  }

  @Get('leaves')
  @ApiOperation({
    summary: 'Master Leave Tracker across all departments',
    description: 'Super Admin view of all leaves applied, with employee names and department codes.',
  })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by Pending, Approved, Rejected' })
  @ApiResponse({ status: 200, description: 'Company-wide leave records' })
  getLeavesMaster(@Query('status') status?: string) {
    return this.superAdminService.getAllLeavesMaster(status);
  }

  @Post('leaves/:id/override')
  @ApiOperation({
    summary: 'Super Admin Direct Leave Override (Force Approve/Reject)',
    description:
      'Executive override: bypasses regular multi-tier approval chains to instantly Approve or Reject any employee leave application.',
  })
  @ApiParam({ name: 'id', description: 'Leave Request ID' })
  @ApiBody({ type: LeaveOverrideDto })
  @ApiResponse({ status: 200, description: 'Leave status overridden successfully' })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  overrideLeave(
    @Param('id') id: string,
    @Body() body: LeaveOverrideDto,
    @Req() req: any,
  ) {
    return this.superAdminService.overrideLeaveRequest(id, body, req.user);
  }

  @Get('payroll')
  @ApiOperation({
    summary: 'Master Enterprise Payroll Ledger',
    description: 'Company-wide view of payroll records, net payouts, tax deductions, and provident fund.',
  })
  @ApiQuery({ name: 'month', required: false, description: 'Filter by month (e.g., "October 2026")' })
  @ApiResponse({ status: 200, description: 'Complete payroll financials' })
  getPayrollMaster(@Query('month') month?: string) {
    return this.superAdminService.getAllPayrollMaster(month);
  }

  @Get('audit-logs')
  @ApiOperation({
    summary: 'Master Security Audit Trail Logs',
    description: 'Full unredacted audit trail of all actions, actors, IP addresses, and state changes.',
  })
  @ApiQuery({ name: 'module', required: false, description: 'Filter by module name' })
  @ApiQuery({ name: 'search', required: false, description: 'Search in action, user, or details' })
  @ApiResponse({ status: 200, description: 'Security audit trail records' })
  getAuditLogs(
    @Query('module') module?: string,
    @Query('search') search?: string,
  ) {
    return this.superAdminService.getAllAuditLogsMaster(module, search);
  }

  @Delete('audit-logs/prune')
  @ApiOperation({
    summary: 'Prune old audit logs for database compliance',
    description: 'Deletes audit log entries older than the specified retention window (default: 90 days).',
  })
  @ApiQuery({ name: 'retentionDays', required: false, example: 90, description: 'Days of logs to keep' })
  @ApiResponse({ status: 200, description: 'Audit pruning summary' })
  pruneAuditLogs(
    @Query('retentionDays') retentionDays?: number,
    @Req() req?: any,
  ) {
    return this.superAdminService.pruneAuditLogs(
      retentionDays ? Number(retentionDays) : 90,
      req?.user,
    );
  }

  // -------------------------------------------------------------
  // 4. ENTERPRISE SYSTEM CONFIGURATION & MAINTENANCE
  // -------------------------------------------------------------
  @Get('settings')
  @ApiOperation({
    summary: 'Get Enterprise Master Settings',
    description: 'Retrieves global enterprise config, time zones, maintenance flags, and active modules.',
  })
  @ApiResponse({ status: 200, description: 'Enterprise configuration' })
  getSettings() {
    return this.superAdminService.getSystemSettings();
  }

  @Put('settings')
  @ApiOperation({
    summary: 'Update Enterprise Master Settings',
    description: 'Updates company name, support emails, session timeouts, and security policies.',
  })
  @ApiBody({ type: UpdateSystemSettingsDto })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  updateSettings(@Body() body: UpdateSystemSettingsDto, @Req() req: any) {
    return this.superAdminService.updateSystemSettings(body, req.user);
  }

  @Post('maintenance')
  @ApiOperation({
    summary: 'Toggle System Maintenance Mode',
    description: 'Enables or disables system maintenance mode across the enterprise.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        enable: { type: 'boolean', example: true },
      },
      required: ['enable'],
    },
  })
  @ApiResponse({ status: 200, description: 'Maintenance status updated' })
  toggleMaintenance(@Body('enable') enable: boolean, @Req() req: any) {
    return this.superAdminService.toggleMaintenanceMode(Boolean(enable), req.user);
  }

  @Post('backup')
  @ApiOperation({
    summary: 'Trigger Full Database Snapshot Backup',
    description:
      'Creates a complete timestamped JSON snapshot of all 22 database collections in data/backups/ directory.',
  })
  @ApiResponse({ status: 201, description: 'Database backup snapshot generated successfully' })
  createBackup(@Req() req: any) {
    return this.superAdminService.createDatabaseBackup(req.user);
  }
}
