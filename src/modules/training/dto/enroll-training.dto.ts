import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class EnrollTrainingDto {
  @ApiProperty({ example: 'trn-1', description: 'Training Program ID' })
  @IsString()
  @IsNotEmpty()
  trainingId: string;

  @ApiProperty({ example: 'emp-1', description: 'Employee ID' })
  @IsString()
  @IsNotEmpty()
  employeeId: string;
}
