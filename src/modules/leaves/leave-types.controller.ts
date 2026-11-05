import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LeavesService } from './leaves.service.js';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto.js';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';

@ApiTags('Leave Types')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('leave-types')
export class LeaveTypesController {
  constructor(private readonly leavesService: LeavesService) {}

  @Get()
  @ApiOperation({
    summary: 'List all leave types',
    description: 'Retrieves all active leave categories/types for the authenticated company.',
  })
  @ApiQuery({ name: 'companyId', required: false, description: 'Optional company filter for Super Admin' })
  @ApiResponse({ status: 200, description: 'List of leave types' })
  findAll(@Req() req: any, @Query('companyId') companyFilter?: string) {
    return this.leavesService.getLeaveTypes(req.user, companyFilter);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get leave type by ID',
    description: 'Retrieves single leave type configuration.',
  })
  @ApiParam({ name: 'id', description: 'Leave Type ID' })
  @ApiResponse({ status: 200, description: 'Leave type details' })
  @ApiResponse({ status: 404, description: 'Leave type not found' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.leavesService.getLeaveTypeById(id, req.user);
  }

  @Post()
  @ApiOperation({
    summary: 'Create new leave type',
    description: 'Creates a custom leave type (e.g. Paid Leave, Bereavement Leave) isolated to the company.',
  })
  @ApiBody({ type: CreateLeaveTypeDto })
  @ApiResponse({ status: 201, description: 'Leave type created successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request / Validation Error' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN or SUPER_ADMIN required' })
  @ApiResponse({ status: 409, description: 'Conflict: Leave type already exists' })
  create(@Body() body: CreateLeaveTypeDto, @Req() req: any) {
    return this.leavesService.createLeaveType(body, req.user);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update leave type',
    description: 'Updates leave type quota, policy, name, or status.',
  })
  @ApiParam({ name: 'id', description: 'Leave Type ID' })
  @ApiBody({ type: UpdateLeaveTypeDto })
  @ApiResponse({ status: 200, description: 'Leave type updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Leave type not found' })
  update(@Param('id') id: string, @Body() body: UpdateLeaveTypeDto, @Req() req: any) {
    return this.leavesService.updateLeaveType(id, body, req.user);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete leave type',
    description: 'Removes a leave type from the company.',
  })
  @ApiParam({ name: 'id', description: 'Leave Type ID' })
  @ApiResponse({ status: 200, description: 'Leave type deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Leave type not found' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.leavesService.deleteLeaveType(id, req.user);
  }
}

