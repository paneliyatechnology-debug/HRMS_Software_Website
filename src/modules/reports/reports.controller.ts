import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service.js';

@ApiTags('Reports & Analytics')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard-stats')
  @ApiOperation({
    summary: 'Get unified executive dashboard statistics',
    description: 'Returns KPI metrics, attendance percentages, monthly revenue/expense overview, and department headcounts.',
  })
  @ApiResponse({ status: 200, description: 'Executive dashboard analytics overview' })
  getDashboardStats() {
    return this.reportsService.getDashboardStats();
  }

  @Get('export')
  @ApiOperation({
    summary: 'Get raw data for CSV/Excel/PDF export',
    description: 'Retrieves tabular dataset for bulk data export (employees, attendance, leaves, or payroll).',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['employees', 'attendance', 'leaves', 'payroll'],
    description: 'Dataset domain type to export',
  })
  @ApiResponse({ status: 200, description: 'Exportable JSON dataset' })
  getExportData(@Query('type') type: string) {
    return this.reportsService.getExportData(type || 'employees');
  }
}
