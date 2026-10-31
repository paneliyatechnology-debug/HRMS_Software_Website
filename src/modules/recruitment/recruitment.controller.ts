import { Controller, Get, Post, Put, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RecruitmentService } from './recruitment.service.js';
import { CreateJobOpeningDto } from './dto/create-job.dto.js';
import { CreateCandidateDto } from './dto/create-candidate.dto.js';
import { UpdateCandidateStatusDto } from './dto/update-candidate-status.dto.js';
import { ScheduleInterviewDto } from './dto/schedule-interview.dto.js';
import { ConvertCandidateDto } from './dto/convert-candidate.dto.js';

@ApiTags('Recruitment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recruitment')
export class RecruitmentController {
  constructor(private readonly recService: RecruitmentService) {}

  @Get('jobs')
  @ApiOperation({
    summary: 'List all published job openings',
    description: 'Retrieves all open requisitions with active applicant count metrics.',
  })
  @ApiResponse({ status: 200, description: 'List of job openings' })
  getJobs(@Req() req: any) {
    return this.recService.getJobs(req.user);
  }

  @Post('jobs')
  @ApiOperation({
    summary: 'Create new job opening',
    description: 'Publishes a new role requisition with requirements and salary band.',
  })
  @ApiBody({ type: CreateJobOpeningDto })
  @ApiResponse({ status: 201, description: 'Job opening created' })
  createJob(@Body() body: CreateJobOpeningDto, @Req() req: any) {
    return this.recService.createJob(body, req.user);
  }

  @Get('candidates')
  @ApiOperation({
    summary: 'List candidates, optionally filtered by jobId',
    description: 'Retrieves applicant tracking pipeline candidates.',
  })
  @ApiQuery({ name: 'jobId', required: false, description: 'Filter by specific Job Requisition ID' })
  @ApiResponse({ status: 200, description: 'List of candidates' })
  getCandidates(@Query('jobId') jobId?: string, @Req() req?: any) {
    return this.recService.getCandidates(jobId, req?.user);
  }

  @Post('candidates')
  @ApiOperation({
    summary: 'Add new candidate',
    description: 'Submits a new candidate profile into the talent pipeline.',
  })
  @ApiBody({ type: CreateCandidateDto })
  @ApiResponse({ status: 201, description: 'Candidate created' })
  createCandidate(@Body() body: CreateCandidateDto, @Req() req: any) {
    return this.recService.createCandidate(body, req.user);
  }

  @Put('candidates/:id/status')
  @ApiOperation({
    summary: 'Update candidate pipeline stage',
    description: 'Advances candidate across Screening, Interview, Offer, Hired, or Rejected stages.',
  })
  @ApiParam({ name: 'id', description: 'Candidate ID' })
  @ApiBody({ type: UpdateCandidateStatusDto })
  @ApiResponse({ status: 200, description: 'Candidate stage updated' })
  updateCandidateStatus(@Param('id') id: string, @Body() body: UpdateCandidateStatusDto, @Req() req: any) {
    return this.recService.updateCandidateStatus(id, body, req.user);
  }

  @Post('candidates/:id/schedule-interview')
  @ApiOperation({
    summary: 'Schedule interview round for candidate',
    description: 'Books an interview round, assigns an interviewer, and triggers notifications.',
  })
  @ApiParam({ name: 'id', description: 'Candidate ID' })
  @ApiBody({ type: ScheduleInterviewDto })
  @ApiResponse({ status: 201, description: 'Interview scheduled' })
  scheduleInterview(@Param('id') id: string, @Body() body: ScheduleInterviewDto, @Req() req: any) {
    return this.recService.scheduleInterview(id, body, req.user);
  }

  @Post('candidates/:id/convert')
  @ApiOperation({
    summary: 'One-click convert hired candidate to employee',
    description: 'Seamlessly transfers candidate details into employee roster with default pay-band and code.',
  })
  @ApiParam({ name: 'id', description: 'Candidate ID' })
  @ApiBody({ type: ConvertCandidateDto, required: false })
  @ApiResponse({ status: 200, description: 'Candidate converted to employee successfully' })
  convertToEmployee(@Param('id') id: string, @Body() body?: ConvertCandidateDto, @Req() req?: any) {
    return this.recService.convertToEmployee(id, body, req?.user);
  }
}
