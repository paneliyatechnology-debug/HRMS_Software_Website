import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class SubmitReviewRatingDto {
  @ApiPropertyOptional({ example: 4.5, description: 'Self-assessment score (1-5)' })
  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  selfRating?: number;

  @ApiPropertyOptional({ example: 'Delivered core microservices ahead of sprint deadline' })
  @IsString()
  @IsOptional()
  selfComments?: string;

  @ApiPropertyOptional({ example: 4.8, description: 'Manager evaluation score (1-5)' })
  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  managerRating?: number;

  @ApiPropertyOptional({ example: 'Outstanding performance and team leadership' })
  @IsString()
  @IsOptional()
  managerFeedback?: string;

  @ApiPropertyOptional({ example: 'Promotion to Lead Software Engineer recommended' })
  @IsString()
  @IsOptional()
  appraisalRecommended?: string;

  @ApiPropertyOptional({ example: 'MANAGER', description: 'Role submitting review' })
  @IsString()
  @IsOptional()
  role?: string;

  @ApiPropertyOptional({ example: 'David Miller' })
  @IsString()
  @IsOptional()
  actorName?: string;
}
