import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RejectLeaveDto {
  @ApiPropertyOptional({ example: 'Sarah Jenkins', description: 'Approver display name' })
  @IsString()
  @IsOptional()
  approverName?: string;

  @ApiPropertyOptional({ example: 'Critical sprint delivery milestone during requested dates', description: 'Reason for rejection' })
  @IsString()
  @IsOptional()
  reason?: string;
}
