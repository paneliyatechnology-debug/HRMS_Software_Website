import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service.js';

@ApiTags('Audit Logs')
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
  findAll(@Query('module') module?: string) {
    return this.auditService.findAll(module);
  }
}
