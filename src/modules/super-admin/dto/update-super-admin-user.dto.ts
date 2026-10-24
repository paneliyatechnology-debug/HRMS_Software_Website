import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { Role } from '../../../common/types.js';
import { Transform } from 'class-transformer';

export class UpdateSuperAdminUserDto {
  @ApiPropertyOptional({ example: 'Keyur', description: 'First name' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Sangani', description: 'Last name' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ example: 'keyur.sangani1234@gmail.com', description: 'Email address' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    enum: Role,
    example: Role.SUPER_ADMIN,
    description: 'System role for the user (SUPER_ADMIN, ADMIN, or EMPLOYEE)',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase().trim() : value))
  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @ApiPropertyOptional({
    example: true,
    description: 'Explicit Super Admin privilege flag',
  })
  @IsBoolean()
  @IsOptional()
  isSuperAdmin?: boolean;

  @ApiPropertyOptional({
    example: 'Active',
    description: 'User status (Active, Suspended, Inactive)',
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    example: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    description: 'Avatar image URL',
  })
  @IsString()
  @IsOptional()
  avatarUrl?: string;
}
