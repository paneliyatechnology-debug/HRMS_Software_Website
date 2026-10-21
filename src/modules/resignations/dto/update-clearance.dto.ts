import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ExitClearanceChecklistDto {
  @ApiPropertyOptional({ example: true, description: 'Department handoff completed' })
  @IsBoolean()
  @IsOptional()
  departmentClearance?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Company laptop/assets surrendered' })
  @IsBoolean()
  @IsOptional()
  assetReturned?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Final dues and payroll settled' })
  @IsBoolean()
  @IsOptional()
  financeSettlement?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Exit survey and interview conducted' })
  @IsBoolean()
  @IsOptional()
  exitInterviewCompleted?: boolean;
}

export class UpdateClearanceDto {
  @ApiPropertyOptional({ type: ExitClearanceChecklistDto })
  @IsOptional()
  clearance?: ExitClearanceChecklistDto;

  @ApiPropertyOptional({ example: 'HR Admin' })
  @IsString()
  @IsOptional()
  actorName?: string;
}
