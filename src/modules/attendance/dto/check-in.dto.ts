import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CheckInDto {
  @ApiProperty({ example: 'emp-1', description: 'Employee ID clocking in' })
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiPropertyOptional({ example: 'Work from office - morning shift', description: 'Optional punch notes' })
  @IsString()
  @IsOptional()
  remarks?: string;
}
