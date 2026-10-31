import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { LeaveType } from '../../../common/types.js';

export class ApplyLeaveDto {
  @ApiPropertyOptional({ example: 'user-1793190505324', description: 'User ID or Employee ID' })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ example: 'user-1793190505324', description: 'Employee ID' })
  @IsString()
  @IsOptional()
  employeeId?: string;

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
