import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEmail, IsEnum } from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty({ example: 'ABC Technologies', description: 'Official corporate legal name' })
  @IsNotEmpty({ message: 'Company name is required' })
  @IsString()
  companyName: string;

  @ApiPropertyOptional({ example: 'ABC Technologies', description: 'Alias or short name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'contact@abctech.com', description: 'Corporate contact email' })
  @IsOptional()
  @IsEmail({}, { message: 'Must be a valid email format' })
  email?: string;

  @ApiPropertyOptional({ example: '+91 98765 43210', description: 'Corporate contact phone' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Floor 5, IT Park, Surat, Gujarat, India', description: 'Corporate address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Active', enum: ['Active', 'Inactive'], default: 'Active' })
  @IsOptional()
  @IsEnum(['Active', 'Inactive'])
  status?: 'Active' | 'Inactive';

  // Optional: provision an admin at company creation time
  @ApiPropertyOptional({ example: 'admin@abctech.com', description: 'Email for initial company administrator' })
  @IsOptional()
  @IsEmail()
  adminEmail?: string;

  @ApiPropertyOptional({ example: 'Admin@123', description: 'Password for initial company administrator' })
  @IsOptional()
  @IsString()
  adminPassword?: string;

  @ApiPropertyOptional({ example: 'Rajesh', description: 'First name for company admin' })
  @IsOptional()
  @IsString()
  adminFirstName?: string;

  @ApiPropertyOptional({ example: 'Patel', description: 'Last name for company admin' })
  @IsOptional()
  @IsString()
  adminLastName?: string;
}
