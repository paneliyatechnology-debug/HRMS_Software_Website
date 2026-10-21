import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AnnouncementsService } from './announcements.service.js';
import { Announcement } from '../common/types.js';

@ApiTags('Announcements')
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly ancService: AnnouncementsService) {}

  @Get()
  @ApiOperation({ summary: 'List company announcements' })
  findAll() {
    return this.ancService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Publish new company announcement' })
  create(@Body() body: Partial<Announcement>) {
    return this.ancService.create(body);
  }
}
