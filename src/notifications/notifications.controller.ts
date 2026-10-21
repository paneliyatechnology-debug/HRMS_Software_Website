import { Controller, Get, Put, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service.js';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List all notifications' })
  findAll() {
    return this.notifService.findAll();
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark specific notification as read' })
  markAsRead(@Param('id') id: string) {
    return this.notifService.markAsRead(id);
  }

  @Put('mark-all-read')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllAsRead() {
    return this.notifService.markAllAsRead();
  }
}
