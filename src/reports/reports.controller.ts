import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ReportsService } from './reports.service.js';

@ApiTags('Reports & Analytics')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard-stats')
  @ApiOperation({ summary: 'Get unified executive dashboard statistics' })
  getDashboardStats() {
    return this.reportsService.getDashboardStats();
  }

  @Get('export')
  @ApiOperation({ summary: 'Get raw data for CSV/Excel/PDF export' })
  getExportData(@Query('type') type: string) {
    return this.reportsService.getExportData(type || 'employees');
  }
}
