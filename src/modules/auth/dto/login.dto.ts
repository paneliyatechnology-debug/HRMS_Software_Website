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
}
