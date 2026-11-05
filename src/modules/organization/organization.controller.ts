import { Controller, Get, Post, Put, Delete, Body, Param, Req, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { OrganizationService } from './organization.service.js';
import { CreateDepartmentDto } from './dto/create-department.dto.js';
import { UpdateDepartmentDto } from './dto/update-department.dto.js';
import { CreateDesignationDto } from './dto/create-designation.dto.js';
import { UpdateDesignationDto } from './dto/update-designation.dto.js';
import { AddDesignationMemberDto } from './dto/add-designation-member.dto.js';
import { UpdateDesignationMemberDto } from './dto/update-designation-member.dto.js';
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

  @Delete('departments/:id')
  @ApiOperation({
    summary: 'Delete department',
    description: 'Removes department from authenticated company and live MySQL.',
  })
  @ApiParam({ name: 'id', description: 'Department ID' })
  @ApiResponse({ status: 200, description: 'Department deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  deleteDepartment(@Param('id') id: string, @Req() req: any) {
    return this.orgService.deleteDepartment(id, req.user);
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

  @Put('designations/:id')
  @ApiOperation({
    summary: 'Update designation',
    description: 'Updates job title, department association, or salary bounds in MySQL.',
  })
  @ApiParam({ name: 'id', description: 'Designation ID' })
  @ApiBody({ type: UpdateDesignationDto })
  @ApiResponse({ status: 200, description: 'Designation updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Designation not found' })
  updateDesignation(@Param('id') id: string, @Body() body: UpdateDesignationDto, @Req() req: any) {
    return this.orgService.updateDesignation(id, body, req.user);
  }

  @Delete('designations/:id')
  @ApiOperation({
    summary: 'Delete designation',
    description: 'Removes designation from authenticated company and live MySQL.',
  })
  @ApiParam({ name: 'id', description: 'Designation ID' })
  @ApiResponse({ status: 200, description: 'Designation deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Designation not found' })
  deleteDesignation(@Param('id') id: string, @Req() req: any) {
    return this.orgService.deleteDesignation(id, req.user);
  }

  // -------------------------------------------------------------
  // DESIGNATION MEMBERSHIP ENDPOINTS (List, Add, Edit, Delete)
  // -------------------------------------------------------------

  @Get('designations/:id/members')
  @ApiOperation({
    summary: 'List members under designation',
    description: 'Retrieves all employees assigned to this designation in authenticated company.',
  })
  @ApiParam({ name: 'id', description: 'Designation ID' })
  @ApiResponse({ status: 200, description: 'List of assigned members' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Designation not found' })
  getDesignationMembers(@Param('id') id: string, @Req() req: any) {
    return this.orgService.getDesignationMembers(id, req.user);
  }

  @Post('designations/:id/members')
  @ApiOperation({
    summary: 'Add / Assign member(s) to designation',
    description: 'Assigns employee (single userId or bulk userIds array) to this designation in live MySQL.',
  })
  @ApiParam({ name: 'id', description: 'Designation ID' })
  @ApiBody({ type: AddDesignationMemberDto })
  @ApiResponse({ status: 201, description: 'Members assigned successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Designation or Employee not found' })
  addDesignationMember(@Param('id') id: string, @Body() body: AddDesignationMemberDto, @Req() req: any) {
    return this.orgService.addDesignationMember(id, body, req.user);
  }

  @Put('designations/:id/members/:userId')
  @ApiOperation({
    summary: 'Edit / Reassign member designation details',
    description: 'Updates employee designation assignment, department, or employment status.',
  })
  @ApiParam({ name: 'id', description: 'Current Designation ID' })
  @ApiParam({ name: 'userId', description: 'Employee User ID' })
  @ApiBody({ type: UpdateDesignationMemberDto })
  @ApiResponse({ status: 200, description: 'Member details updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Designation or Employee not found' })
  updateDesignationMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() body: UpdateDesignationMemberDto,
    @Req() req: any,
  ) {
    return this.orgService.updateDesignationMember(id, userId, body, req.user);
  }

  @Delete('designations/:id/members/:userId')
  @ApiOperation({
    summary: 'Remove member from designation',
    description: 'Unassigns employee from this designation and saves changes immediately to live MySQL.',
  })
  @ApiParam({ name: 'id', description: 'Designation ID' })
  @ApiParam({ name: 'userId', description: 'Employee User ID to remove' })
  @ApiResponse({ status: 200, description: 'Member removed from designation successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Designation or Employee not found' })
  removeDesignationMember(@Param('id') id: string, @Param('userId') userId: string, @Req() req: any) {
    return this.orgService.removeDesignationMember(id, userId, req.user);
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
