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
import { EmployeeStatus, Role } from '../../../common/types.js';
import { Transform } from 'class-transformer';

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
  @ApiProperty({ example: 'David', description: 'First name' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Miller', description: 'Last name' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'david.miller@paneliya.com', description: 'Corporate email address' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({
    example: 'Employee@123',
    description: 'Portal login password for the employee account',
  })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({
    enum: Role,
    example: Role.EMPLOYEE,
    description: 'Access role for login (SUPER_ADMIN, ADMIN, or EMPLOYEE)',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase().trim() : value))
  @IsEnum(Role)
  @IsOptional()
  role?: Role;

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

  @ApiPropertyOptional({ example: '100 Silicon Vista Blvd, San Francisco', description: 'Residential address' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', description: 'Avatar URL' })
  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @ApiPropertyOptional({ example: 'General Shift (9 AM - 6 PM)', description: 'Work shift' })
  @IsString()
  @IsOptional()
  shift?: string;

  @ApiPropertyOptional({ example: { taxId: 'TX-123456', panOrSsn: 'ABCDE1234F', taxRegime: 'New Regime' }, description: 'Tax information' })
  @IsOptional()
  taxInformation?: any;

  @ApiPropertyOptional({ example: [{ degree: 'B.S. in Computer Science', institution: 'University', year: 2022 }], description: 'Education history' })
  @IsOptional()
  education?: any[];

  @ApiPropertyOptional({ example: [{ company: 'Tech Inc', role: 'Developer', years: 3 }], description: 'Previous work experience' })
  @IsOptional()
  previousExperience?: any[];

  @ApiPropertyOptional({ example: 'cmp-1', description: 'Company ID (SuperAdmin only; for Admin it is automatically inferred)' })
  @IsString()
  @IsOptional()
  companyId?: string;
}
