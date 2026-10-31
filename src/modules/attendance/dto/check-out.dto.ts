import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CheckOutDto {
  @ApiProperty({ example: 'user-1793009147556', description: 'User ID clocking out (from users table)' })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ example: 'user-1793009147556', description: 'User ID clocking out (legacy field)' })
  @IsString()
  @IsOptional()
  employeeId?: string;

  @ApiPropertyOptional({ example: 'Shift completed', description: 'Optional clock-out remarks' })
  @IsString()
  @IsOptional()
  remarks?: string;
}
