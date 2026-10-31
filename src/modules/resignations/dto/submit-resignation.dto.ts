import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class SubmitResignationDto {
  @ApiProperty({ example: 'user-1793009147556', description: 'User ID submitting resignation (from users table)' })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ example: 'user-1793009147556', description: 'User ID (legacy field)' })
  @IsString()
  @IsOptional()
  employeeId?: string;

  @ApiPropertyOptional({ example: 30, description: 'Agreed notice period days (defaults to 30)' })
  @IsNumber()
  @IsOptional()
  noticePeriodDays?: number;

  @ApiProperty({ example: 'Relocating to another city for family reasons', description: 'Reason for resignation' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
