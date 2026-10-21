import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDocumentMetadataDto {
  @ApiProperty({ example: 'emp-1', description: 'Employee ID' })
  @IsString()
  @IsNotEmpty()
  employeeId: string;

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
