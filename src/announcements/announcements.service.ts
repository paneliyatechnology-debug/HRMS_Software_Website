import { Injectable, Optional } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { Announcement } from '../common/types.js';
import { EventsGateway } from '../events/events.gateway.js';

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly db: DatabaseService,
    @Optional() private readonly eventsGateway?: EventsGateway,
  ) {}

  findAll() {
    return this.db.announcements;
  }

  create(data: Partial<Announcement>, authorName = 'HR Director') {
    const newAnc: Announcement = {
      id: `anc-${Date.now()}`,
      title: data.title || 'Company Notice',
      content: data.content || '',
      publishDate: new Date().toISOString().split('T')[0],
      targetAudience: data.targetAudience || 'All',
      priority: data.priority || 'Medium',
      authorName: authorName,
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
