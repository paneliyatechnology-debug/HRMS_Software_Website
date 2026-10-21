import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateJobOpeningDto {
  @ApiProperty({ example: 'Senior AI Engineer', description: 'Job position title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'dept-1', description: 'Department ID' })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({ example: 'Engineering', description: 'Department Name' })
  @IsString()
  @IsOptional()
  departmentName?: string;

  @ApiPropertyOptional({ example: 'Senior Engineer' })
  @IsString()
  @IsOptional()
  designationTitle?: string;

  @ApiPropertyOptional({ example: 'San Francisco, CA (Hybrid)' })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({ example: 'Full-time' })
  @IsString()
  @IsOptional()
  employmentType?: string;

  @ApiPropertyOptional({ example: 'Senior' })
  @IsString()
  @IsOptional()
  experienceLevel?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsNumber()
  @IsOptional()
  openingsCount?: number;

  @ApiPropertyOptional({ example: '$130,000 - $170,000' })
  @IsString()
  @IsOptional()
  salaryRange?: string;

  @ApiPropertyOptional({ example: 'Build and deploy enterprise AI infrastructure.' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: ['Python', 'PyTorch', 'NestJS'] })
  @IsArray()
  @IsOptional()
  skillsRequired?: string[];
}
