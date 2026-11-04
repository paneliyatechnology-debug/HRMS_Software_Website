import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateHolidayDto {
  @ApiPropertyOptional({ example: 'Diwali Celebration & Deepawali', description: 'Updated holiday name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: '2026-11-12', description: 'Updated calendar date (YYYY-MM-DD)' })
  @IsString()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({ example: 'Thursday', description: 'Day of week' })
  @IsString()
  @IsOptional()
  dayOfWeek?: string;

  @ApiPropertyOptional({
    enum: ['Public', 'Optional', 'Company'],
    example: 'Company',
    description: 'Holiday classification',
  })
  @IsIn(['Public', 'Optional', 'Company'])
  @IsOptional()
  type?: 'Public' | 'Optional' | 'Company';

  @ApiPropertyOptional({ example: 'Updated celebration description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'loc-1', description: 'Optional location ID restriction' })
  @IsString()
  @IsOptional()
  locationId?: string;
}

