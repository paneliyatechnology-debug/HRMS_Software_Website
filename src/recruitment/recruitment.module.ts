import { Module } from '@nestjs/common';
import { RecruitmentService } from './recruitment.service.js';
import { RecruitmentController } from './recruitment.controller.js';

@Module({
  controllers: [RecruitmentController],
  providers: [RecruitmentService],
  exports: [RecruitmentService],
})
export class RecruitmentModule {}
