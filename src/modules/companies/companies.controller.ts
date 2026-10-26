import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Req,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { DatabaseService } from '../../database/database.service.js';
import { Role } from '../../common/types.js';
import { UpdateCompanyDto } from '../super-admin/dto/update-company.dto.js';

@ApiTags('Companies')
@ApiBearerAuth()
@Controller('companies')
export class CompaniesController {
  constructor(private readonly db: DatabaseService) {}

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
  updateCompany(
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
}
