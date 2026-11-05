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
  BadRequestException,
  UseInterceptors,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiHeader,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { EmployeesService } from './employees.service.js';
import { EmployeeInvitationService } from './employee-invitation.service.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { QueryEmployeeDto } from './dto/query-employee.dto.js';
import { AuthService } from '../auth/auth.service.js';
import { DatabaseService } from '../../database/database.service.js';
import { Role } from '../../common/types.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { DocumentsService } from '../documents/documents.service.js';

@ApiTags('Employees')
@ApiBearerAuth()
@Controller('employees')
export class EmployeesController {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly invitationService: EmployeeInvitationService,
    private readonly authService: AuthService,
    private readonly db: DatabaseService,
    private readonly documentsService: DocumentsService,
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

  @Post('documents/upload')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Dedicated Employee Document Upload',
    description:
      'Allows an authenticated employee to upload their personal document directly using JWT Bearer token.\n' +
      'Requires EMPLOYEE role. Identity and company are extracted strictly from verified JWT.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'title', 'category'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'Document file (PDF, Word, or image)' },
        title: { type: 'string', description: 'Document title' },
        category: { type: 'string', description: 'Document category' },
        expiryDate: { type: 'string', format: 'date', description: 'Optional expiry date (YYYY-MM-DD)' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Document uploaded and registered successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields or invalid file format' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid Bearer token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only EMPLOYEE role is permitted' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadDir = path.join(process.cwd(), 'uploads', 'documents');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = path.extname(file.originalname);
          const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
          cb(null, `doc-${cleanBase}-${uniqueSuffix}${ext}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(pdf|doc|docx|png|jpg|jpeg|txt)$/i)) {
          return cb(
            new BadRequestException('Only PDF, Word documents, and images are supported'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadEmployeeDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: {
      title?: string;
      category?: string;
      expiryDate?: string;
    },
    @Req() req: any,
  ) {
    // 1. Enforce Authorization: Bearer <accessToken>
    const authHeader = req.headers?.authorization;
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('Authorization header with Bearer token is required.');
    }

    // 2. Resolve authenticated user from JwtAuthGuard
    const actorUser = req.user;
    if (!actorUser) {
      throw new UnauthorizedException('Authentication token is required.');
    }

    // 3. Enforce EMPLOYEE role only (ADMIN or others receive 403 Forbidden)
    if (actorUser.role !== Role.EMPLOYEE) {
      throw new ForbiddenException('Only employees are allowed to use this employee document upload endpoint.');
    }

    // 4. Validate file
    if (!file) {
      throw new BadRequestException('Document file is required.');
    }

    // 5. Validate required fields
    if (!body.title || !body.title.trim()) {
      throw new BadRequestException('Document title is required.');
    }
    if (!body.category || !body.category.trim()) {
      throw new BadRequestException('Document category is required.');
    }

    const fileSizeFormatted =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

    const dynamicBaseUrl = `${req.protocol}://${req.get('host')}`;

    // 6. Save via documentsService.create (automatically bounds to actorUser)
    return this.documentsService.create(
      {
        title: body.title.trim(),
        category: body.category.trim() as any,
        fileUrl: `${dynamicBaseUrl}/uploads/documents/${file.filename}`,
        fileSize: fileSizeFormatted,
        expiryDate: body.expiryDate,
      },
      actorUser,
    );
  }
}
