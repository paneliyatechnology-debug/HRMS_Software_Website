import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDocumentMetadataDto {
  @ApiPropertyOptional({ example: 'user-1793190505324', description: 'User ID' })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ example: 'user-1793190505324', description: 'Employee ID' })
  @IsString()
  @IsOptional()
  employeeId?: string;

  @ApiProperty({ example: 'Offer Letter - Signed', description: 'Document title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'Contracts', description: 'Category (ID Proof, Contracts, Certifications, etc.)' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ example: 'http://localhost:4000/uploads/documents/sample.pdf' })
  @IsString()
  @IsOptional()
  fileUrl?: string;

  @ApiPropertyOptional({ example: '1.2 MB' })
  @IsString()
  @IsOptional()
  fileSize?: string;

  @ApiPropertyOptional({ example: '2028-12-31', description: 'Document expiry date (if applicable)' })
  @IsString()
  @IsOptional()
  expiryDate?: string;
}
