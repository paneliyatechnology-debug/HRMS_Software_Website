import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './database/database.module.js';
import { EventsModule } from './modules/events/events.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { EmployeesModule } from './modules/employees/employees.module.js';
import { OrganizationModule } from './modules/organization/organization.module.js';
import { AttendanceModule } from './modules/attendance/attendance.module.js';
import { LeavesModule } from './modules/leaves/leaves.module.js';
import { PayrollModule } from './modules/payroll/payroll.module.js';
import { RecruitmentModule } from './modules/recruitment/recruitment.module.js';
import { PerformanceModule } from './modules/performance/performance.module.js';
import { TrainingModule } from './modules/training/training.module.js';
import { AssetsModule } from './modules/assets/assets.module.js';
import { ResignationsModule } from './modules/resignations/resignations.module.js';
import { HolidaysModule } from './modules/holidays/holidays.module.js';
import { DocumentsModule } from './modules/documents/documents.module.js';
import { AnnouncementsModule } from './modules/announcements/announcements.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { SuperAdminModule } from './modules/super-admin/super-admin.module.js';
import { CompaniesModule } from './modules/companies/companies.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { ChatModule } from './modules/chat/chat.module.js';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';

@Module({
  imports: [
    DatabaseModule,
    EventsModule,
    AuthModule,
    SuperAdminModule,
    CompaniesModule,
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
    UsersModule,
    ChatModule,
    SubscriptionsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
