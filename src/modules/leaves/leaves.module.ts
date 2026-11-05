import { Module } from '@nestjs/common';
import { LeavesService } from './leaves.service.js';
import { LeavesController } from './leaves.controller.js';
import { LeaveTypesController } from './leave-types.controller.js';

@Module({
  controllers: [LeavesController, LeaveTypesController],
  providers: [LeavesService],
  exports: [LeavesService],
})
export class LeavesModule {}
