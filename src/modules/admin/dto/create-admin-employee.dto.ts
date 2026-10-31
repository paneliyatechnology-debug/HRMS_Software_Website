import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateAdminEmployeeDto {
  @ApiProperty({ example: 'Ravi', description: 'First name' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Patel', description: 'Last name' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'ravi.patel@company.com', description: 'Unique corporate email address' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: 'Employee@123', description: 'Initial login password' })
  @IsString()
  @IsOptional()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({ example: '+91 98765 43210', description: 'Contact phone number' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'dept-1', description: 'Department ID' })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({ example: 'desig-1', description: 'Designation ID' })
  @IsString()
  @IsOptional()
  designationId?: string;

  @ApiPropertyOptional({ example: '2026-11-01', description: 'Joining date (YYYY-MM-DD)' })
  @IsString()
  @IsOptional()
  joiningDate?: string;

  @ApiPropertyOptional({ example: 'Full-time', enum: ['Full-time', 'Part-time', 'Contract', 'Intern'] })
  @IsString()
  @IsOptional()
  employmentType?: string;

  @ApiPropertyOptional({ example: 'Male', enum: ['Male', 'Female', 'Other'] })
  @IsString()
  @IsOptional()
  gender?: string;

  @ApiPropertyOptional({ example: 'Surat, Gujarat, India', description: 'Residential address' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({
    example: { basic: 50000, hra: 20000, allowances: 10000 },
    description: 'Salary breakdown structure',
  })
  @IsOptional()
  salary?: any;
}

