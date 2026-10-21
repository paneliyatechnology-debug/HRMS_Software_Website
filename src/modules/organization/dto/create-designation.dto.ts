import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateDesignationDto {
  @ApiProperty({ example: 'Senior Staff Engineer', description: 'Designation / job title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'dept-1', description: 'Associated Department ID' })
  @IsString()
  @IsNotEmpty()
  departmentId: string;

  @ApiPropertyOptional({ example: 85000, description: 'Minimum base salary' })
  @IsNumber()
  @IsOptional()
  minSalary?: number;

  @ApiPropertyOptional({ example: 140000, description: 'Maximum base salary' })
  @IsNumber()
  @IsOptional()
  maxSalary?: number;
}
