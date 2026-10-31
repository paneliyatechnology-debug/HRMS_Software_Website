import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { WorkSessionStatus } from '../../../common/types.js';

export class QueryWorkHistoryDto {
  @ApiPropertyOptional({
    description: 'Filter by user ID (Admin / SuperAdmin only)',
    example: 'user-1793009147556',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter by employee ID (legacy alias for userId)',
    example: 'user-1793009147556',
  })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional({
    description: 'Filter by company ID (SuperAdmin only)',
    example: 'cmp-1',
  })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({
    description: 'Filter by specific date (YYYY-MM-DD)',
    example: '2026-10-28',
  })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Start of date range (YYYY-MM-DD)',
    example: '2026-10-01',
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End of date range (YYYY-MM-DD)',
    example: '2026-10-31',
  })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({
    enum: WorkSessionStatus,
    description: 'Filter by work session status',
    example: WorkSessionStatus.COMPLETED,
  })
  @IsOptional()
  @IsEnum(WorkSessionStatus)
  status?: WorkSessionStatus;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    default: 50,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 50;
}

