import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { Role } from '../../../common/types.js';

export class QuerySuperAdminUsersDto {
  @ApiPropertyOptional({
    example: 'keyur',
    description: 'Search string matching firstName, lastName, or email',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    enum: Role,
    example: Role.SUPER_ADMIN,
    description: 'Filter users by Role (SUPER_ADMIN, ADMIN, or EMPLOYEE)',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase().trim() : value))
  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @ApiPropertyOptional({
    example: 'Active',
    description: 'Filter users by status (Active, Suspended, Inactive)',
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Filter only Super Admin users',
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isSuperAdmin?: boolean;

  @ApiPropertyOptional({ example: 1, description: 'Page number' })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ example: 20, description: 'Records per page' })
  @IsOptional()
  limit?: number;
}
