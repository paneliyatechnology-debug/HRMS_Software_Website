import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ApproveLeaveDto {
  @ApiPropertyOptional({ example: 'HR_ADMIN', description: 'Approver role (HR_ADMIN or MANAGER)' })
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
