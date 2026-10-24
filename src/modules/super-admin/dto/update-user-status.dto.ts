import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsIn } from 'class-validator';

export class UpdateUserStatusDto {
  @ApiProperty({
    example: 'Suspended',
    description: 'New account status',
    enum: ['Active', 'Suspended', 'Inactive'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['Active', 'Suspended', 'Inactive'])
  status: 'Active' | 'Suspended' | 'Inactive';

  @ApiPropertyOptional({
    example: 'Temporary audit review',
    description: 'Reason for changing status',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
