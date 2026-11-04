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
import { isNotificationRecipient } from '../notifications/notifications.service.js';

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

  @SubscribeMessage('register')
  @SubscribeMessage('authenticate')
  handleRegister(client: Socket, data: any) {
    if (data) {
      client.data.userId = data.userId || data.id;
      client.data.employeeId = data.employeeId;
      client.data.companyId = data.companyId;
      client.data.companyCode = data.companyCode;
      client.data.role = data.role;
      client.data.isSuperAdmin = data.role === 'SUPER_ADMIN' || data.isSuperAdmin === true;
    }
    return { status: 'registered' };
  }

  /**
   * Helper to selectively emit real-time events only to sockets whose registered user
   * passes the exact same HRMS recipient filtering rules.
   */
  public emitToAuthorizedSockets(
    eventName: string,
    payload: any,
    target: {
      module?: string;
      type?: string;
      companyId?: string | null;
      companyCode?: string | null;
      userId?: string | null;
    },
  ) {
    if (!this.server) return;
    const sockets = this.server.sockets?.sockets;
    if (!sockets || sockets.size === 0) return;

    for (const [_, client] of sockets) {
      const clientData = client.data || {};
      const clientUser = {
        id: clientData.userId,
        userId: clientData.userId,
        employeeId: clientData.employeeId,
        role: clientData.role,
        isSuperAdmin: clientData.role === 'SUPER_ADMIN' || clientData.isSuperAdmin === true,
        companyId: clientData.companyId,
        companyCode: clientData.companyCode,
      };

      // Disallow unregistered or unauthenticated sockets from receiving company events
      if (!clientUser.id && !clientUser.companyId && !clientUser.role) {
        continue;
      }

      if (!isNotificationRecipient(target, clientUser)) {
        continue;
      }

      client.emit(eventName, payload);
    }
  }

  /**
   * Broadcast an instant notification event to authorized recipients only
   */
  emitNotification(payload: {
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    module: string;
    companyId?: string | null;
    companyCode?: string | null;
    userId?: string | null;
    timestamp?: string;
  }) {
    if (this.server) {
      const fullPayload = {
        ...payload,
        timestamp: payload.timestamp || new Date().toISOString(),
      };

      this.emitToAuthorizedSockets('notification', fullPayload, {
        module: payload.module,
        companyId: payload.companyId,
        companyCode: payload.companyCode,
        userId: payload.userId,
      });

      this.logger.log(`Broadcasted real-time notification: [${payload.module}] ${payload.title}`);
    }
  }

  /**
   * Broadcast an event when attendance is punched
   */
  emitAttendancePunch(data: any) {
    if (this.server) {
      const target = {
        module: 'attendance',
        companyId: data.companyId,
        companyCode: data.companyCode,
        userId: data.employeeId,
      };

      this.emitToAuthorizedSockets('attendance_punched', data, target);

      this.emitNotification({
        title: 'Attendance Recorded',
        message: `${data.employeeName || 'An employee'} checked in at ${data.time || 'now'}.`,
        type: 'info',
        module: 'attendance',
        companyId: data.companyId,
        companyCode: data.companyCode,
        userId: data.employeeId,
      });
    }
  }

  /**
   * Broadcast leave status update
   */
  emitLeaveUpdate(data: any) {
    if (this.server) {
      const target = {
        module: 'leave',
        companyId: data.companyId,
        companyCode: data.companyCode,
        userId: data.userId,
      };

      this.emitToAuthorizedSockets('leave_updated', data, target);

      this.emitNotification({
        title: `Leave ${data.status}`,
        message: `Leave application for ${data.employeeName || 'employee'} was ${data.status.toLowerCase()}.`,
        type: data.status === 'Approved' ? 'success' : 'warning',
        module: 'leave',
        companyId: data.companyId,
        companyCode: data.companyCode,
        userId: data.userId,
      });
    }
  }

  /**
   * Broadcast announcement
   */
  emitAnnouncement(data: any) {
    if (this.server) {
      const target = {
        module: 'announcement',
        companyId: data.companyId,
        companyCode: data.companyCode,
      };

      this.emitToAuthorizedSockets('new_announcement', data, target);

      this.emitNotification({
        title: `New Announcement: ${data.title}`,
        message: data.content || 'A new company-wide announcement was published.',
        type: 'info',
        module: 'announcement',
        companyId: data.companyId,
        companyCode: data.companyCode,
      });
    }
  }
}
