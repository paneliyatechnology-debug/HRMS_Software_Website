import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsArray } from 'class-validator';

export class AddDesignationMemberDto {
  @ApiPropertyOptional({ example: 'user-1793766966909', description: 'Single User or Employee ID to assign' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ example: 'user-1793766966909', description: 'Alias for userId' })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional({
    example: ['user-1793766966909', 'user-1793792747562'],
    description: 'Array of User IDs for bulk assignment',
  })
  @IsOptional()
  @IsArray()
  userIds?: string[];
}

