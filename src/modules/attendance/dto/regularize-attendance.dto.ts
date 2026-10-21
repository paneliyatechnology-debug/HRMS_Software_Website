import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AttendanceStatus } from '../../../common/types.js';

export class RegularizeAttendanceDto {
  @ApiProperty({ example: 'emp-1', description: 'Employee ID' })
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty({ example: '2026-10-21', description: 'Date of attendance record (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({ example: '09:00 AM', description: 'Adjusted check-in time' })
  @IsString()
  @IsNotEmpty()
  checkIn: string;

  @ApiPropertyOptional({ example: '06:00 PM', description: 'Adjusted check-out time' })
  @IsString()
  @IsOptional()
  checkOut?: string;

  @ApiProperty({ enum: AttendanceStatus, example: AttendanceStatus.PRESENT })
  @IsEnum(AttendanceStatus)
  @IsNotEmpty()
  status: AttendanceStatus;

  @ApiProperty({ example: 'Missed punch due to biometric maintenance', description: 'Regularization reason' })
  @IsString()
  @IsNotEmpty()
  remarks: string;
}
