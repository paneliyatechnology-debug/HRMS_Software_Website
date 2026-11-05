import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LeavesService } from './leaves.service.js';
import { ApplyLeaveDto } from './dto/apply-leave.dto.js';
import { ApproveLeaveDto } from './dto/approve-leave.dto.js';
import { RejectLeaveDto } from './dto/reject-leave.dto.js';
import { QueryLeaveDto } from './dto/query-leave.dto.js';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto.js';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto.js';

@ApiTags('Leaves')
@ApiBearerAuth()
@Controller('leaves')
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  @Get()
  @ApiOperation({
    summary: 'List all leave applications with status filter',
    description: 'Retrieves all leave requests filtered optionally by employee or approval status.',
  })
  @ApiResponse({ status: 200, description: 'Filtered list of leave applications' })
  findAll(@Query() query: QueryLeaveDto, @Req() req: any) {
    return this.leavesService.findAll(query, req.user);
  }

  @Get('balances/:userId')
  @ApiOperation({
    summary: 'Get employee leave balances',
    description: 'Retrieves annual balances for Casual, Sick, and Paid leave quotas.',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Leave balance metrics' })
  getBalances(@Param('userId') userId: string) {
    return this.leavesService.getBalances(userId);
  }

  @Post('apply')
  @ApiOperation({
    summary: 'Employee apply for leave',
    description: 'Submits a new leave application, validates dates, generates in-app notifications, and fires WebSocket events.',
  })
  @ApiBody({ type: ApplyLeaveDto })
  @ApiResponse({ status: 201, description: 'Leave application submitted successfully' })
  apply(@Body() body: ApplyLeaveDto, @Req() req: any) {
    return this.leavesService.apply(body, req?.user);
  }

  @Put(':id/approve')
  @ApiOperation({
    summary: 'Approve leave request (updates balance)',
    description: 'Marks leave request as Approved, updates employee quota balance, and logs an audit entry.',
  })
  @ApiParam({ name: 'id', description: 'Leave Request ID' })
  @ApiBody({ type: ApproveLeaveDto })
  @ApiResponse({ status: 200, description: 'Leave request approved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  approve(@Param('id') id: string, @Body() body: ApproveLeaveDto, @Req() req: any) {
    return this.leavesService.approve(id, body, req?.user);
  }

  @Put(':id/reject')
  @ApiOperation({
    summary: 'Reject leave request',
    description: 'Marks leave request as Rejected with recorded reason.',
  })
  @ApiParam({ name: 'id', description: 'Leave Request ID' })
  @ApiBody({ type: RejectLeaveDto })
  @ApiResponse({ status: 200, description: 'Leave request rejected' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  reject(@Param('id') id: string, @Body() body: RejectLeaveDto, @Req() req: any) {
    return this.leavesService.reject(id, body, req?.user);
  }

  // ===================== LEAVE TYPES ENDPOINTS (ALIAS) =====================

  @Get('types')
  @ApiOperation({ summary: 'List all leave types' })
  @ApiQuery({ name: 'companyId', required: false })
  getLeaveTypes(@Req() req: any, @Query('companyId') companyFilter?: string) {
    return this.leavesService.getLeaveTypes(req.user, companyFilter);
  }

  @Get('types/:id')
  @ApiOperation({ summary: 'Get leave type by ID' })
  @ApiParam({ name: 'id', description: 'Leave Type ID' })
  getLeaveTypeById(@Param('id') id: string, @Req() req: any) {
    return this.leavesService.getLeaveTypeById(id, req.user);
  }

  @Post('types')
  @ApiOperation({ summary: 'Create new leave type' })
  @ApiBody({ type: CreateLeaveTypeDto })
  createLeaveType(@Body() body: CreateLeaveTypeDto, @Req() req: any) {
    return this.leavesService.createLeaveType(body, req.user);
  }

  @Put('types/:id')
  @ApiOperation({ summary: 'Update leave type' })
  @ApiParam({ name: 'id', description: 'Leave Type ID' })
  @ApiBody({ type: UpdateLeaveTypeDto })
  updateLeaveType(@Param('id') id: string, @Body() body: UpdateLeaveTypeDto, @Req() req: any) {
    return this.leavesService.updateLeaveType(id, body, req.user);
  }

  @Delete('types/:id')
  @ApiOperation({ summary: 'Delete leave type' })
  @ApiParam({ name: 'id', description: 'Leave Type ID' })
  deleteLeaveType(@Param('id') id: string, @Req() req: any) {
    return this.leavesService.deleteLeaveType(id, req.user);
  }
}
