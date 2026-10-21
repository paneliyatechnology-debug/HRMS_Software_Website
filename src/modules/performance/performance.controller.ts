import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { PerformanceService } from './performance.service.js';
import { SubmitReviewRatingDto } from './dto/submit-rating.dto.js';

@ApiTags('Performance')
@Controller('performance')
export class PerformanceController {
  constructor(private readonly perfService: PerformanceService) {}

  @Get('cycles')
  @ApiOperation({
    summary: 'List all review cycles',
    description: 'Retrieves annual and semi-annual appraisal cycles and timelines.',
  })
  @ApiResponse({ status: 200, description: 'List of performance cycles' })
  getCycles() {
    return this.perfService.getCycles();
  }

  @Get('reviews')
  @ApiOperation({
    summary: 'List reviews, optionally filtered by employeeId',
    description: 'Retrieves appraisal evaluations and KPI ratings.',
  })
  @ApiQuery({ name: 'employeeId', required: false, description: 'Filter by employee ID' })
  @ApiResponse({ status: 200, description: 'List of performance reviews' })
  getReviews(@Query('employeeId') employeeId?: string) {
    return this.perfService.getReviews(employeeId);
  }

  @Post('reviews/:id/rate')
  @ApiOperation({
    summary: 'Submit self-assessment or manager appraisal rating',
    description: 'Records rating scores (1-5), qualitative feedback, and promotion/appraisal recommendations.',
  })
  @ApiParam({ name: 'id', description: 'Performance Review ID' })
  @ApiBody({ type: SubmitReviewRatingDto })
  @ApiResponse({ status: 200, description: 'Rating recorded successfully' })
  @ApiResponse({ status: 404, description: 'Performance review not found' })
  submitRating(@Param('id') id: string, @Body() body: SubmitReviewRatingDto) {
    return this.perfService.submitRating(id, body);
  }
}
