import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsEnum,
} from 'class-validator';
import { Role } from '../../../common/types.js';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @ApiProperty({
    example: 'new.user@paneliya.com',
    description: 'Corporate or personal email address',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'Password@123',
    description: 'Login password (minimum 6 characters)',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'John', description: 'First name' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe', description: 'Last name' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiPropertyOptional({
    enum: Role,
    example: Role.EMPLOYEE,
    description: 'Role for this account: SUPER_ADMIN, ADMIN, or EMPLOYEE (defaults to EMPLOYEE)',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase().trim() : value))
  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @ApiPropertyOptional({ example: '+1 (555) 234-5678', description: 'Contact phone number' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'dept-1', description: 'Department ID' })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({ example: 'des-4', description: 'Designation ID' })
  @IsString()
  @IsOptional()
  designationId?: string;

  @ApiPropertyOptional({ example: 'cmp-1', description: 'Company ID (for ADMIN or EMPLOYEE)' })
  @IsString()
  @IsOptional()
  companyId?: string;
}
