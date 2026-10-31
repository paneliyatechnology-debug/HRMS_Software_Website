import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UploadDocumentDto {
  @ApiProperty({ type: 'string', format: 'binary', description: 'Document physical file (PDF, Word, or image)' })
  file: any;

  @ApiPropertyOptional({ example: 'user-1793009147556', description: 'User ID (from users table)' })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ example: 'user-1793009147556', description: 'User ID (legacy field)' })
  @IsString()
  @IsOptional()
  employeeId?: string;

  @ApiPropertyOptional({ example: 'Government Issued ID Card' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ example: 'ID Proof' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ example: '2030-01-01' })
  @IsString()
  @IsOptional()
  expiryDate?: string;
}
