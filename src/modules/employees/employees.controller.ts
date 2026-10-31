import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  Req,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiHeader,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { EmployeesService } from './employees.service.js';
import { EmployeeInvitationService } from './employee-invitation.service.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { QueryEmployeeDto } from './dto/query-employee.dto.js';
import { AuthService } from '../auth/auth.service.js';
import { DatabaseService } from '../../database/database.service.js';
import { Role } from '../../common/types.js';

@ApiTags('Employees')
@ApiBearerAuth()
@Controller('employees')
export class EmployeesController {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly invitationService: EmployeeInvitationService,
    private readonly authService: AuthService,
    private readonly db: DatabaseService,
  ) {}

  /** Resolve logged-in user from request or Authorization header */
  private resolveActor(req?: any, authHeader?: string) {
    if (req?.user) return req.user;
    if (!authHeader) return null;
    try {
      const userId = this.authService.extractUserId(authHeader);
      return (
        this.db.users.find(
          (u) =>
            u.id.toLowerCase() === userId.toLowerCase() ||
            u.email.toLowerCase() === userId.toLowerCase(),
        ) || null
      );
    } catch {
      return null;
    }
  }

  /**
   * Hierarchy Guard:
   *   SUPER_ADMIN  →  can manage any company's employees
   *   ADMIN        →  can manage their own company's employees
   *   EMPLOYEE     →  read-only
   */
  private requireAdminOrAbove(req?: any, authHeader?: string) {
    const actor = this.resolveActor(req, authHeader);

    if (!actor) {
      throw new UnauthorizedException(
        'Please login first. Pass your token in the Authorization header (e.g. Bearer jwt_token_xxx).',
      );
    }

    if (actor.status && actor.status.toLowerCase() === 'inactive') {
      throw new UnauthorizedException(
        `Your account is deactivated. Contact Super Admin to reactivate.`,
      );
    }

    if (actor.role !== Role.SUPER_ADMIN && actor.role !== Role.ADMIN) {
      throw new ForbiddenException(
        `Access denied. Your role is "${actor.role}". ` +
        `Only ADMIN or SUPER_ADMIN can create, update, or deactivate employees.`,
      );
    }

    return actor;
  }

  // ─────────────────────────────────────────────────────────────────
  // READ — open to authenticated users with company-scoped filtering
  // ─────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'List employees with search and company isolation',
    description:
      'Retrieves employees. For ADMIN, results are strictly isolated to their own company.',
  })
  @ApiResponse({ status: 200, description: 'Filtered list of employees' })
  findAll(@Query() query: QueryEmployeeDto, @Req() req: any, @Headers('authorization') auth?: string) {
    const actor = this.resolveActor(req, auth);
    return this.employeesService.findAll(query, actor);
  }

  @Get('next-code')
  @ApiOperation({
    summary: 'Get next auto-generated employee identity code (e.g. EMP-000001)',
    description:
      'Calculates the next sequential unique employee identity code for employee onboarding.',
  })
  @ApiResponse({ status: 200, description: 'Next available employee code' })
  getNextCode(@Req() req: any, @Headers('authorization') auth?: string, @Query('companyId') queryCompanyId?: string) {
    const actor = this.resolveActor(req, auth);
    const targetCompanyId = actor?.role === Role.ADMIN ? actor.companyId : (queryCompanyId || actor?.companyId);
    return this.employeesService.getNextCode(targetCompanyId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get employee details with 11 tab summaries',
    description:
      'Retrieves full profile, attendance, leaves, payroll, documents, assets, and performance records.',
  })
  @ApiParam({ name: 'id', description: 'Employee ID or Employee Code' })
  @ApiResponse({ status: 200, description: 'Complete employee dossier' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  findOne(@Param('id') id: string, @Req() req: any, @Headers('authorization') auth?: string) {
    const actor = this.resolveActor(req, auth);
    return this.employeesService.findOne(id, actor);
  }

  // ─────────────────────────────────────────────────────────────────
  // WRITE — ADMIN (own company) or SUPER_ADMIN (any company)
  // ─────────────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({
    summary: 'Create new employee [ADMIN / SUPER_ADMIN only]',
    description:
      '**Role Required: ADMIN or SUPER_ADMIN**\n\n' +
      'Admin creates an employee for their own company. SuperAdmin can specify target companyId.',
  })
  @ApiHeader({
    name: 'authorization',
    description: 'Bearer token from POST /api/auth/login',
    required: true,
  })
  @ApiBody({ type: CreateEmployeeDto })
  @ApiResponse({ status: 201, description: 'Employee created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — token missing or invalid' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN or SUPER_ADMIN role required' })
  create(
    @Body() body: CreateEmployeeDto,
    @Req() req: any,
    @Headers('authorization') auth?: string,
  ) {
    const actor = this.requireAdminOrAbove(req, auth);

    // If Admin, force companyId from their own server-side identity (never trust client request body)
    const companyIdOverride =
      actor.role === Role.ADMIN ? actor.companyId : (body.companyId || actor.companyId);

    return this.employeesService.create(
      body,
      `${actor.firstName} ${actor.lastName}`,
      companyIdOverride,
      actor,
    );
  }

  @Post(':id/resend-invitation')
  @ApiOperation({
    summary: 'Resend password setup invitation email [ADMIN / SUPER_ADMIN only]',
    description:
      '**Role Required: ADMIN or SUPER_ADMIN**\n\n' +
      'Admin resends password setup invitation email to an employee in their company. Revokes previous unused tokens.',
  })
  @ApiHeader({
    name: 'authorization',
    description: 'Bearer token from POST /api/auth/login',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Invitation email resent successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden — outside tenant company' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  resendInvitation(
    @Param('id') id: string,
    @Body('expiresInSeconds') expiresInSeconds?: number,
    @Req() req?: any,
    @Headers('authorization') auth?: string,
  ) {
    const actor = this.requireAdminOrAbove(req, auth);
    return this.invitationService.resendInvitation(id, actor, { expiresInSeconds });
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update employee record [ADMIN / SUPER_ADMIN only]',
    description:
      '**Role Required: ADMIN or SUPER_ADMIN**\n\n' +
      'Updates employee details. Admin can only update employees in their own company.',
  })
  @ApiHeader({
    name: 'authorization',
    description: 'Bearer token from POST /api/auth/login',
    required: true,
  })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiBody({ type: UpdateEmployeeDto })
  @ApiResponse({ status: 200, description: 'Employee updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — token missing or invalid' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN or SUPER_ADMIN role required' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  update(
    @Param('id') id: string,
    @Body() body: UpdateEmployeeDto,
    @Req() req: any,
    @Headers('authorization') auth?: string,
  ) {
    const actor = this.requireAdminOrAbove(req, auth);
    return this.employeesService.update(
      id,
      body,
      `${actor.firstName} ${actor.lastName}`,
      actor,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Deactivate employee (soft-delete) [ADMIN / SUPER_ADMIN only]',
    description:
      '**Role Required: ADMIN or SUPER_ADMIN**\n\n' +
      'Marks employee status as Inactive to preserve audit trails and attendance/payroll history.',
  })
  @ApiHeader({
    name: 'authorization',
    description: 'Bearer token from POST /api/auth/login',
    required: true,
  })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiResponse({ status: 200, description: 'Employee marked inactive' })
  @ApiResponse({ status: 401, description: 'Unauthorized — token missing or invalid' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN or SUPER_ADMIN role required' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  remove(
    @Param('id') id: string,
    @Req() req: any,
    @Headers('authorization') auth?: string,
  ) {
    const actor = this.requireAdminOrAbove(req, auth);
    return this.employeesService.remove(
      id,
      `${actor.firstName} ${actor.lastName}`,
      actor,
    );
  }
}
