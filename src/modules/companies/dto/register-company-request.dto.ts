import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEmail, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterCompanyRequestDto {
  @ApiProperty({ example: 'Paneliya Infotech Pvt Ltd', description: 'Company Legal Name' })
  @IsNotEmpty({ message: 'Company Legal Name is required' })
  @IsString()
  @Transform(({ value, obj }) => (value || obj.companyName || '').trim())
  companyLegalName: string;

  @ApiPropertyOptional({ example: '24AAAAA0000A1Z5', description: '15-char GSTIN / Tax ID' })
  @IsOptional()
  @IsString()
  @Transform(({ value, obj }) => (value || obj.taxId || '').trim())
  gstin?: string;

  @ApiPropertyOptional({ example: 'Information Technology & Software', description: 'Industry Sector' })
  @IsOptional()
  @IsString()
  industrySector?: string;

  @ApiPropertyOptional({ example: '402, Ring Road', description: 'Office Address' })
  @IsOptional()
  @IsString()
  @Transform(({ value, obj }) => (value || obj.address || '').trim())
  officeAddress?: string;

  @ApiPropertyOptional({ example: 'Surat', description: 'City' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Gujarat', description: 'State' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ example: 'Ravi', description: 'Owner First Name' })
  @IsNotEmpty({ message: 'First name is required' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  firstName: string;

  @ApiProperty({ example: 'Paneliya', description: 'Owner Last Name' })
  @IsNotEmpty({ message: 'Last name is required' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  lastName: string;

  @ApiProperty({ example: 'owner@company.com', description: 'Official Owner Email' })
  @IsNotEmpty({ message: 'Official Owner Email is required' })
  @Transform(({ value, obj }) => {
    const raw = value || obj.email || obj.ownerEmail || obj.adminEmail || '';
    return typeof raw === 'string' ? raw.trim().toLowerCase() : raw;
  })
  @IsEmail({}, { message: 'Must be a valid email format' })
  officialEmail: string;

  @ApiProperty({ example: '9876543210', description: '10-digit Indian Mobile Number' })
  @IsNotEmpty({ message: 'Mobile Number is required' })
  @Transform(({ value, obj }) => {
    const raw = value || obj.phone || obj.mobile || '';
    return typeof raw === 'string' ? raw.trim().replace(/\D/g, '') : raw;
  })
  @IsString()
  mobileNumber: string;

  @ApiProperty({ example: 'Paneliya@123', description: 'Owner Password (Min 6 characters)' })
  @IsNotEmpty({ message: 'Password is required' })
  @Transform(({ value, obj }) => value || obj.ownerPassword || obj.adminPassword || '')
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @ApiPropertyOptional({ example: 'Paneliya@123', description: 'Repeat Password' })
  @IsOptional()
  @Transform(({ value, obj }) => value || obj.repeatPassword || '')
  confirmPassword?: string;
}

