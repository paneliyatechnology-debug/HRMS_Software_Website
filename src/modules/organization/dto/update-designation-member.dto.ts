import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateDesignationMemberDto {
  @ApiPropertyOptional({ example: 'des-1793876053090', description: 'Reassign to another Designation ID' })
  @IsOptional()
  @IsString()
  designationId?: string;

  @ApiPropertyOptional({ example: 'dept-1793876075889', description: 'Update associated Department ID' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ example: 'Active', description: 'Update employee status (Active, Inactive, On Notice, etc.)' })
  @IsOptional()
  @IsString()
  status?: string;
}

