import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { Role } from '../../../common/types.js';
import { Transform } from 'class-transformer';

export class CreateSuperAdminUserDto {
  @ApiProperty({
    example: 'superadmin.ops@paneliya.com',
    description: 'Corporate email address for the user',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'SuperSecret@123',
    description: 'Login password (minimum 6 characters)',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Sanjay', description: 'First name' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Patel', description: 'Last name' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiPropertyOptional({
    enum: Role,
    example: Role.SUPER_ADMIN,
    description: 'Role assigned to this user (SUPER_ADMIN, ADMIN, or EMPLOYEE)',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase().trim() : value))
  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @ApiPropertyOptional({
    example: true,
    description: 'Flag indicating if user has ultimate Super Admin privileges',
  })
  @IsBoolean()
  @IsOptional()
  isSuperAdmin?: boolean;

  @ApiPropertyOptional({
    example: 'Active',
    description: 'Account activation status (Active, Suspended, Inactive)',
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: '+91 98765 43210', description: 'Contact phone number' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'dept-1', description: 'Department ID' })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({ example: 'des-1', description: 'Designation ID' })
  @IsString()
  @IsOptional()
  designationId?: string;
}
