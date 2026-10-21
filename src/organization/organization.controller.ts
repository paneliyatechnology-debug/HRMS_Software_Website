import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { OrganizationService } from './organization.service.js';
import { Department, Designation } from '../common/types.js';

@ApiTags('Organization')
@Controller('organization')
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  @Get('departments')
  @ApiOperation({ summary: 'List all departments with active employee count' })
  getDepartments() {
    return this.orgService.getDepartments();
  }

  @Post('departments')
  @ApiOperation({ summary: 'Create department' })
  createDepartment(@Body() body: Partial<Department>) {
    return this.orgService.createDepartment(body);
  }

  @Put('departments/:id')
  @ApiOperation({ summary: 'Update department' })
  updateDepartment(@Param('id') id: string, @Body() body: Partial<Department>) {
    return this.orgService.updateDepartment(id, body);
  }

  @Get('designations')
  @ApiOperation({ summary: 'List all designations' })
  getDesignations() {
    return this.orgService.getDesignations();
  }

  @Post('designations')
  @ApiOperation({ summary: 'Create designation' })
  createDesignation(@Body() body: Partial<Designation>) {
    return this.orgService.createDesignation(body);
  }

  @Get('locations')
  @ApiOperation({ summary: 'List company locations' })
  getLocations() {
    return this.orgService.getLocations();
  }

  @Get('hierarchy')
  @ApiOperation({ summary: 'Get visual organization hierarchy tree' })
  getHierarchy() {
    return this.orgService.getHierarchy();
  }
}
