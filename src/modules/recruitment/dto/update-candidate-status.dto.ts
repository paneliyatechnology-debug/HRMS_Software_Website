import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CandidateStatus } from '../../../common/types.js';

export class UpdateCandidateStatusDto {
  @ApiProperty({
    enum: CandidateStatus,
    example: CandidateStatus.INTERVIEW,
    description: 'Updated pipeline stage',
  })
  @IsEnum(CandidateStatus)
  @IsNotEmpty()
  status: CandidateStatus;

  @ApiPropertyOptional({ example: 'Lead Recruiter' })
  @IsString()
  @IsOptional()
  actorName?: string;
}
