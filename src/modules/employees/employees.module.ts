import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service.js';
import { EmployeesController } from './employees.controller.js';
import { EmployeeInvitationService } from './employee-invitation.service.js';
import { MailService } from '../../common/services/mail.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [EmployeesController],
  providers: [EmployeesService, EmployeeInvitationService, MailService],
  exports: [EmployeesService, EmployeeInvitationService, MailService],
})
export class EmployeesModule {}
