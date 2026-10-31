import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'keyur@gmail.com',
    description: 'Registered user work email address OR mobile/phone number',
    required: false,
  })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty({
    example: '+1 (555) 234-5678',
    description: 'User registered mobile or phone number',
    required: false,
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({
    example: 'keyur@gmail.com',
    description: 'Unified login identifier (can be email or mobile number)',
    required: false,
  })
  @IsString()
  @IsOptional()
  identifier?: string;

  @ApiProperty({
    example: 'Keyur@123',
    description: 'User password (optional for demo accounts)',
    required: false,
  })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiProperty({
    example: 'CMP-000001',
    description: 'Company Code to select specific company when identifier belongs to multiple companies',
    required: false,
  })
  @IsString()
  @IsOptional()
  companyCode?: string;

  @ApiProperty({
    example: 'cmp-1',
    description: 'Company ID (optional alternative to companyCode)',
    required: false,
  })
  @IsString()
  @IsOptional()
  companyId?: string;
}
