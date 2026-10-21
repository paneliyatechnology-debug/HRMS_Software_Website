import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TrainingService } from './training.service.js';
import { TrainingProgram } from '../common/types.js';

@ApiTags('Training')
@Controller('training')
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Get('programs')
  @ApiOperation({ summary: 'List all training programs' })
  getPrograms() {
    return this.trainingService.getPrograms();
  }

  @Post('programs')
  @ApiOperation({ summary: 'Create new training program' })
  createProgram(@Body() body: Partial<TrainingProgram>) {
    return this.trainingService.createProgram(body);
  }

  @Get('enrollments')
  @ApiOperation({ summary: 'List employee training enrollments' })
  getEmployeeTrainings(@Query('employeeId') employeeId?: string) {
    return this.trainingService.getEmployeeTrainings(employeeId);
  }

  @Post('enroll')
  @ApiOperation({ summary: 'Enroll employee in training course' })
  enroll(@Body() body: { trainingId: string; employeeId: string }) {
    return this.trainingService.enroll(body.trainingId, body.employeeId);
  }

  @Put('enrollments/:id/progress')
  @ApiOperation({ summary: 'Update training progress percentage' })
  updateProgress(@Param('id') id: string, @Body() body: { progressPercent: number }) {
    return this.trainingService.updateProgress(id, body.progressPercent);
  }
}
