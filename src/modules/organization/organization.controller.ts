import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { OrganizationService } from './organization.service.js';
import { CreateDepartmentDto } from './dto/create-department.dto.js';
import { UpdateDepartmentDto } from './dto/update-department.dto.js';
import { CreateDesignationDto } from './dto/create-designation.dto.js';

@ApiTags('Organization')
@Controller('organization')
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  @Get('departments')
  @ApiOperation({
    summary: 'List all departments with active employee count',
    description: 'Retrieves all departments along with dynamic headcount aggregates and department heads.',
  })
  @ApiResponse({ status: 200, description: 'List of departments' })
  getDepartments() {
    return this.orgService.getDepartments();
  }

  @Post('departments')
  @ApiOperation({
    summary: 'Create department',
    description: 'Adds a new business division or department.',
  })
  @ApiBody({ type: CreateDepartmentDto })
  @ApiResponse({ status: 201, description: 'Department created successfully' })
  createDepartment(@Body() body: CreateDepartmentDto) {
    return this.orgService.createDepartment(body);
  }

  @Put('departments/:id')
  @ApiOperation({
    summary: 'Update department',
    description: 'Updates department attributes, leadership, or description.',
  })
  @ApiParam({ name: 'id', description: 'Department ID' })
  @ApiBody({ type: UpdateDepartmentDto })
  @ApiResponse({ status: 200, description: 'Department updated successfully' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  updateDepartment(@Param('id') id: string, @Body() body: UpdateDepartmentDto) {
    return this.orgService.updateDepartment(id, body);
  }

  @Get('designations')
  @ApiOperation({
    summary: 'List all designations',
    description: 'Retrieves all organizational roles and job levels.',
  })
  @ApiResponse({ status: 200, description: 'List of designations' })
  getDesignations() {
    return this.orgService.getDesignations();
  }

  @Post('designations')
  @ApiOperation({
    summary: 'Create designation',
    description: 'Adds a new job designation with salary pay-bands.',
  })
  @ApiBody({ type: CreateDesignationDto })
  @ApiResponse({ status: 201, description: 'Designation created successfully' })
  createDesignation(@Body() body: CreateDesignationDto) {
    return this.orgService.createDesignation(body);
  }

  @Get('locations')
  @ApiOperation({
    summary: 'List company locations',
    description: 'Lists all branch offices and headquarters locations.',
  })
  @ApiResponse({ status: 200, description: 'List of locations' })
  getLocations() {
    return this.orgService.getLocations();
  }

  @Get('hierarchy')
  @ApiOperation({
    summary: 'Get visual organization hierarchy tree',
    description: 'Returns recursive tree data for rendering the enterprise organizational chart.',
  })
  @ApiResponse({ status: 200, description: 'Organization chart hierarchy structure' })
  getHierarchy() {
    return this.orgService.getHierarchy();
  }
}
