import { Controller, Get, Post, Put, Body, Param, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { LeavesService } from './leaves.service.js';
import { ApplyLeaveDto } from './dto/apply-leave.dto.js';
import { ApproveLeaveDto } from './dto/approve-leave.dto.js';
import { RejectLeaveDto } from './dto/reject-leave.dto.js';
import { QueryLeaveDto } from './dto/query-leave.dto.js';

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

  @Get('balances/:employeeId')
  @ApiOperation({
    summary: 'Get employee leave balances',
    description: 'Retrieves annual balances for Casual, Sick, and Paid leave quotas.',
  })
  @ApiParam({ name: 'employeeId', description: 'Employee ID' })
  @ApiResponse({ status: 200, description: 'Leave balance metrics' })
  getBalances(@Param('employeeId') employeeId: string) {
    return this.leavesService.getBalances(employeeId);
  }

  @Post('apply')
  @ApiOperation({
    summary: 'Employee apply for leave',
    description: 'Submits a new leave application, validates dates, generates in-app notifications, and fires WebSocket events.',
  })
  @ApiBody({ type: ApplyLeaveDto })
  @ApiResponse({ status: 201, description: 'Leave application submitted successfully' })
  apply(@Body() body: ApplyLeaveDto) {
    return this.leavesService.apply(body);
  }

  @Put(':id/approve')
  @ApiOperation({
    summary: 'Approve leave request (updates balance)',
    description: 'Marks leave request as Approved, updates employee quota balance, and logs an audit entry.',
  })
  @ApiParam({ name: 'id', description: 'Leave Request ID' })
  @ApiBody({ type: ApproveLeaveDto })
  @ApiResponse({ status: 200, description: 'Leave request approved successfully' })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  approve(@Param('id') id: string, @Body() body: ApproveLeaveDto) {
    return this.leavesService.approve(id, body);
  }

  @Put(':id/reject')
  @ApiOperation({
    summary: 'Reject leave request',
    description: 'Marks leave request as Rejected with recorded reason.',
  })
  @ApiParam({ name: 'id', description: 'Leave Request ID' })
  @ApiBody({ type: RejectLeaveDto })
  @ApiResponse({ status: 200, description: 'Leave request rejected' })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  reject(@Param('id') id: string, @Body() body: RejectLeaveDto) {
    return this.leavesService.reject(id, body);
  }
}
