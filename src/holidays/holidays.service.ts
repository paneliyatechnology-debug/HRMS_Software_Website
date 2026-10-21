import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { Holiday } from '../common/types.js';

@Injectable()
export class HolidaysService {
  constructor(private readonly db: DatabaseService) {}

  findAll() {
    return this.db.holidays.sort((a, b) => (a.date > b.date ? 1 : -1));
  }

  create(data: Partial<Holiday>) {
    const newHol: Holiday = {
      id: `hol-${Date.now()}`,
      name: data.name || 'Holiday',
      date: data.date || new Date().toISOString().split('T')[0],
      dayOfWeek: data.dayOfWeek || 'Monday',
      type: data.type || 'Public',
      description: data.description || 'Company holiday',
      locationId: data.locationId,
    };
    this.db.holidays.push(newHol);
    this.db.persist();
    return newHol;
  }

  remove(id: string) {
    const idx = this.db.holidays.findIndex((h) => h.id === id);
    if (idx === -1) throw new NotFoundException('Holiday not found');
    const removed = this.db.holidays.splice(idx, 1);
    this.db.persist();
    return removed[0];
  }
}
