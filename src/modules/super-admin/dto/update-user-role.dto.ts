import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { Role } from '../../../common/types.js';

export class UpdateUserRoleDto {
  @ApiProperty({
    enum: Role,
    example: Role.SUPER_ADMIN,
    description: 'New role to assign to the user (SUPER_ADMIN, ADMIN, or EMPLOYEE)',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase().trim() : value))
  @IsEnum(Role)
  @IsNotEmpty()
  role: Role;

  @ApiPropertyOptional({
    example: true,
    description: 'Explicit Super Admin privilege flag (auto-set to true if role is SUPER_ADMIN)',
  })
  @IsBoolean()
  @IsOptional()
  isSuperAdmin?: boolean;
}
