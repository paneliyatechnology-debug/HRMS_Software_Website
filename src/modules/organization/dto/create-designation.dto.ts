import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDesignationDto {
  @ApiProperty({ example: 'Senior Software Engineer', description: 'Designation / job title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'dept-1', description: 'Associated Department ID' })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({ example: 'Engineering', description: 'Associated Department Name' })
  @IsString()
  @IsOptional()
  departmentName?: string;

  @ApiPropertyOptional({ example: 50000, description: 'Minimum base salary' })
  @IsOptional()
  minSalary?: number;

  @ApiPropertyOptional({ example: 120000, description: 'Maximum base salary' })
  @IsOptional()
  maxSalary?: number;
}
