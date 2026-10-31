import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { DatabaseService } from '../../database/database.service.js';
import { Role } from '../../common/types.js';
import { CreateCompanyDto } from '../super-admin/dto/create-company.dto.js';
import { UpdateCompanyDto } from '../super-admin/dto/update-company.dto.js';
import { RegisterCompanyRequestDto } from './dto/register-company-request.dto.js';
import { SuperAdminService } from '../super-admin/super-admin.service.js';
import { Public } from '../../common/guards/public.decorator.js';

@ApiTags('Companies')
@ApiBearerAuth()
@Controller('companies')
export class CompaniesController {
  constructor(
    private readonly db: DatabaseService,
    private readonly superAdminService: SuperAdminService,
  ) {}

  @Public()
  @Post()
  @ApiOperation({
    summary: 'Register a new company (Public - No Token Required)',
    description: 'Submits company registration request. Created once Super Admin approves.',
  })
  @ApiBody({ type: RegisterCompanyRequestDto })
  @ApiResponse({ status: 201, description: 'Company registration request submitted successfully' })
  createCompany(@Body() dto: any) {
    if (dto.firstName || dto.officialEmail || dto.companyLegalName || dto.password) {
      return this.superAdminService.createCompanyRegistrationRequest(dto);
    }
    return this.superAdminService.createCompany(dto);
  }

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Register a new company (Public - No Token Required, Awaiting Super Admin Approval)',
    description: 'Submits company information and owner account details. Company is created once Super Admin approves.',
  })
  @ApiBody({ type: RegisterCompanyRequestDto })
  @ApiResponse({ status: 201, description: 'Company registration request submitted successfully (Pending Approval)' })
  registerCompany(@Body() dto: RegisterCompanyRequestDto) {
    return this.superAdminService.createCompanyRegistrationRequest(dto);
  }

  @Public()
  @Post('registration-request')
  @ApiOperation({
    summary: 'Submit company registration request for Super Admin approval',
    description: 'Submits company information and owner account details. Company is created once Super Admin approves.',
  })
  @ApiBody({ type: RegisterCompanyRequestDto })
  @ApiResponse({ status: 201, description: 'Company registration request submitted successfully (Pending Approval)' })
  submitCompanyRequest(@Body() dto: RegisterCompanyRequestDto) {
    return this.superAdminService.createCompanyRegistrationRequest(dto);
  }

  @Get('my-company')
  @ApiOperation({
    summary: 'Get assigned company profile for current logged-in user',
    description: 'Retrieves current company information for the authenticated user.',
  })
  @ApiResponse({ status: 200, description: 'User assigned company' })
  getMyCompany(@Req() req: any) {
    const user = req.user;
    if (!user) {
      throw new ForbiddenException('User is not authenticated.');
    }

    if (user.role === Role.SUPER_ADMIN) {
      return this.db.companies[0] || null;
    }

    if (!user.companyId) {
      throw new NotFoundException('No company associated with this user account.');
    }

    const company = this.db.companies.find((c) => c.id === user.companyId);
    if (!company) {
      throw new NotFoundException(`Associated company "${user.companyId}" not found.`);
    }

    return company;
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get company profile by ID',
    description: 'Admin can only view their own company. SuperAdmin can view any company.',
  })
  @ApiParam({ name: 'id', description: 'Company ID or Company Code' })
  @ApiResponse({ status: 200, description: 'Company details' })
  getCompanyById(@Param('id') id: string, @Req() req: any) {
    const user = req.user;
    const company = this.db.companies.find(
      (c) =>
        c.id.toLowerCase() === id.toLowerCase() ||
        c.companyCode.toLowerCase() === id.toLowerCase(),
    );

    if (!company) {
      throw new NotFoundException(`Company "${id}" not found.`);
    }

    if (user.role === Role.ADMIN) {
      if (user.companyId && company.id !== user.companyId) {
        throw new ForbiddenException('Access denied: You can only view your own company profile.');
      }
    }

    return company;
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update own company details [ADMIN or SUPER_ADMIN]',
    description: 'Admin can update their own company contact info. Admin cannot modify another company.',
  })
  @ApiParam({ name: 'id', description: 'Company ID or Company Code' })
  @ApiBody({ type: UpdateCompanyDto })
  @ApiResponse({ status: 200, description: 'Company updated successfully' })
  async updateCompany(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
    @Req() req: any,
  ) {
    const user = req.user;
    if (user.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees cannot update company profiles.');
    }

    const company = this.db.companies.find(
      (c) =>
        c.id.toLowerCase() === id.toLowerCase() ||
        c.companyCode.toLowerCase() === id.toLowerCase(),
    );

    if (!company) {
      throw new NotFoundException(`Company "${id}" not found.`);
    }

    if (user.role === Role.ADMIN) {
      if (user.companyId && company.id !== user.companyId) {
        throw new ForbiddenException('Access denied: You cannot modify another company.');
      }
      // Admin cannot change status or adminUserId
      if (dto.status && dto.status !== company.status) {
        throw new ForbiddenException('Admin cannot change company active/inactive status.');
      }
      if (dto.adminUserId && dto.adminUserId !== company.adminUserId) {
        throw new ForbiddenException('Admin cannot reassign company administrator.');
      }
    }

    await this.db.assertCompanyUnique(
      {
        companyName: dto.companyName || dto.name,
        email: dto.email,
        phone: dto.phone,
      },
      company.id,
    );

    if (dto.companyName) {
      company.companyName = dto.companyName;
      company.name = dto.companyName;
    }
    if (dto.name) {
      company.name = dto.name;
      company.companyName = dto.name;
    }
    if (dto.email !== undefined) company.email = dto.email;
    if (dto.phone !== undefined) company.phone = dto.phone;
    if (dto.address !== undefined) company.address = dto.address;
    if (user.role === Role.SUPER_ADMIN) {
      if (dto.status !== undefined) company.status = dto.status;
      if (dto.adminUserId !== undefined) company.adminUserId = dto.adminUserId;
    }
    company.updatedAt = new Date().toISOString();

    this.db.logAudit(
      user.id,
      `${user.firstName} ${user.lastName}`,
      user.role,
      'COMPANY_PROFILE_UPDATED',
      'Companies',
      `Updated company profile for ${company.companyCode}`,
      company.id,
    );

    this.db.persist();
    return company;
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete company and cascade delete all associated users, employees, and data',
    description: 'Permanently deletes company and cascades deletion across all tables in MySQL and runtime memory.',
  })
  @ApiParam({ name: 'id', description: 'Company ID or Company Code' })
  @ApiResponse({ status: 200, description: 'Company and all associated data permanently deleted' })
  deleteCompany(@Param('id') id: string, @Req() req: any) {
    const user = req.user;
    if (user.role !== Role.SUPER_ADMIN && !user.isSuperAdmin) {
      throw new ForbiddenException('Only Super Admin can delete a company.');
    }
    return this.superAdminService.deleteCompany(id, user);
  }
}
