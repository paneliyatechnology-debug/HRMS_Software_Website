import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAssetDto {
  @ApiPropertyOptional({ example: 'AST-101', description: 'Unique asset inventory tag' })
  @IsString()
  @IsOptional()
  assetCode?: string;

  @ApiProperty({ example: 'MacBook Pro M3 Max 16"', description: 'Asset device model/name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    enum: ['Laptop', 'Monitor', 'Mobile', 'Access Card', 'Vehicle', 'Other'],
    example: 'Laptop',
    description: 'Category',
  })
  @IsIn(['Laptop', 'Monitor', 'Mobile', 'Access Card', 'Vehicle', 'Other'])
  @IsNotEmpty()
  category: 'Laptop' | 'Monitor' | 'Mobile' | 'Access Card' | 'Vehicle' | 'Other';

  @ApiPropertyOptional({ example: 'C02G879QMD6T' })
  @IsString()
  @IsOptional()
  serialNumber?: string;

  @ApiPropertyOptional({
    enum: ['Excellent', 'Good', 'Fair', 'Damaged'],
    example: 'Excellent',
  })
  @IsIn(['Excellent', 'Good', 'Fair', 'Damaged'])
  @IsOptional()
  condition?: 'Excellent' | 'Good' | 'Fair' | 'Damaged';

  @ApiPropertyOptional({ example: '2026-01-15' })
  @IsString()
  @IsOptional()
  purchaseDate?: string;
}
