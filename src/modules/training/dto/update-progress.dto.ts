import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, Max, Min } from 'class-validator';

export class UpdateTrainingProgressDto {
  @ApiProperty({ example: 75, description: 'Course completion percentage (0 - 100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsNotEmpty()
  progressPercent: number;
}
