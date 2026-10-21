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

  @ApiPropertyOptional({ description: 'Filter by employee ID' })
  @IsString()
  @IsOptional()
  employeeId?: string;
}
