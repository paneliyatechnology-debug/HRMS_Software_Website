import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PayrollService } from './payroll.service.js';

@ApiTags('Payroll')
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get()
  @ApiOperation({ summary: 'List payroll records' })
  findAll(
    @Query('month') month?: string,
    @Query('status') status?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.payrollService.findAll({ month, status, employeeId });
  }

  @Get('payslip/:id')
  @ApiOperation({ summary: 'Get formatted printable payslip by record ID' })
  getPayslip(@Param('id') id: string) {
    return this.payrollService.getPayslip(id);
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate monthly payroll run for all active employees' })
  generateBatch(@Body() body: { month: string; actorName?: string }) {
    return this.payrollService.generateBatch(body.month, body.actorName);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update payroll record status (Approved, Processed, Paid)' })
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: 'Draft' | 'Approved' | 'Processed' | 'Paid'; actorName?: string },
  ) {
    return this.payrollService.updateStatus(id, body.status, body.actorName);
  }
}
