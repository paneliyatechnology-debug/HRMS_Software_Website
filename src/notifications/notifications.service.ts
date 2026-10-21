import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class NotificationsService {
  constructor(private readonly db: DatabaseService) {}

  findAll() {
    return this.db.notifications;
  }

  markAsRead(id: string) {
    const notif = this.db.notifications.find((n) => n.id === id);
    if (!notif) throw new NotFoundException('Notification not found');
    notif.isRead = true;
    this.db.persist();
    return notif;
  }

  markAllAsRead() {
    this.db.notifications.forEach((n) => (n.isRead = true));
    this.db.persist();
    return { success: true };
  }
}
