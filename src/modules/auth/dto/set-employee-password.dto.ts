import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetEmployeePasswordDto {
  @ApiProperty({
    description: 'One-time secure password setup token received in the invitation email',
    example: 'a1b2c3d4e5f60718293a4b5c6d7e8f90...',
  })
  @IsNotEmpty({ message: 'Invitation token is required' })
  @IsString()
  token: string;

  @ApiProperty({
    description: 'New password for the employee account (minimum 8 characters)',
    example: 'SecureEmployeeP@ss123',
    minLength: 8,
  })
  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;
}

