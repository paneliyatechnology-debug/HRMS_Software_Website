import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEmail, IsEnum } from 'class-validator';

export class UpdateCompanyDto {
  @ApiPropertyOptional({ example: 'ABC Technologies Pvt Ltd' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ example: 'ABC Technologies' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'support@abctech.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+91 99999 88888' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Tower B, Surat, Gujarat' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Active', enum: ['Active', 'Inactive'] })
  @IsOptional()
  @IsEnum(['Active', 'Inactive'])
  status?: 'Active' | 'Inactive';

  @ApiPropertyOptional({ example: 'user-1793000000000', description: 'Assigned Admin user ID' })
  @IsOptional()
  @IsString()
  adminUserId?: string;
}
