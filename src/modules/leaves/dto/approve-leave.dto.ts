import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ApproveLeaveDto {
  @ApiPropertyOptional({ example: 'ADMIN', description: 'Approver role (ADMIN or SUPER_ADMIN)' })
  @IsString()
  @IsOptional()
  role?: string;

  @ApiPropertyOptional({ example: 'Sarah Jenkins', description: 'Approver display name' })
  @IsString()
  @IsOptional()
  approverName?: string;

  @ApiPropertyOptional({ example: 'Approved as per leave policy', description: 'Optional approval comments' })
  @IsString()
  @IsOptional()
  comments?: string;
}
