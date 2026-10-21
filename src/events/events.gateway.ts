import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger('EventsGateway');

  afterInit(server: Server) {
    this.logger.log('Enterprise WebSocket Gateway Initialized on port 4000');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to real-time events: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket, data: any) {
    return { event: 'pong', data: { timestamp: new Date().toISOString() } };
  }

  /**
   * Broadcast an instant notification event to all connected clients
   */
  emitNotification(payload: {
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    module: string;
    timestamp?: string;
  }) {
    if (this.server) {
      this.server.emit('notification', {
        ...payload,
        timestamp: payload.timestamp || new Date().toISOString(),
      });
      this.logger.log(`Broadcasted real-time notification: [${payload.module}] ${payload.title}`);
    }
  }

  /**
   * Broadcast an event when attendance is punched
   */
  emitAttendancePunch(data: any) {
    if (this.server) {
      this.server.emit('attendance_punched', data);
      this.emitNotification({
        title: 'Attendance Recorded',
        message: `${data.employeeName || 'An employee'} checked in at ${data.time || 'now'}.`,
        type: 'info',
        module: 'attendance',
      });
    }
  }

  /**
   * Broadcast leave status update
   */
  emitLeaveUpdate(data: any) {
    if (this.server) {
      this.server.emit('leave_updated', data);
      this.emitNotification({
        title: `Leave ${data.status}`,
        message: `Leave application for ${data.employeeName || 'employee'} was ${data.status.toLowerCase()}.`,
        type: data.status === 'Approved' ? 'success' : 'warning',
        module: 'leave',
      });
    }
  }

  /**
   * Broadcast announcement
   */
  emitAnnouncement(data: any) {
    if (this.server) {
      this.server.emit('new_announcement', data);
      this.emitNotification({
        title: `New Announcement: ${data.title}`,
        message: data.content || 'A new company-wide announcement was published.',
        type: 'info',
        module: 'announcement',
      });
    }
  }
}
