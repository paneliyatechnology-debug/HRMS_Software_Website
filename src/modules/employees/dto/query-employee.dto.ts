import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class QueryEmployeeDto {
  @ApiPropertyOptional({ description: 'Search term across name, code, skills, department' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by Department ID (or ALL)' })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Filter by Employee Status (Active, Probation, etc.)' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by Employment Type (Full-time, Contract, etc.)' })
  @IsString()
  @IsOptional()
  employmentType?: string;

  @ApiPropertyOptional({ description: 'Filter by Company ID (SuperAdmin only)' })
  @IsString()
  @IsOptional()
  companyId?: string;
}
