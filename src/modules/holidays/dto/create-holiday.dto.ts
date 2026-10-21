import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateHolidayDto {
  @ApiProperty({ example: 'Thanksgiving Day', description: 'Holiday name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '2026-11-26', description: 'Holiday calendar date (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty()
  date: string;

  @ApiPropertyOptional({ example: 'Thursday', description: 'Day of week' })
  @IsString()
  @IsOptional()
  dayOfWeek?: string;

  @ApiPropertyOptional({
    enum: ['Public', 'Optional', 'Company'],
    example: 'Public',
    description: 'Holiday classification',
  })
  @IsIn(['Public', 'Optional', 'Company'])
  @IsOptional()
  type?: 'Public' | 'Optional' | 'Company';

  @ApiPropertyOptional({ example: 'Annual Thanksgiving celebration' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'loc-1', description: 'Optional location ID restriction' })
  @IsString()
  @IsOptional()
  locationId?: string;
}
