import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { LeaveStatus } from '../../../common/types.js';

export class LeaveOverrideDto {
  @ApiProperty({
    enum: [LeaveStatus.APPROVED, LeaveStatus.REJECTED],
    example: LeaveStatus.APPROVED,
    description: 'Direct Super Admin override decision (Approved or Rejected)',
  })
  @IsEnum(LeaveStatus)
  @IsNotEmpty()
  status: LeaveStatus;

  @ApiPropertyOptional({
    example: 'Direct Super Admin executive clearance',
    description: 'Override justification and audit remarks',
  })
  @IsString()
  @IsOptional()
  comments?: string;
}
