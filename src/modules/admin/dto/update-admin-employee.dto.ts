import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CreateAdminEmployeeDto } from './create-admin-employee.dto.js';
import { IsOptional, IsString } from 'class-validator';

export class UpdateAdminEmployeeDto extends PartialType(CreateAdminEmployeeDto) {
  @ApiPropertyOptional({
    example: 'Active',
    enum: ['Active', 'Inactive', 'On Leave', 'Terminated', 'Probation'],
    description: 'Employment operational status',
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: 'Night Shift (9 PM - 6 AM)', description: 'Work shift schedule' })
  @IsString()
  @IsOptional()
  shift?: string;

  @ApiPropertyOptional({ example: 'EMP-000001', description: 'Employee code' })
  @IsString()
  @IsOptional()
  employeeCode?: string;
}

