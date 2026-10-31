import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AssignAssetDto {
  @ApiProperty({ example: 'user-1793009147556', description: 'User ID receiving asset (from users table)' })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ example: 'user-1793009147556', description: 'User ID receiving asset (legacy field)' })
  @IsString()
  @IsOptional()
  employeeId?: string;

  @ApiPropertyOptional({ example: 'IT Admin' })
  @IsString()
  @IsOptional()
  actorName?: string;
}
