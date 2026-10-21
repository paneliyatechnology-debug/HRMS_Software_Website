import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class UpdateSettingsDto {
  @ApiPropertyOptional({
    example: {
      name: 'Paneliya Technology Inc.',
      tagline: 'Enterprise Cloud & Next-Gen Software Engineering',
      currency: 'USD ($)',
    },
    description: 'Company profile attributes',
  })
  @IsOptional()
  company?: Record<string, any>;

  @ApiPropertyOptional({
    example: {
      workingHoursPerDay: 8,
      defaultShift: '09:00 AM - 06:00 PM',
      gracePeriodMinutes: 15,
    },
    description: 'Work schedule policies',
  })
  @IsOptional()
  workSchedule?: Record<string, any>;

  @ApiPropertyOptional({
    example: {
      casualLeaveAnnual: 12,
      sickLeaveAnnual: 10,
      paidLeaveAnnual: 15,
      carryForwardLimit: 5,
    },
    description: 'Leave allocation rules',
  })
  @IsOptional()
  leavePolicy?: Record<string, any>;

  @ApiPropertyOptional({
    example: {
      payCycle: 'Monthly',
      disbursementDate: 28,
      pfContributionPercent: 12,
    },
    description: 'Payroll policies',
  })
  @IsOptional()
  payrollPolicy?: Record<string, any>;
}
