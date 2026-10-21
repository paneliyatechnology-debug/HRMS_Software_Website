import { Controller, Get, Put, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service.js';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'List all notifications',
    description: 'Retrieves notification center messages for attendance, leaves, announcements, and payroll.',
  })
  @ApiResponse({ status: 200, description: 'List of notifications' })
  findAll() {
    return this.notifService.findAll();
  }

  @Put(':id/read')
  @ApiOperation({
    summary: 'Mark specific notification as read',
    description: 'Updates notification read state.',
  })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  markAsRead(@Param('id') id: string) {
    return this.notifService.markAsRead(id);
  }

  @Put('mark-all-read')
  @ApiOperation({
    summary: 'Mark all notifications as read',
    description: 'Dismisses all unread notification badges.',
  })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  markAllAsRead() {
    return this.notifService.markAllAsRead();
  }
}
