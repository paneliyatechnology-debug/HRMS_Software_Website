import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateAdminDto {
  @ApiProperty({
    example: 'company.admin@paneliya.com',
    description: 'Corporate email address for the company admin',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'Admin@123',
    description: 'Login password for the administrator (minimum 6 characters)',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Ravi', description: 'First name' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Patel', description: 'Last name' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({
    example: 'cmp-1',
    description: 'Target Company ID or Company Code this admin will manage',
  })
  @IsString()
  @IsNotEmpty()
  companyId: string;

  @ApiPropertyOptional({ example: '+91 98765 43210', description: 'Contact phone number' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    example: 'Active',
    enum: ['Active', 'Inactive', 'Suspended'],
    default: 'Active',
    description: 'Account operational status',
  })
  @IsOptional()
  @IsEnum(['Active', 'Inactive', 'Suspended'])
  status?: string;
}
