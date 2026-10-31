import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateAdminDto {
  @ApiPropertyOptional({ example: 'Ravi', description: 'First name' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Patel', description: 'Last name' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({
    example: 'ravi.admin@paneliya.com',
    description: 'Updated corporate email address',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    example: 'NewAdminPass@123',
    description: 'New login password (minimum 6 characters)',
    minLength: 6,
  })
  @IsString()
  @IsOptional()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({ example: '+91 98765 43210', description: 'Contact phone number' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    example: 'cmp-1',
    description: 'Reassigned Company ID or Company Code',
  })
  @IsString()
  @IsOptional()
  companyId?: string;

  @ApiPropertyOptional({
    example: 'Active',
    enum: ['Active', 'Inactive', 'Suspended'],
    description: 'Account operational status',
  })
  @IsOptional()
  @IsEnum(['Active', 'Inactive', 'Suspended'])
  status?: string;
}
