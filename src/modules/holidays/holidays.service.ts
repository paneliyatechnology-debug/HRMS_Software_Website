import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { Holiday, Role, User } from '../../common/types.js';
import { CreateHolidayDto } from './dto/create-holiday.dto.js';

@Injectable()
export class HolidaysService {
  constructor(private readonly db: DatabaseService) {}

  findAll(actorUser?: User, companyFilter?: string) {
    let list = [...this.db.holidays];

    if (actorUser) {
      if (actorUser.role === Role.ADMIN || actorUser.role === Role.EMPLOYEE) {
        // Company isolation: Company 1 sees only Company 1 holidays (+ public holidays).
        // Never expose another company's holidays.
        list = list.filter(
          (h) => h.type === 'Public' || (h.companyId && h.companyId === actorUser.companyId),
        );
      } else if (actorUser.role === Role.SUPER_ADMIN && companyFilter) {
        list = list.filter(
          (h) =>
            h.type === 'Public' ||
            h.companyId === companyFilter ||
            (h.companyCode && h.companyCode.toLowerCase() === companyFilter.toLowerCase()),
        );
      }
    }

    return list.sort((a, b) => (a.date > b.date ? 1 : -1));
  }

  create(data: CreateHolidayDto, actorUser?: User) {
    if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees are not authorized to create holidays.');
    }

    let companyId: string | null = null;
    let companyCode: string | null = null;
    let holidayType: 'Public' | 'Optional' | 'Company' = data.type || 'Company';

    if (actorUser && actorUser.role === Role.ADMIN) {
      if (!actorUser.companyId) {
        throw new ForbiddenException('Admin user is not associated with any company.');
      }
      // Strict isolation: Admin can ONLY create holidays for their own company
      companyId = actorUser.companyId;
      companyCode = actorUser.companyCode || null;
      holidayType = 'Company';
    } else if (actorUser && actorUser.role === Role.SUPER_ADMIN) {
      if ((data as any).companyId) {
        const comp = this.db.companies.find(
          (c) => c.id === (data as any).companyId || c.companyCode === (data as any).companyId,
        );
        companyId = comp?.id || (data as any).companyId;
        companyCode = comp?.companyCode || null;
        holidayType = 'Company';
      } else {
        holidayType = data.type || 'Public';
      }
    }

    const newHol: Holiday = {
      id: `hol-${Date.now()}`,
      name: data.name || 'Holiday',
      date: data.date || new Date().toISOString().split('T')[0],
      dayOfWeek: data.dayOfWeek || 'Monday',
      type: holidayType,
      description: data.description || 'Company holiday',
      locationId: data.locationId,
      companyId,
      companyCode,
    };
    this.db.holidays.push(newHol);
    this.db.persist();
    return newHol;
  }

  update(id: string, data: Partial<CreateHolidayDto>, actorUser?: User) {
    const idx = this.db.holidays.findIndex((h) => h.id === id);
    if (idx === -1) throw new NotFoundException(`Holiday "${id}" not found`);
    const current = this.db.holidays[idx];

    if (actorUser && actorUser.role === Role.ADMIN) {
      if (current.type === 'Public') {
        throw new ForbiddenException('Admin cannot modify global public holidays.');
      }
      if (current.companyId && current.companyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot modify holiday belonging to another company.');
      }
    } else if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees are not authorized to update holidays.');
    }

    const updated: Holiday = {
      ...current,
      ...(data as any),
      id: current.id,
      companyId: current.companyId,
      companyCode: current.companyCode,
    };

    this.db.holidays[idx] = updated;
    this.db.persist();
    return updated;
  }

  remove(id: string, actorUser?: User) {
    const idx = this.db.holidays.findIndex((h) => h.id === id);
    if (idx === -1) throw new NotFoundException(`Holiday "${id}" not found`);
    const current = this.db.holidays[idx];

    if (actorUser && actorUser.role === Role.ADMIN) {
      if (current.type === 'Public') {
        throw new ForbiddenException('Admin cannot delete global public holidays.');
      }
      if (current.companyId && current.companyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot delete holiday belonging to another company.');
      }
    } else if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees are not authorized to delete holidays.');
    }

    const removed = this.db.holidays.splice(idx, 1);
    this.db.persist();
    return removed[0];
  }
}
