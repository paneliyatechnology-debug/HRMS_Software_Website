import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';

@Injectable()
export class SettingsService {
  constructor(private readonly db: DatabaseService) {}

  private settings = {
    company: {
      name: 'Paneliya Technology Inc.',
      tagline: 'Enterprise Cloud & Next-Gen Software Engineering',
      foundedYear: 2021,
      taxId: 'US-EIN-984102941',
      supportEmail: 'support@paneliya.com',
      website: 'https://paneliya.com',
      phone: '+1 (415) 555-0199',
      address: '100 Silicon Vista Blvd, Suite 800, San Francisco, CA 94105',
      currency: 'USD ($)',
    },
    workSchedule: {
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      workingHoursPerDay: 8,
      defaultShift: '09:00 AM - 06:00 PM',
      gracePeriodMinutes: 15,
      halfDayHours: 4,
    },
    leavePolicy: {
      casualLeaveAnnual: 12,
      sickLeaveAnnual: 10,
      paidLeaveAnnual: 15,
      carryForwardLimit: 5,
      approvalLevels: 2, // Manager -> HR
    },
    payrollPolicy: {
      payCycle: 'Monthly',
      disbursementDate: 28,
      pfContributionPercent: 12,
      professionalTaxAmount: 200,
      overtimeMultiplier: 1.5,
    },
    rolesPermissions: {
      SUPER_ADMIN: { label: 'Super Admin', canManageAll: true, canEditSettings: true },
      ADMIN: {
        label: 'Admin',
        canManageEmployees: true,
        canProcessPayroll: true,
        canApproveLeaves: true,
        canReviewAttendance: true,
        canManageJobs: true,
        canManageAssets: true,
      },
      EMPLOYEE: {
        label: 'Employee',
        canViewOwnProfile: true,
        canApplyLeave: true,
        canViewPayslips: true,
      },
    },
  };

  getSettings(companyId?: string) {
    const stored = this.db.systemSettings;
    const base = stored
      ? {
          ...this.settings,
          ...stored,
          company: { ...this.settings.company, ...(stored.company || {}) },
          workSchedule: { ...this.settings.workSchedule, ...(stored.workSchedule || {}) },
          leavePolicy: { ...this.settings.leavePolicy, ...(stored.leavePolicy || {}) },
          payrollPolicy: { ...this.settings.payrollPolicy, ...(stored.payrollPolicy || {}) },
        }
      : this.settings;

    if (companyId && this.db.companySchedules[companyId]) {
      return {
        ...base,
        workSchedule: {
          ...base.workSchedule,
          ...this.db.companySchedules[companyId],
        },
      };
    }
    return base;
  }

  updateSettings(data: UpdateSettingsDto, actorName = 'Super Admin', companyId?: string) {
    const current = this.getSettings(companyId);
    const next = {
      ...current,
      ...data,
      company: { ...current.company, ...(data.company || {}) },
      workSchedule: { ...current.workSchedule, ...(data.workSchedule || {}) },
      leavePolicy: { ...current.leavePolicy, ...(data.leavePolicy || {}) },
      payrollPolicy: { ...current.payrollPolicy, ...(data.payrollPolicy || {}) },
    } as any;

    this.db.systemSettings = {
      ...next,
      workSchedule: this.settings.workSchedule,
    };
    if (companyId) {
      this.db.companySchedules[companyId] = next.workSchedule;
    }
    this.db.persist();
    this.db.logAudit(
      'sys',
      actorName,
      'ADMIN',
      'SETTINGS_UPDATED',
      'Settings',
      'Updated organization policies and shift schedule',
    );
    return this.getSettings(companyId);
  }
}
