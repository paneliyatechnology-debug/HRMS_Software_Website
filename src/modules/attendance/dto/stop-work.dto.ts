import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class StopWorkDto {
  @ApiPropertyOptional({
    example: 21.17024,
    description: 'Optional latitude obtained from GPS (-90 to 90)',
  })
  @IsOptional()
  latitude?: any;

  @ApiPropertyOptional({
    example: 72.831061,
    description: 'Optional longitude obtained from GPS (-180 to 180)',
  })
  @IsOptional()
  longitude?: any;

  @ApiPropertyOptional({
    example: 12.0,
    description: 'Optional GPS accuracy radius in meters',
  })
  @IsOptional()
  accuracy?: any;

  @ApiPropertyOptional({
    example: '',
    description: 'Optional stop selfie image as base64 data URI or uploaded image reference',
  })
  @IsOptional()
  selfie?: any;

  @ApiPropertyOptional({
    example: 'Chrome 122 on Windows 11',
    description: 'Optional browser / device identifier',
  })
  @IsOptional()
  @IsString()
  deviceInfo?: string;

  @ApiPropertyOptional({
    example: 'Finished client sprint deliverables for the day',
    description: 'Optional punch-out remarks',
  })
  @IsOptional()
  @IsString()
  remarks?: string;
}


