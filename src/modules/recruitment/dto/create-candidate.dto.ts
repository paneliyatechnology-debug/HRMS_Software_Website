import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCandidateDto {
  @ApiProperty({ example: 'job-1', description: 'Associated Job Opening ID' })
  @IsString()
  @IsNotEmpty()
  jobId: string;

  @ApiPropertyOptional({ example: 'Senior Full Stack Engineer' })
  @IsString()
  @IsOptional()
  jobTitle?: string;

  @ApiProperty({ example: 'Lucas Scott', description: 'Full applicant name' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'lucas.scott@example.com', description: 'Contact email' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: '+1 (555) 789-0123' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: '/resumes/lucas-scott.pdf' })
  @IsString()
  @IsOptional()
  resumeUrl?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsNumber()
  @IsOptional()
  experienceYears?: number;

  @ApiPropertyOptional({ example: 'Acme Corp' })
  @IsString()
  @IsOptional()
  currentCompany?: string;

  @ApiPropertyOptional({ example: ['React', 'Node.js', 'PostgreSQL'] })
  @IsArray()
  @IsOptional()
  skills?: string[];

  @ApiPropertyOptional({ example: 'LinkedIn' })
  @IsString()
  @IsOptional()
  source?: string;

  @ApiPropertyOptional({ example: 'Strong portfolio and open source contributor.' })
  @IsString()
  @IsOptional()
  notes?: string;
}
