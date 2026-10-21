import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class QueryLeaveDto {
  @ApiPropertyOptional({ description: 'Filter leaves by Employee ID' })
  @IsString()
  @IsOptional()
  employeeId?: string;

  @ApiPropertyOptional({ description: 'Filter by leave status (Pending, Approved, Rejected)' })
  @IsString()
  @IsOptional()
  status?: string;
}
