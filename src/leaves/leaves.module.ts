import { Module } from '@nestjs/common';
import { LeavesService } from './leaves.service.js';
import { LeavesController } from './leaves.controller.js';

@Module({
  controllers: [LeavesController],
  providers: [LeavesService],
  exports: [LeavesService],
})
export class LeavesModule {}
