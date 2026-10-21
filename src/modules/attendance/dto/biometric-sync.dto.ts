import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BiometricLogItemDto {
  @ApiProperty({ example: 'ZK-DEV-01', description: 'Biometric hardware reader ID' })
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @ApiProperty({ example: 'EMP-1', description: 'Employee badge/code' })
  @IsString()
  @IsNotEmpty()
  employeeCode: string;

  @ApiProperty({ example: '2026-10-21T09:12:00', description: 'Punch ISO timestamp' })
  @IsString()
  @IsNotEmpty()
  punchTime: string;

  @ApiPropertyOptional({ enum: ['IN', 'OUT'], example: 'IN' })
  @IsString()
  @IsOptional()
  type?: 'IN' | 'OUT';
}

export class BiometricSyncDto {
  @ApiPropertyOptional({ example: 'GATE-01-TERMINAL' })
  @IsString()
  @IsOptional()
  deviceId?: string;

  @ApiProperty({ type: [BiometricLogItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BiometricLogItemDto)
  logs: BiometricLogItemDto[];
}
