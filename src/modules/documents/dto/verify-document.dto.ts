import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class VerifyDocumentDto {
  @ApiPropertyOptional({
    enum: ['Verified', 'Rejected'],
    example: 'Verified',
    description: 'Verification status. Defaults to "Verified" if omitted.',
    default: 'Verified',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'HR Admin', description: 'Name of the verifying admin' })
  @IsString()
  @IsOptional()
  verifiedBy?: string;

  @ApiPropertyOptional({ example: 'Document illegible or expired', description: 'Optional rejection reason' })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ example: 'Document illegible or expired', description: 'Optional rejection reason' })
  @IsString()
  @IsOptional()
  rejectionReason?: string;
}
