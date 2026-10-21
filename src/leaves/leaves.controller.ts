import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LeavesService } from './leaves.service.js';
import { LeaveType } from '../common/types.js';

@ApiTags('Leaves')
@Controller('leaves')
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  @Get()
  @ApiOperation({ summary: 'List all leave applications with status filter' })
  findAll(@Query('employeeId') employeeId?: string, @Query('status') status?: string) {
    return this.leavesService.findAll({ employeeId, status });
  }

  @Get('balances/:employeeId')
  @ApiOperation({ summary: 'Get employee leave balances' })
  getBalances(@Param('employeeId') employeeId: string) {
    return this.leavesService.getBalances(employeeId);
  }

  @Post('apply')
  @ApiOperation({ summary: 'Employee apply for leave' })
  apply(
    @Body()
    body: {
      employeeId: string;
      leaveType: LeaveType;
      startDate: string;
      endDate: string;
      isHalfDay?: boolean;
      reason: string;
    },
  ) {
    return this.leavesService.apply(body);
  }

  @Put(':id/approve')
  @ApiOperation({ summary: 'Approve leave request (updates balance)' })
  approve(
    @Param('id') id: string,
    @Body() body: { role?: string; approverName?: string; comments?: string },
  ) {
    return this.leavesService.approve(
      id,
      body.role || 'HR_ADMIN',
      body.approverName || 'Approver',
      body.comments
    );
  }

  @Put(':id/reject')
  @ApiOperation({ summary: 'Reject leave request' })
  reject(
    @Param('id') id: string,
    @Body() body: { approverName?: string; reason?: string },
  ) {
    return this.leavesService.reject(id, body.approverName, body.reason);
  }
}
