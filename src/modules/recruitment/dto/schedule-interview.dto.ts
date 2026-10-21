import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ScheduleInterviewDto {
  @ApiProperty({ example: 'Technical Architecture Round', description: 'Interview round title' })
  @IsString()
  @IsNotEmpty()
  round: string;

  @ApiProperty({ example: 'David Miller (Lead Architect)', description: 'Assigned interviewer' })
  @IsString()
  @IsNotEmpty()
  interviewerName: string;

  @ApiProperty({ example: '2026-10-25 10:00 AM PST', description: 'Scheduled date and time' })
  @IsString()
  @IsNotEmpty()
  scheduledAt: string;
}
