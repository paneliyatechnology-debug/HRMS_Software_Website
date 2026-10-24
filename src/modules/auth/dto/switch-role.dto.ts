import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import { Role } from '../../../common/types.js';

export class SwitchRoleDto {
  @ApiProperty({
    enum: Role,
    example: Role.ADMIN,
    description: 'Target RBAC role: SUPER_ADMIN, ADMIN, or EMPLOYEE',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase().trim() : value))
  @IsEnum(Role)
  @IsNotEmpty()
  role: Role;
}
