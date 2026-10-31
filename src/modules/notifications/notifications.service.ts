import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { Role, User } from '../../common/types.js';

@Injectable()
export class NotificationsService {
  constructor(private readonly db: DatabaseService) {}

  findAll(actorUser?: User) {
    let list = this.db.notifications;

    if (actorUser && actorUser.role !== Role.SUPER_ADMIN && actorUser.companyId) {
      list = list.filter((n) => {
        if (!n.companyId) return true; // Global notification
        return n.companyId === actorUser.companyId;
      });
    }

    return list;
  }

  markAsRead(id: string, actorUser?: User) {
    const notif = this.db.notifications.find((n) => n.id === id);
    if (!notif) throw new NotFoundException('Notification not found');

    if (
      actorUser &&
      actorUser.role !== Role.SUPER_ADMIN &&
      actorUser.companyId &&
      notif.companyId &&
      notif.companyId !== actorUser.companyId
    ) {
      throw new ForbiddenException('Cannot modify notification of another company');
    }

    notif.isRead = true;
    this.db.persist();
    return notif;
  }

  markAllAsRead(actorUser?: User) {
    this.db.notifications.forEach((n) => {
      if (
        !actorUser ||
        actorUser.role === Role.SUPER_ADMIN ||
        !n.companyId ||
        n.companyId === actorUser.companyId
      ) {
        n.isRead = true;
      }
    });
    this.db.persist();
    return { success: true };
  }
}
