import { Module } from '@nestjs/common';
import { PerformanceService } from './performance.service.js';
import { PerformanceController } from './performance.controller.js';

@Module({
  controllers: [PerformanceController],
  providers: [PerformanceService],
  exports: [PerformanceService],
})
export class PerformanceModule {}
