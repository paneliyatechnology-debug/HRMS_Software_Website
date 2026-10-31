import { Controller, Get, Post, Body, Req, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AnnouncementsService } from './announcements.service.js';
import { CreateAnnouncementDto } from './dto/create-announcement.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';

@ApiTags('Announcements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly ancService: AnnouncementsService) {}

  @Get()
  @ApiOperation({
    summary: 'List company announcements',
    description: 'Retrieves all organization-wide broadcasts, notices, and bulletins for authenticated company.',
  })
  @ApiQuery({ name: 'companyId', required: false, description: 'Optional company filter for Super Admin' })
  @ApiResponse({ status: 200, description: 'List of announcements' })
  findAll(@Req() req: any, @Query('companyId') companyFilter?: string) {
    return this.ancService.findAll(req.user, companyFilter);
  }

  @Post()
  @ApiOperation({
    summary: 'Publish new company announcement',
    description: 'Broadcasts an announcement and triggers instant real-time WebSocket notifications.',
  })
  @ApiBody({ type: CreateAnnouncementDto })
  @ApiResponse({ status: 201, description: 'Announcement published successfully' })
  create(@Body() body: CreateAnnouncementDto, @Req() req: any) {
    return this.ancService.create(body, req.user);
  }
}
