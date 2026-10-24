import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateSystemSettingsDto {
  @ApiPropertyOptional({ example: 'Paneliya Enterprise HRMS', description: 'Enterprise company name' })
  @IsString()
  @IsOptional()
  companyName?: string;

  @ApiPropertyOptional({ example: 'support@paneliya.com', description: 'System support and billing email' })
  @IsString()
  @IsOptional()
  supportEmail?: string;

  @ApiPropertyOptional({ example: 'Asia/Kolkata', description: 'Primary system time zone' })
  @IsString()
  @IsOptional()
  timeZone?: string;

  @ApiPropertyOptional({ example: 'INR', description: 'Default currency code' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: false, description: 'Maintenance mode toggle (restricts non-super-admins)' })
  @IsBoolean()
  @IsOptional()
  maintenanceMode?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Allow self-registration of employees' })
  @IsBoolean()
  @IsOptional()
  allowRegistration?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Enforce two-factor authentication for admins' })
  @IsBoolean()
  @IsOptional()
  twoFactorAuthEnforced?: boolean;

  @ApiPropertyOptional({ example: 120, description: 'Session timeout in minutes' })
  @IsNumber()
  @IsOptional()
  sessionTimeoutMinutes?: number;
}
