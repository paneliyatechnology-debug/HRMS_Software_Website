import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class StartWorkDto {
  @ApiProperty({
    example: 21.17024,
    description: 'Current latitude obtained from GPS (-90 to 90)',
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'latitude must be a valid number' })
  @Min(-90, { message: 'latitude must be >= -90' })
  @Max(90, { message: 'latitude must be <= 90' })
  latitude: number;

  @ApiProperty({
    example: 72.831061,
    description: 'Current longitude obtained from GPS (-180 to 180)',
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'longitude must be a valid number' })
  @Min(-180, { message: 'longitude must be >= -180' })
  @Max(180, { message: 'longitude must be <= 180' })
  longitude: number;

  @ApiPropertyOptional({
    example: 15.5,
    description: 'GPS accuracy radius in meters (from geolocation API)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'accuracy must be a valid number' })
  @Min(0, { message: 'accuracy must be >= 0' })
  accuracy?: number;

  @ApiPropertyOptional({
    example: 'data:image/jpeg;base64,...',
    description: 'Start selfie image as base64 data URI or uploaded image reference',
  })
  @IsOptional()
  @IsString()
  selfie?: string;

  @ApiPropertyOptional({
    example: 'Chrome 122 on Windows 11',
    description: 'Optional browser / device identifier',
  })
  @IsOptional()
  @IsString()
  deviceInfo?: string;

  @ApiPropertyOptional({
    example: 'loc-1',
    description: 'Specific authorized office location ID (if employee works at multiple offices)',
  })
  @IsOptional()
  @IsString()
  officeLocationId?: string;
}

