import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AttendanceStatus } from '../../../common/types.js';

export class AdminManualAttendanceDto {
  @ApiPropertyOptional({ example: 'user-1793190505324', description: 'User ID' })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ example: 'user-1793190505324', description: 'Employee ID' })
  @IsString()
  @IsOptional()
  employeeId?: string;

  @ApiProperty({ example: '2026-10-30', description: 'Attendance date (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty()
  date: string;

  @ApiPropertyOptional({ example: '09:00 AM', description: 'Punch-in time' })
  @IsString()
  @IsOptional()
  checkIn?: string;

  @ApiPropertyOptional({ example: '06:00 PM', description: 'Punch-out time' })
  @IsString()
  @IsOptional()
  checkOut?: string;

  @ApiProperty({
    enum: AttendanceStatus,
    example: AttendanceStatus.PRESENT,
    description: 'Attendance status',
  })
  @IsEnum(AttendanceStatus)
  @IsNotEmpty()
  status: AttendanceStatus;

  @ApiPropertyOptional({ example: 'Regularized after biometric sync delay', description: 'Administrative note' })
  @IsString()
  @IsOptional()
  notes?: string;
}

