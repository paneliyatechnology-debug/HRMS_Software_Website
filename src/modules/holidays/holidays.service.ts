import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { Holiday, Role, User, NotificationItem } from '../../common/types.js';
import { CreateHolidayDto } from './dto/create-holiday.dto.js';
import { UpdateHolidayDto } from './dto/update-holiday.dto.js';

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

  async create(data: CreateHolidayDto, actorUser?: User) {
    if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees are not authorized to create holidays.');
    }

    if (!data.name || !data.name.trim()) {
      throw new BadRequestException('Holiday name is required.');
    }
    if (!data.date || !data.date.trim()) {
      throw new BadRequestException('Holiday date (YYYY-MM-DD) is required.');
    }

    const targetDate = data.date.trim();

    let companyId: string | null = null;
    let companyCode: string | null = null;
    let holidayType: 'Public' | 'Optional' | 'Company' = data.type || 'Company';

    if (actorUser && actorUser.role === Role.ADMIN) {
      if (!actorUser.companyId) {
        throw new ForbiddenException('Admin user is not associated with any company.');
      }
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

    // Duplicate Date Validation: Check if a holiday already exists on this date
    let duplicate = this.db.holidays.find((h) => {
      if (h.date !== targetDate) return false;
      if (h.type === 'Public') return true;
      if (holidayType === 'Public') return true;
      if (companyId && h.companyId === companyId) return true;
      return false;
    });

    if (!duplicate && (this.db as any).mysqlPool && (this.db as any).isMysqlConnected) {
      try {
        const pool = (this.db as any).mysqlPool;
        const [rows]: any = await pool.query(
          `SELECT * FROM holidays WHERE date = ? AND (type = 'Public' OR companyId = ? OR ? = 'Public') LIMIT 1`,
          [targetDate, companyId || '___none___', holidayType],
        );
        if (rows && rows.length > 0) {
          duplicate = rows[0];
          if (!this.db.holidays.some((h) => h.id === rows[0].id)) {
            this.db.holidays.push(rows[0]);
          }
        }
      } catch {}
    }

    if (duplicate) {
      throw new ConflictException(
        `A holiday "${duplicate.name}" is already scheduled on this date (${targetDate}). Multiple holidays on the same date are not allowed.`,
      );
    }

    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let calculatedDay = data.dayOfWeek;
    if (!calculatedDay) {
      const d = new Date(targetDate + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        calculatedDay = daysOfWeek[d.getDay()];
      } else {
        calculatedDay = 'Monday';
      }
    }

    const newHol: Holiday = {
      id: `hol-${Date.now()}`,
      name: data.name.trim(),
      date: targetDate,
      dayOfWeek: calculatedDay,
      type: holidayType,
      description: data.description || 'Company holiday',
      locationId: data.locationId || undefined,
      companyId,
      companyCode,
    };
    this.db.holidays.push(newHol);
    await this.db.saveHolidayToMysql(newHol);

    const holNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      companyId: newHol.companyId || null,
      companyCode: newHol.companyCode || null,
      title: `Upcoming Holiday: ${newHol.name}`,
      message: `Company holiday scheduled for ${newHol.date} (${newHol.dayOfWeek}).`,
      type: 'holiday',
      isRead: false,
      createdAt: new Date().toISOString(),
      link: '/holidays',
    };
    this.db.notifications.unshift(holNotif);
    void this.db.saveNotificationToMysql(holNotif);

    this.db.persist();
    return newHol;
  }

  async update(id: string, data: UpdateHolidayDto, actorUser?: User) {
    let idx = this.db.holidays.findIndex((h) => h.id === id);
    if (idx === -1 && (this.db as any).mysqlPool && (this.db as any).isMysqlConnected) {
      try {
        const pool = (this.db as any).mysqlPool;
        const [rows]: any = await pool.query('SELECT * FROM holidays WHERE id = ? LIMIT 1', [id]);
        if (rows && rows.length > 0) {
          this.db.holidays.push(rows[0]);
          idx = this.db.holidays.length - 1;
        }
      } catch {}
    }
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

    const targetDate = data.date ? data.date.trim() : current.date;
    const targetType = data.type || current.type;
    const targetCompanyId = current.companyId;

    // Duplicate Date Validation if date is being changed
    if (data.date && data.date.trim() !== current.date) {
      const duplicate = this.db.holidays.find((h) => {
        if (h.id === current.id) return false;
        if (h.date !== targetDate) return false;
        if (h.type === 'Public') return true;
        if (targetType === 'Public') return true;
        if (targetCompanyId && h.companyId === targetCompanyId) return true;
        return false;
      });

      if (duplicate) {
        throw new ConflictException(
          `A holiday "${duplicate.name}" is already scheduled on this date (${targetDate}). Multiple holidays on the same date are not allowed.`,
        );
      }
    }

    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let calculatedDay = data.dayOfWeek || current.dayOfWeek;
    if (data.date && !data.dayOfWeek) {
      const d = new Date(targetDate + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        calculatedDay = daysOfWeek[d.getDay()];
      }
    }

    const updated: Holiday = {
      ...current,
      name: data.name !== undefined ? data.name.trim() : current.name,
      date: targetDate,
      dayOfWeek: calculatedDay,
      type: targetType,
      description: data.description !== undefined ? data.description : current.description,
      locationId: data.locationId !== undefined ? data.locationId : current.locationId,
      id: current.id,
      companyId: current.companyId,
      companyCode: current.companyCode,
    };

    this.db.holidays[idx] = updated;
    await this.db.saveHolidayToMysql(updated);
    this.db.persist();
    return updated;
  }

  async remove(id: string, actorUser?: User) {
    let idx = this.db.holidays.findIndex((h) => h.id === id);
    if (idx === -1 && (this.db as any).mysqlPool && (this.db as any).isMysqlConnected) {
      try {
        const pool = (this.db as any).mysqlPool;
        const [rows]: any = await pool.query('SELECT * FROM holidays WHERE id = ? LIMIT 1', [id]);
        if (rows && rows.length > 0) {
          this.db.holidays.push(rows[0]);
          idx = this.db.holidays.length - 1;
        }
      } catch {}
    }
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
    await this.db.deleteHolidayFromMysql(id);
    this.db.persist();
    return removed[0];
  }
}
