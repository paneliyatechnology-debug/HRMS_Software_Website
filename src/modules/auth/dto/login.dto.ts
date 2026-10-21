import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'keyur.sangani1234@gmail.com',
    description: 'Registered user work email address',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'Admin@123',
    description: 'User password (optional for demo accounts)',
    required: false,
  })
  @IsString()
  @IsOptional()
  password?: string;
}
