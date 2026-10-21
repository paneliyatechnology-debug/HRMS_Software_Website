import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
} from 'class-validator';
import { EmployeeStatus } from '../../../common/types.js';

export class SalaryDto {
  @ApiPropertyOptional({ example: 5000 })
  @IsNumber()
  @IsOptional()
  basic?: number;

  @ApiPropertyOptional({ example: 2000 })
  @IsNumber()
  @IsOptional()
  hra?: number;

  @ApiPropertyOptional({ example: 1200 })
  @IsNumber()
  @IsOptional()
  allowances?: number;

  @ApiPropertyOptional({ example: 500 })
  @IsNumber()
  @IsOptional()
  bonus?: number;

  @ApiPropertyOptional({ example: 600 })
  @IsNumber()
  @IsOptional()
  pf?: number;

  @ApiPropertyOptional({ example: 750 })
  @IsNumber()
  @IsOptional()
  tax?: number;
}

export class EmergencyContactDto {
  @ApiPropertyOptional({ example: 'Sarah Jenkins' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'Spouse' })
  @IsString()
  @IsOptional()
  relationship?: string;

  @ApiPropertyOptional({ example: '+1 (555) 999-9999' })
  @IsString()
  @IsOptional()
  phone?: string;
}

export class BankDetailsDto {
  @ApiPropertyOptional({ example: 'Silicon Valley Bank' })
  @IsString()
  @IsOptional()
  bankName?: string;

  @ApiPropertyOptional({ example: '99201948191' })
  @IsString()
  @IsOptional()
  accountNumber?: string;

  @ApiPropertyOptional({ example: 'SVB00129' })
  @IsString()
  @IsOptional()
  ifscOrRouting?: string;

  @ApiPropertyOptional({ example: 'Alex Morgan' })
  @IsString()
  @IsOptional()
  accountHolderName?: string;
}

export class CreateEmployeeDto {
  @ApiPropertyOptional({ example: 'EMP-105', description: 'Employee unique identity code' })
  @IsString()
  @IsOptional()
  employeeCode?: string;

  @ApiProperty({ example: 'David', description: 'First name' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Miller', description: 'Last name' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'david.miller@paneliya.com', description: 'Corporate email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: '+1 (555) 234-5678', description: 'Contact phone number' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ enum: ['Male', 'Female', 'Other'], example: 'Male' })
  @IsOptional()
  gender?: 'Male' | 'Female' | 'Other';

  @ApiPropertyOptional({ example: '1992-06-15' })
  @IsString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: 'dept-1', description: 'Department ID' })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({ example: 'des-4', description: 'Designation ID' })
  @IsString()
  @IsOptional()
  designationId?: string;

  @ApiPropertyOptional({ example: 'loc-1', description: 'Work Location ID' })
  @IsString()
  @IsOptional()
  workLocationId?: string;

  @ApiPropertyOptional({ example: '2026-02-01', description: 'Joining date (YYYY-MM-DD)' })
  @IsString()
  @IsOptional()
  joiningDate?: string;

  @ApiPropertyOptional({
    enum: ['Full-time', 'Remote', 'Part-time', 'Contractual', 'Hourly'],
    example: 'Full-time',
  })
  @IsOptional()
  employmentType?: 'Full-time' | 'Remote' | 'Part-time' | 'Contractual' | 'Hourly';

  @ApiPropertyOptional({ enum: EmployeeStatus, example: EmployeeStatus.ACTIVE })
  @IsEnum(EmployeeStatus)
  @IsOptional()
  status?: EmployeeStatus;

  @ApiPropertyOptional({ example: 'emp-1' })
  @IsString()
  @IsOptional()
  reportingManagerId?: string;

  @ApiPropertyOptional({ example: 'Sarah Connor' })
  @IsString()
  @IsOptional()
  reportingManagerName?: string;

  @ApiPropertyOptional({ example: ['TypeScript', 'NestJS', 'PostgreSQL'] })
  @IsArray()
  @IsOptional()
  skills?: string[];

  @ApiPropertyOptional({ type: () => SalaryDto })
  @IsOptional()
  salary?: SalaryDto;

  @ApiPropertyOptional({ type: () => EmergencyContactDto })
  @IsOptional()
  emergencyContact?: EmergencyContactDto;

  @ApiPropertyOptional({ type: () => BankDetailsDto })
  @IsOptional()
  bankDetails?: BankDetailsDto;
}
