import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service.js';

@ApiTags('Audit Logs')
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditService: AuditLogsService) {}

  @Get()
  @ApiOperation({ summary: 'List security and state change audit logs' })
  findAll(@Query('module') module?: string) {
    return this.auditService.findAll(module);
  }
}
