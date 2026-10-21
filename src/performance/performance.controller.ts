import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PerformanceService } from './performance.service.js';

@ApiTags('Performance')
@Controller('performance')
export class PerformanceController {
  constructor(private readonly perfService: PerformanceService) {}

  @Get('cycles')
  @ApiOperation({ summary: 'List all review cycles' })
  getCycles() {
    return this.perfService.getCycles();
  }

  @Get('reviews')
  @ApiOperation({ summary: 'List reviews, optionally filtered by employeeId' })
  getReviews(@Query('employeeId') employeeId?: string) {
    return this.perfService.getReviews(employeeId);
  }

  @Post('reviews/:id/rate')
  @ApiOperation({ summary: 'Submit self-assessment or manager appraisal rating' })
  submitRating(
    @Param('id') id: string,
    @Body()
    body: {
      selfRating?: number;
      selfComments?: string;
      managerRating?: number;
      managerFeedback?: string;
      appraisalRecommended?: string;
      role?: string;
      actorName?: string;
    },
  ) {
    return this.perfService.submitRating(id, body, body.actorName);
  }
}
