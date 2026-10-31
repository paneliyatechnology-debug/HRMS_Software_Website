import { Injectable, Optional, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { Announcement, Role, User } from '../../common/types.js';
import { EventsGateway } from '../events/events.gateway.js';
import { CreateAnnouncementDto } from './dto/create-announcement.dto.js';

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly db: DatabaseService,
    @Optional() private readonly eventsGateway?: EventsGateway,
  ) {}

  findAll(actorUser?: User, companyFilter?: string) {
    let list = [...this.db.announcements];

    if (actorUser) {
      if (actorUser.role === Role.ADMIN || actorUser.role === Role.EMPLOYEE) {
        list = list.filter(
          (a) => !a.companyId || (actorUser.companyId && a.companyId === actorUser.companyId),
        );
      } else if (actorUser.role === Role.SUPER_ADMIN && companyFilter) {
        list = list.filter(
          (a) =>
            !a.companyId ||
            a.companyId === companyFilter ||
            (a.companyCode && a.companyCode.toLowerCase() === companyFilter.toLowerCase()),
        );
      }
    }

    return list;
  }

  create(data: CreateAnnouncementDto, actorUser?: User) {
    if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees are not authorized to create announcements.');
    }

    let companyId: string | null = null;
    let companyCode: string | null = null;

    if (actorUser && actorUser.role === Role.ADMIN) {
      companyId = actorUser.companyId || null;
      companyCode = actorUser.companyCode || null;
    } else if (actorUser && actorUser.role === Role.SUPER_ADMIN) {
      if ((data as any).companyId) {
        const comp = this.db.companies.find(
          (c) => c.id === (data as any).companyId || c.companyCode === (data as any).companyId,
        );
        companyId = comp?.id || (data as any).companyId;
        companyCode = comp?.companyCode || null;
      }
    }

    const authorName =
      data.authorName ||
      (actorUser ? `${actorUser.firstName || ''} ${actorUser.lastName || ''}`.trim() : 'HR Director') ||
      'HR Director';

    const newAnc: Announcement = {
      id: `anc-${Date.now()}`,
      title: data.title || 'Company Notice',
      content: data.content || '',
      publishDate: new Date().toISOString().split('T')[0],
      targetAudience: data.targetAudience || 'All',
      priority: data.priority || 'Medium',
      authorName,
      companyId,
      companyCode,
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
