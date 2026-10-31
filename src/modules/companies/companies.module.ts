import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller.js';
import { SuperAdminModule } from '../super-admin/super-admin.module.js';

@Module({
  imports: [SuperAdminModule],
  controllers: [CompaniesController],
})
export class CompaniesModule {}
