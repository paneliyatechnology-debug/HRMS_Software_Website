import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Artificial Intelligence', description: 'Department name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'AI', description: 'Department code / abbreviation' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ example: 'emp-1', description: 'Department Head employee ID' })
  @IsString()
  @IsOptional()
  headEmployeeId?: string;

  @ApiPropertyOptional({ example: 'John Deo', description: 'Department Head name' })
  @IsString()
  @IsOptional()
  headName?: string;

  @ApiPropertyOptional({ example: 'Research and deployment of machine learning systems.' })
  @IsString()
  @IsOptional()
  description?: string;
}
