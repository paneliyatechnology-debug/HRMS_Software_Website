import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ConvertCandidateDto {
  @ApiPropertyOptional({ example: 'HR Admin', description: 'Actor performing conversion' })
  @IsString()
  @IsOptional()
  actorName?: string;
}
