import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CheckInDto {
  @ApiProperty({ example: 'user-1793009147556', description: 'User ID clocking in (from users table)' })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ example: 'user-1793009147556', description: 'User ID clocking in (legacy field)' })
  @IsString()
  @IsOptional()
  employeeId?: string;

  @ApiPropertyOptional({ example: 'Work from office - morning shift', description: 'Optional punch notes' })
  @IsString()
  @IsOptional()
  remarks?: string;
}
