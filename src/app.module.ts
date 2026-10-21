import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { EmployeesModule } from './employees/employees.module.js';
import { OrganizationModule } from './organization/organization.module.js';
import { AttendanceModule } from './attendance/attendance.module.js';
import { LeavesModule } from './leaves/leaves.module.js';
import { PayrollModule } from './payroll/payroll.module.js';
import { RecruitmentModule } from './recruitment/recruitment.module.js';
import { PerformanceModule } from './performance/performance.module.js';
import { TrainingModule } from './training/training.module.js';
import { AssetsModule } from './assets/assets.module.js';
import { ResignationsModule } from './resignations/resignations.module.js';
import { HolidaysModule } from './holidays/holidays.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { AnnouncementsModule } from './announcements/announcements.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { AuditLogsModule } from './audit-logs/audit-logs.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { EventsModule } from './events/events.module.js';

@Module({
  imports: [
    EventsModule,
    DatabaseModule,
    AuthModule,
    EmployeesModule,
    OrganizationModule,
    AttendanceModule,
    LeavesModule,
    PayrollModule,
    RecruitmentModule,
    PerformanceModule,
    TrainingModule,
    AssetsModule,
    ResignationsModule,
    HolidaysModule,
    DocumentsModule,
    AnnouncementsModule,
    NotificationsModule,
    AuditLogsModule,
    ReportsModule,
    SettingsModule,
  ],
})
export class AppModule {}
