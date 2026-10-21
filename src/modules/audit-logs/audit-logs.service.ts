import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';

@Injectable()
export class AuditLogsService {
  constructor(private readonly db: DatabaseService) {}

  findAll(module?: string) {
    if (module && module !== 'ALL') {
      return this.db.auditLogs.filter((l) => l.module.toLowerCase() === module.toLowerCase());
    }
    return this.db.auditLogs;
  }
}
