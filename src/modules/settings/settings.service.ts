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
      HR_ADMIN: {
        label: 'HR Admin',
        canManageEmployees: true,
        canProcessPayroll: true,
        canApproveLeaves: true,
      },
      HR_EXECUTIVE: {
        label: 'HR Executive',
        canManageEmployees: true,
        canReviewAttendance: true,
      },
      MANAGER: {
        label: 'Manager',
        canViewTeam: true,
        canApproveTeamLeaves: true,
        canReviewPerformance: true,
      },
      EMPLOYEE: {
        label: 'Employee',
        canViewOwnProfile: true,
        canApplyLeave: true,
        canViewPayslips: true,
      },
      RECRUITER: {
        label: 'Recruiter',
        canManageJobs: true,
        canManageCandidates: true,
        canScheduleInterviews: true,
      },
      FINANCE_ADMIN: {
        label: 'Finance Admin',
        canProcessPayroll: true,
        canManageSalary: true,
        canViewReports: true,
      },
    },
  };

  getSettings() {
    return this.settings;
  }
  updateSettings(data: UpdateSettingsDto, actorName = 'Super Admin') {
    this.settings = {
      ...this.settings,
      ...data,
      company: { ...this.settings.company, ...(data.company || {}) },
      workSchedule: { ...this.settings.workSchedule, ...(data.workSchedule || {}) },
      leavePolicy: { ...this.settings.leavePolicy, ...(data.leavePolicy || {}) },
      payrollPolicy: { ...this.settings.payrollPolicy, ...(data.payrollPolicy || {}) },
    } as any;
    this.db.logAudit(
      'sys',
      actorName,
      'SUPER_ADMIN',
      'SETTINGS_UPDATED',
      'Settings',
      'Updated organization global system policies and settings',
    );
    return this.settings;
  }
}
