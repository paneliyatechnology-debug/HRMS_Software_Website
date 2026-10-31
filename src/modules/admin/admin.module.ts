import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { AdminGuard } from './guards/admin.guard.js';
import { EmployeesModule } from '../employees/employees.module.js';

@Module({
  imports: [EmployeesModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
  exports: [AdminService],
})
export class AdminModule {}


