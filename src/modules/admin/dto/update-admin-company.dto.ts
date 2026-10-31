import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEmail } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateAdminCompanyDto {
  @ApiPropertyOptional({ example: 'Paneliya Technologies Pvt Ltd', description: 'Company name' })
  @IsString()
  @IsOptional()
  companyName?: string;

  @ApiPropertyOptional({ example: 'contact@paneliya.com', description: 'Company official email' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '+91 98765 43210', description: 'Company phone' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'Surat, Gujarat, India', description: 'Corporate address' })
  @IsString()
  @IsOptional()
  address?: string;
}

