import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateLeaveTypeDto {
  @ApiProperty({ example: 'Casual Leave', description: 'Name of the leave type' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'CL', description: 'Short code for the leave type' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ example: 'Standard casual leave allowance', description: 'Description of the leave policy' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 12, description: 'Annual quota in days', default: 12 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  daysAllowed?: number;

  @ApiPropertyOptional({ example: true, description: 'Whether this leave is paid', default: true })
  @IsBoolean()
  @IsOptional()
  isPaid?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Whether leave application requires manager/admin approval', default: true })
  @IsBoolean()
  @IsOptional()
  requiresApproval?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Whether unutilized leaves can carry forward to the next year', default: false })
  @IsBoolean()
  @IsOptional()
  carryForward?: boolean;

  @ApiPropertyOptional({ example: 0, description: 'Maximum days allowed to carry forward', default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxCarryForwardDays?: number;

  @ApiPropertyOptional({ example: 'Active', enum: ['Active', 'Inactive'], default: 'Active' })
  @IsString()
  @IsOptional()
  status?: 'Active' | 'Inactive';

  @ApiPropertyOptional({ example: '#3b82f6', description: 'Hex color badge code for UI' })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ example: 'cmp-1793694956491-ejyds', description: 'Optional companyId for Super Admin' })
  @IsString()
  @IsOptional()
  companyId?: string;
}

