import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class QueryAttendanceDto {
  @ApiPropertyOptional({ description: 'Filter by User ID', example: 'user-1793009147556' })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter by employee ID (legacy alias for userId)' })
  @IsString()
  @IsOptional()
  employeeId?: string;

  @ApiPropertyOptional({ description: 'Filter by specific date (YYYY-MM-DD)' })
  @IsString()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({ description: 'Filter by department ID' })
  @IsString()
  @IsOptional()
  departmentId?: string;
}
