import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { SuperAdminController } from './super-admin.controller.js';
import { SuperAdminService } from './super-admin.service.js';
import { SuperAdminGuard } from './guards/super-admin.guard.js';

@Module({
  imports: [DatabaseModule],
  controllers: [SuperAdminController],
  providers: [SuperAdminService, SuperAdminGuard],
  exports: [SuperAdminService, SuperAdminGuard],
})
export class SuperAdminModule {}
