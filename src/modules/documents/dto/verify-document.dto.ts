import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class VerifyDocumentDto {
  @ApiProperty({ enum: ['Verified', 'Rejected'], example: 'Verified' })
  @IsIn(['Verified', 'Rejected'])
  @IsNotEmpty()
  status: 'Verified' | 'Rejected';

  @ApiPropertyOptional({ example: 'HR Admin' })
  @IsString()
  @IsOptional()
  verifiedBy?: string;
}
