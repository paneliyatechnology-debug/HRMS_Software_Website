import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class EnrollTrainingDto {
  @ApiProperty({ example: 'trn-1', description: 'Training Program ID' })
  @IsString()
  @IsNotEmpty()
  trainingId: string;

  @ApiProperty({ example: 'user-1793009147556', description: 'User ID (from users table)' })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ example: 'user-1793009147556', description: 'User ID (legacy field)' })
  @IsString()
  @IsOptional()
  employeeId?: string;
}
