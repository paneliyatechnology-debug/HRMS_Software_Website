import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateTrainingProgramDto {
  @ApiProperty({ example: 'Advanced System Design with NestJS', description: 'Course title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'Master clean architecture, microservices, and distributed events' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'Alex Morgan' })
  @IsString()
  @IsOptional()
  trainerName?: string;

  @ApiPropertyOptional({ example: ['NestJS', 'TypeScript', 'Clean Architecture'] })
  @IsArray()
  @IsOptional()
  skillsCovered?: string[];

  @ApiPropertyOptional({ example: '2026-11-10' })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-11-20' })
  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ example: 16 })
  @IsNumber()
  @IsOptional()
  durationHours?: number;
}
