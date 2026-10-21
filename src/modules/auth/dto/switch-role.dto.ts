import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { Role } from '../../../common/types.js';

export class SwitchRoleDto {
  @ApiProperty({
    enum: Role,
    example: Role.HR_ADMIN,
    description: 'Target RBAC role to emulate in demo testing mode',
  })
  @IsEnum(Role)
  @IsNotEmpty()
  role: Role;
}
