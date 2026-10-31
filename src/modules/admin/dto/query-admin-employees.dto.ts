import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class QueryAdminEmployeesDto {
  @ApiPropertyOptional({ example: 'Ravi', description: 'Search by first name, last name, code, or email' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ example: 'dept-1', description: 'Filter by Department ID' })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({ example: 'desig-1', description: 'Filter by Designation ID' })
  @IsString()
  @IsOptional()
  designationId?: string;

  @ApiPropertyOptional({ example: 'Active', description: 'Filter by status (Active, On Leave, Probation, Terminated)' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: 1, description: 'Page number' })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ example: 20, description: 'Records per page' })
  @IsOptional()
  limit?: number;
}

