import { Module } from '@nestjs/common';
import { TrainingService } from './training.service.js';
import { TrainingController } from './training.controller.js';

@Module({
  controllers: [TrainingController],
  providers: [TrainingService],
  exports: [TrainingService],
})
export class TrainingModule {}
