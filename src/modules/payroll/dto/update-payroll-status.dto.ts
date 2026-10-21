import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdatePayrollStatusDto {
  @ApiProperty({
    enum: ['Draft', 'Approved', 'Processed', 'Paid'],
    example: 'Paid',
    description: 'Updated lifecycle state of payroll disbursement',
  })
  @IsIn(['Draft', 'Approved', 'Processed', 'Paid'])
  @IsNotEmpty()
  status: 'Draft' | 'Approved' | 'Processed' | 'Paid';

  @ApiPropertyOptional({ example: 'Finance Admin', description: 'User performing change' })
  @IsString()
  @IsOptional()
  actorName?: string;
}
