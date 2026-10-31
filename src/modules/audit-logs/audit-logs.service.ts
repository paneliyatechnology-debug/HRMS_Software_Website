import { Injectable, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { Role, User } from '../../common/types.js';

@Injectable()
export class AuditLogsService {
  constructor(private readonly db: DatabaseService) {}

  findAll(module?: string, actorUser?: User) {
    if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees are not authorized to view audit logs');
    }

    let list = this.db.auditLogs;

    if (actorUser && actorUser.role === Role.ADMIN && actorUser.companyId) {
      const companyUserIds = new Set(
        this.db.users.filter((u) => u.companyId === actorUser.companyId).map((u) => u.id),
      );
      list = list.filter((l) => {
        if (l.companyId) return l.companyId === actorUser.companyId;
        return companyUserIds.has(l.userId);
      });
    }

    if (module && module !== 'ALL') {
      list = list.filter((l) => l.module.toLowerCase() === module.toLowerCase());
    }
    return list;
  }
}
