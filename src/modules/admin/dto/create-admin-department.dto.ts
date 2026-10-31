import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAdminDepartmentDto {
  @ApiProperty({ example: 'Human Resources', description: 'Department name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Handles employee onboarding, relations, and operations', description: 'Description' })
  @IsString()
  @IsOptional()
  description?: string;
}

