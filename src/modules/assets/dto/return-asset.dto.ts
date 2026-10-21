import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class ReturnAssetDto {
  @ApiPropertyOptional({
    enum: ['Excellent', 'Good', 'Fair', 'Damaged'],
    example: 'Good',
    description: 'Physical state upon return',
  })
  @IsIn(['Excellent', 'Good', 'Fair', 'Damaged'])
  @IsOptional()
  condition?: 'Excellent' | 'Good' | 'Fair' | 'Damaged';

  @ApiPropertyOptional({ example: 'IT Admin' })
  @IsString()
  @IsOptional()
  actorName?: string;
}
