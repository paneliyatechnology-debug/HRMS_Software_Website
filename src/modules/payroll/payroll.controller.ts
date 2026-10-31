import { Controller, Get, Post, Put, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PayrollService } from './payroll.service.js';
import { GeneratePayrollDto } from './dto/generate-payroll.dto.js';
import { UpdatePayrollStatusDto } from './dto/update-payroll-status.dto.js';
import { QueryPayrollDto } from './dto/query-payroll.dto.js';

@ApiTags('Payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get()
  @ApiOperation({
    summary: 'List payroll records',
    description: 'Retrieves monthly payroll disbursement records filtered by month, status, or employee ID.',
  })
  @ApiResponse({ status: 200, description: 'List of payroll records' })
  findAll(@Query() query: QueryPayrollDto, @Req() req: any) {
    return this.payrollService.findAll(query, req.user);
  }

  @Get('payslip/:id')
  @ApiOperation({
    summary: 'Get formatted printable payslip by record ID',
    description: 'Returns structured company letterhead, employee info, detailed earnings, deductions, and net pay breakdown.',
  })
  @ApiParam({ name: 'id', description: 'Payroll Record ID' })
  @ApiResponse({ status: 200, description: 'Formatted payslip details' })
  @ApiResponse({ status: 404, description: 'Payslip record not found' })
  getPayslip(@Param('id') id: string, @Req() req: any) {
    return this.payrollService.getPayslip(id, req.user);
  }

  @Post('generate')
  @ApiOperation({
    summary: 'Generate monthly payroll run for all active employees',
    description: 'Executes automated batch calculation of gross pay, statutory PF, TDS, professional tax, and net disbursements.',
  })
  @ApiBody({ type: GeneratePayrollDto })
  @ApiResponse({ status: 201, description: 'Batch payroll generated successfully' })
  generateBatch(@Body() body: GeneratePayrollDto, @Req() req: any) {
    return this.payrollService.generateBatch(body, req.user);
  }

  @Put(':id/status')
  @ApiOperation({
    summary: 'Update payroll record status (Approved, Processed, Paid)',
    description: 'Progresses salary voucher through finance approval workflow.',
  })
  @ApiParam({ name: 'id', description: 'Payroll Record ID' })
  @ApiBody({ type: UpdatePayrollStatusDto })
  @ApiResponse({ status: 200, description: 'Payroll record status updated' })
  @ApiResponse({ status: 404, description: 'Payroll record not found' })
  updateStatus(@Param('id') id: string, @Body() body: UpdatePayrollStatusDto, @Req() req: any) {
    return this.payrollService.updateStatus(id, body, req.user);
  }
}
