import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { AuditLogsService } from './audit-logs.service.js';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditService: AuditLogsService) {}

  @Get()
  @ApiOperation({
    summary: 'List security and state change audit logs',
    description: 'Retrieves immutable audit trail of actions, timestamps, and actors across modules.',
  })
  @ApiQuery({ name: 'module', required: false, description: 'Filter by subsystem module name' })
  @ApiResponse({ status: 200, description: 'List of audit log records' })
  findAll(@Query('module') module?: string, @Req() req?: any) {
    return this.auditService.findAll(module, req?.user);
  }
}
