import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PerformanceService } from './performance.service.js';
import { SubmitReviewRatingDto } from './dto/submit-rating.dto.js';

@ApiTags('Performance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('performance')
export class PerformanceController {
  constructor(private readonly perfService: PerformanceService) {}

  @Get('cycles')
  @ApiOperation({
    summary: 'List all review cycles',
    description: 'Retrieves annual and semi-annual appraisal cycles and timelines.',
  })
  @ApiResponse({ status: 200, description: 'List of performance cycles' })
  getCycles(@Req() req: any) {
    return this.perfService.getCycles(req.user);
  }

  @Get('reviews')
  @ApiOperation({
    summary: 'List reviews, optionally filtered by userId',
    description: 'Retrieves appraisal evaluations and KPI ratings.',
  })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'employeeId', required: false, description: 'Filter by employee ID (legacy alias for userId)' })
  @ApiResponse({ status: 200, description: 'List of performance reviews' })
  getReviews(@Query('userId') userId?: string, @Query('employeeId') employeeId?: string, @Req() req?: any) {
    return this.perfService.getReviews(userId || employeeId, req?.user);
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
  submitRating(@Param('id') id: string, @Body() body: SubmitReviewRatingDto, @Req() req: any) {
    return this.perfService.submitRating(id, body, req.user);
  }
}
