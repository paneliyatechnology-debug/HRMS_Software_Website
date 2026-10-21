import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { LeaveType } from '../../../common/types.js';

export class ApplyLeaveDto {
  @ApiProperty({ example: 'emp-1', description: 'Employee ID' })
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty({ enum: LeaveType, example: LeaveType.CASUAL, description: 'Type of leave applied' })
  @IsEnum(LeaveType)
  @IsNotEmpty()
  leaveType: LeaveType;

  @ApiProperty({ example: '2026-11-01', description: 'Leave start date (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({ example: '2026-11-03', description: 'Leave end date (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty()
  endDate: string;

  @ApiPropertyOptional({ example: false, description: 'Is half-day leave?' })
  @IsBoolean()
  @IsOptional()
  isHalfDay?: boolean;

  @ApiProperty({ example: 'Attending personal family commitments', description: 'Reason for leave' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
