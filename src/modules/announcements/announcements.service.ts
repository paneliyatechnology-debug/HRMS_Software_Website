import { Injectable, Optional } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { Announcement, User, isSuperAdminUser } from '../../common/types.js';
import { EventsGateway } from '../events/events.gateway.js';
import { CreateAnnouncementDto } from './dto/create-announcement.dto.js';

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly db: DatabaseService,
    @Optional() private readonly eventsGateway?: EventsGateway,
  ) {}

  findAll(actor?: User) {
    if (!actor || isSuperAdminUser(actor)) {
      return this.db.announcements;
    }
    if (!actor.companyId) return [];
    return this.db.announcements.filter((item) => item.companyId === actor.companyId);
  }

  create(data: CreateAnnouncementDto, actor?: User) {
    const authorName = data.authorName || 'HR Director';
    const newAnc: Announcement = {
      id: `anc-${Date.now()}`,
      title: data.title || 'Company Notice',
      content: data.content || '',
      publishDate: new Date().toISOString().split('T')[0],
      targetAudience: data.targetAudience || 'All',
      priority: data.priority || 'Medium',
      authorName: authorName,
      companyId: actor?.companyId || undefined,
    };

    this.db.announcements.unshift(newAnc);
    this.db.persist();

    if (this.eventsGateway) {
      this.eventsGateway.emitAnnouncement({
        title: newAnc.title,
        content: newAnc.content,
      });
    }

    return newAnc;
  }
}
