import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RecruitmentService } from './recruitment.service.js';
import { CandidateStatus, JobOpening, Candidate } from '../common/types.js';

@ApiTags('Recruitment')
@Controller('recruitment')
export class RecruitmentController {
  constructor(private readonly recService: RecruitmentService) {}

  @Get('jobs')
  @ApiOperation({ summary: 'List all published job openings' })
  getJobs() {
    return this.recService.getJobs();
  }

  @Post('jobs')
  @ApiOperation({ summary: 'Create new job opening' })
  createJob(@Body() body: Partial<JobOpening>) {
    return this.recService.createJob(body);
  }

  @Get('candidates')
  @ApiOperation({ summary: 'List candidates, optionally filtered by jobId' })
  getCandidates(@Query('jobId') jobId?: string) {
    return this.recService.getCandidates(jobId);
  }

  @Post('candidates')
  @ApiOperation({ summary: 'Add new candidate' })
  createCandidate(@Body() body: Partial<Candidate>) {
    return this.recService.createCandidate(body);
  }

  @Put('candidates/:id/status')
  @ApiOperation({ summary: 'Update candidate pipeline stage' })
  updateCandidateStatus(
    @Param('id') id: string,
    @Body() body: { status: CandidateStatus; actorName?: string },
  ) {
    return this.recService.updateCandidateStatus(id, body.status, body.actorName);
  }

  @Post('candidates/:id/schedule-interview')
  @ApiOperation({ summary: 'Schedule interview round for candidate' })
  scheduleInterview(
    @Param('id') id: string,
    @Body() body: { round: string; interviewerName: string; scheduledAt: string },
  ) {
    return this.recService.scheduleInterview(id, body.round, body.interviewerName, body.scheduledAt);
  }

  @Post('candidates/:id/convert')
  @ApiOperation({ summary: 'One-click convert hired candidate to employee' })
  convertToEmployee(@Param('id') id: string, @Body() body: { actorName?: string }) {
    return this.recService.convertToEmployee(id, body.actorName);
  }
}
