import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryAdminsDto {
  @ApiPropertyOptional({
    example: 'ravi',
    description: 'Search string matching firstName, lastName, or email',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    example: 'cmp-1',
    description: 'Filter admins by associated Company ID or Code',
  })
  @IsString()
  @IsOptional()
  companyId?: string;

  @ApiPropertyOptional({
    example: 'Active',
    description: 'Filter admins by account status (Active, Inactive, Suspended)',
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Set to true to also include Super Admin accounts in the list',
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeSuperAdmins?: boolean;

  @ApiPropertyOptional({ example: 1, description: 'Page number' })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ example: 20, description: 'Records per page' })
  @IsOptional()
  limit?: number;
}
