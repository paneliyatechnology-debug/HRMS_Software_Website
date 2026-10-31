import { Controller, Get, Put, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'List all notifications',
    description: 'Retrieves notification center messages for attendance, leaves, announcements, and payroll.',
  })
  @ApiResponse({ status: 200, description: 'List of notifications' })
  findAll(@Req() req: any) {
    return this.notifService.findAll(req.user);
  }

  @Put(':id/read')
  @ApiOperation({
    summary: 'Mark specific notification as read',
    description: 'Updates notification read state.',
  })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  markAsRead(@Param('id') id: string, @Req() req: any) {
    return this.notifService.markAsRead(id, req.user);
  }

  @Put('mark-all-read')
  @ApiOperation({
    summary: 'Mark all notifications as read',
    description: 'Dismisses all unread notification badges.',
  })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  markAllAsRead(@Req() req: any) {
    return this.notifService.markAllAsRead(req.user);
  }
}
