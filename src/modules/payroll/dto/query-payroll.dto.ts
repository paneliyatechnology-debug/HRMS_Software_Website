import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class QueryPayrollDto {
  @ApiPropertyOptional({ description: 'Filter by payroll month (YYYY-MM)' })
  @IsString()
  @IsOptional()
  month?: string;

  @ApiPropertyOptional({ description: 'Filter by payroll status (Draft, Approved, Processed, Paid)' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by user ID', example: 'user-1793009147556' })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter by employee ID (legacy alias for userId)' })
  @IsString()
  @IsOptional()
  employeeId?: string;
}
