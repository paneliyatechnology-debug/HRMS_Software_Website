import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAnnouncementDto {
  @ApiProperty({ example: 'Annual Paneliya Tech Summit 2026', description: 'Announcement title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 'All team members are invited to register for keynote tracks.',
    description: 'Announcement detailed message',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({
    enum: ['All', 'Department', 'Management'],
    example: 'All',
    description: 'Target audience',
  })
  @IsIn(['All', 'Department', 'Management'])
  @IsOptional()
  targetAudience?: 'All' | 'Department' | 'Management';

  @ApiPropertyOptional({ enum: ['Low', 'Medium', 'High'], example: 'High' })
  @IsIn(['Low', 'Medium', 'High'])
  @IsOptional()
  priority?: 'Low' | 'Medium' | 'High';

  @ApiPropertyOptional({ example: 'HR Director' })
  @IsString()
  @IsOptional()
  authorName?: string;
}
