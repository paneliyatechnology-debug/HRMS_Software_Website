import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GeneratePayrollDto {
  @ApiProperty({ example: '2026-10', description: 'Payroll cycle month in YYYY-MM format' })
  @IsString()
  @IsNotEmpty()
  month: string;

  @ApiPropertyOptional({ example: 'Finance Admin', description: 'Actor initiating batch generation' })
  @IsString()
  @IsOptional()
  actorName?: string;
}
