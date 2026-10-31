import { Controller, Get, Post, Put, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TrainingService } from './training.service.js';
import { CreateTrainingProgramDto } from './dto/create-program.dto.js';
import { EnrollTrainingDto } from './dto/enroll-training.dto.js';
import { UpdateTrainingProgressDto } from './dto/update-progress.dto.js';

@ApiTags('Training')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('training')
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Get('programs')
  @ApiOperation({
    summary: 'List all training programs',
    description: 'Retrieves all professional upskilling programs, cohorts, and curricula.',
  })
  @ApiResponse({ status: 200, description: 'List of training courses' })
  getPrograms(@Req() req: any) {
    return this.trainingService.getPrograms(req.user);
  }

  @Post('programs')
  @ApiOperation({
    summary: 'Create new training program',
    description: 'Publishes a new training program with required skills and duration hours.',
  })
  @ApiBody({ type: CreateTrainingProgramDto })
  @ApiResponse({ status: 201, description: 'Training program created' })
  createProgram(@Body() body: CreateTrainingProgramDto, @Req() req: any) {
    return this.trainingService.createProgram(body, req.user);
  }

  @Get('enrollments')
  @ApiOperation({
    summary: 'List employee training enrollments',
    description: 'Retrieves assigned, ongoing, or completed training registrations.',
  })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'employeeId', required: false, description: 'Filter by employee ID (legacy alias for userId)' })
  @ApiResponse({ status: 200, description: 'List of enrollments' })
  getEmployeeTrainings(@Query('userId') userId?: string, @Query('employeeId') employeeId?: string, @Req() req?: any) {
    return this.trainingService.getEmployeeTrainings(userId || employeeId, req?.user);
  }

  @Post('enroll')
  @ApiOperation({
    summary: 'Enroll employee in training course',
    description: 'Assigns an employee to a training program and tracks progress.',
  })
  @ApiBody({ type: EnrollTrainingDto })
  @ApiResponse({ status: 201, description: 'Enrolled successfully' })
  enroll(@Body() body: EnrollTrainingDto, @Req() req: any) {
    return this.trainingService.enroll(body, req.user);
  }

  @Put('enrollments/:id/progress')
  @ApiOperation({
    summary: 'Update training progress percentage',
    description: 'Updates completion percentage (auto-issues certificate when reaching 100%).',
  })
  @ApiParam({ name: 'id', description: 'Enrollment ID' })
  @ApiBody({ type: UpdateTrainingProgressDto })
  @ApiResponse({ status: 200, description: 'Training progress updated' })
  updateProgress(@Param('id') id: string, @Body() body: UpdateTrainingProgressDto, @Req() req: any) {
    return this.trainingService.updateProgress(id, body, req.user);
  }
}
