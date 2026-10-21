import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CheckOutDto {
  @ApiProperty({ example: 'emp-1', description: 'Employee ID clocking out' })
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiPropertyOptional({ example: 'Shift completed', description: 'Optional clock-out remarks' })
  @IsString()
  @IsOptional()
  remarks?: string;
}
