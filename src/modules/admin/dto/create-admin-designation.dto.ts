import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAdminDesignationDto {
  @ApiProperty({ example: 'Senior Software Engineer', description: 'Designation / job title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'dept-1', description: 'Department ID' })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({ example: 'L3', description: 'Experience or seniority level' })
  @IsString()
  @IsOptional()
  level?: string;
}

