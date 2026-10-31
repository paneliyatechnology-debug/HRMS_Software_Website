import { Injectable, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { Role, User } from '../../common/types.js';
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

  getSettings(actorUser?: User) {
    if (actorUser && actorUser.companyId) {
      const cmp = this.db.companies.find((c) => c.id === actorUser.companyId);
      if (cmp) {
        return {
          ...this.settings,
          company: {
            ...this.settings.company,
            name: cmp.companyName,
            supportEmail: cmp.email,
            phone: cmp.phone,
            taxId: cmp.companyCode,
            address: cmp.city || this.settings.company.address,
          },
        };
      }
    }
    return this.settings;
  }

  updateSettings(data: UpdateSettingsDto, actorUser?: User) {
    if (actorUser && actorUser.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can modify enterprise system policies');
    }

    const actorName = actorUser?.email || 'Super Admin';
    this.settings = {
      ...this.settings,
      ...data,
      company: { ...this.settings.company, ...(data.company || {}) },
      workSchedule: { ...this.settings.workSchedule, ...(data.workSchedule || {}) },
      leavePolicy: { ...this.settings.leavePolicy, ...(data.leavePolicy || {}) },
      payrollPolicy: { ...this.settings.payrollPolicy, ...(data.payrollPolicy || {}) },
    } as any;

    this.db.logAudit(
      actorUser?.id || 'sys',
      actorName,
      'SUPER_ADMIN',
      'SETTINGS_UPDATED',
      'Settings',
      'Updated organization global system policies and settings',
    );

    return this.settings;
  }
}
