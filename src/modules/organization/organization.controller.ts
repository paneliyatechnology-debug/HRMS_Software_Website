import { Controller, Get, Post, Put, Body, Param, Req, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { OrganizationService } from './organization.service.js';
import { CreateDepartmentDto } from './dto/create-department.dto.js';
import { UpdateDepartmentDto } from './dto/update-department.dto.js';
import { CreateDesignationDto } from './dto/create-designation.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';

@ApiTags('Organization')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('organization')
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  @Get('departments')
  @ApiOperation({
    summary: 'List all departments with active employee count',
    description: 'Retrieves all departments along with dynamic headcount aggregates for authenticated company.',
  })
  @ApiQuery({ name: 'companyId', required: false, description: 'Optional company filter for Super Admin' })
  @ApiResponse({ status: 200, description: 'List of departments' })
  getDepartments(@Req() req: any, @Query('companyId') companyFilter?: string) {
    return this.orgService.getDepartments(req.user, companyFilter);
  }

  @Post('departments')
  @ApiOperation({
    summary: 'Create department',
    description: 'Adds a new business division or department isolated to authenticated company.',
  })
  @ApiBody({ type: CreateDepartmentDto })
  @ApiResponse({ status: 201, description: 'Department created successfully' })
  createDepartment(@Body() body: CreateDepartmentDto, @Req() req: any) {
    return this.orgService.createDepartment(body, req.user);
  }

  @Put('departments/:id')
  @ApiOperation({
    summary: 'Update department',
    description: 'Updates department attributes, leadership, or description.',
  })
  @ApiParam({ name: 'id', description: 'Department ID' })
  @ApiBody({ type: UpdateDepartmentDto })
  @ApiResponse({ status: 200, description: 'Department updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  updateDepartment(@Param('id') id: string, @Body() body: UpdateDepartmentDto, @Req() req: any) {
    return this.orgService.updateDepartment(id, body, req.user);
  }

  @Get('designations')
  @ApiOperation({
    summary: 'List all designations',
    description: 'Retrieves all organizational roles and job levels for authenticated company.',
  })
  @ApiQuery({ name: 'companyId', required: false, description: 'Optional company filter for Super Admin' })
  @ApiResponse({ status: 200, description: 'List of designations' })
  getDesignations(@Req() req: any, @Query('companyId') companyFilter?: string) {
    return this.orgService.getDesignations(req.user, companyFilter);
  }

  @Post('designations')
  @ApiOperation({
    summary: 'Create designation',
    description: 'Adds a new job designation with salary pay-bands.',
  })
  @ApiBody({ type: CreateDesignationDto })
  @ApiResponse({ status: 201, description: 'Designation created successfully' })
  createDesignation(@Body() body: CreateDesignationDto, @Req() req: any) {
    return this.orgService.createDesignation(body, req.user);
  }

  @Get('locations')
  @ApiOperation({
    summary: 'List company locations',
    description: 'Lists all branch offices and headquarters locations.',
  })
  @ApiQuery({ name: 'companyId', required: false, description: 'Optional company filter for Super Admin' })
  @ApiResponse({ status: 200, description: 'List of locations' })
  getLocations(@Req() req: any, @Query('companyId') companyFilter?: string) {
    return this.orgService.getLocations(req.user, companyFilter);
  }

  @Get('hierarchy')
  @ApiOperation({
    summary: 'Get visual organization hierarchy tree',
    description: 'Returns recursive tree data for rendering the enterprise organizational chart for authenticated company.',
  })
  @ApiResponse({ status: 200, description: 'Organization chart hierarchy structure' })
  getHierarchy(@Req() req: any) {
    return this.orgService.getHierarchy(req.user);
  }
}
