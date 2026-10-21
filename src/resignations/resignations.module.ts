import { Module } from '@nestjs/common';
import { ResignationsService } from './resignations.service.js';
import { ResignationsController } from './resignations.controller.js';

@Module({
  controllers: [ResignationsController],
  providers: [ResignationsService],
  exports: [ResignationsService],
})
export class ResignationsModule {}
