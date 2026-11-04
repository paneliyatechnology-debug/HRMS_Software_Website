import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { Role, User, NotificationItem } from '../../common/types.js';

export interface NotificationTarget {
  id?: string;
  type?: string;
  module?: string;
  companyId?: string | null;
  companyCode?: string | null;
  userId?: string | null;
  [key: string]: any;
}

export interface RecipientUser {
  id?: string;
  userId?: string;
  employeeId?: string | null;
  role?: Role | string;
  isSuperAdmin?: boolean;
  companyId?: string | null;
  companyCode?: string | null;
  [key: string]: any;
}

/**
 * Universal HRMS Notification Recipient Filtering Rule Function.
 * Evaluates whether a given user context is an authorized recipient of a notification.
 * Applied identically across database queries, REST APIs, unread count, and WebSocket events.
 */
export function isNotificationRecipient(
  n: NotificationTarget,
  user?: RecipientUser | null,
): boolean {
  if (!user) return false;

  // 1. SUPER_ADMIN: Must never receive any notifications. Always zero.
  const roleUpper = (user.role || '').toUpperCase();
  if (
    roleUpper === 'SUPER_ADMIN' ||
    user.isSuperAdmin === true ||
    user.id === 'user-super-admin-paneliya' ||
    user.userId === 'user-super-admin-paneliya'
  ) {
    return false;
  }

  // Strict company isolation: Company A notifications must NEVER reach Company B
  const hasNotifCompany = Boolean(n.companyId || n.companyCode);
  if (hasNotifCompany) {
    const userCompId = (user.companyId || '').trim().toLowerCase();
    const notifCompId = (n.companyId || '').trim().toLowerCase();
    const userCompCode = (user.companyCode || '').trim().toLowerCase();
    const notifCompCode = (n.companyCode || '').trim().toLowerCase();

    const matchesId = Boolean(userCompId && notifCompId && userCompId === notifCompId);
    const matchesCode = Boolean(userCompCode && notifCompCode && userCompCode === notifCompCode);
    const matchesCross1 = Boolean(userCompId && notifCompCode && userCompId === notifCompCode);
    const matchesCross2 = Boolean(userCompCode && notifCompId && userCompCode === notifCompId);

    if (!matchesId && !matchesCode && !matchesCross1 && !matchesCross2) {
      return false;
    }
  }

  const isAdmin = roleUpper === 'ADMIN' || roleUpper === 'HR_ADMIN';

  // Rule: Company's ADMIN must receive ALL notifications generated within their company!
  // Any notification from an employee, leave request, attendance, announcements, or system within their company shows in Admin.
  if (isAdmin) {
    return true;
  }

  // Normalize category/module for non-admin recipients (EMPLOYEE)
  const category = (n.type || n.module || '').toLowerCase();

  // 4. Attendance Check-in / Check-out:
  // Notify only the employee's company's ADMIN (never other employees or the puncher themselves)
  if (category === 'attendance') {
    return false;
  }

  // 5. Announcements:
  // Notify ALL ADMIN and EMPLOYEES of the same company.
  if (category === 'announcement') {
    return true;
  }

  // 6. Company Holidays:
  // Notify ALL ADMIN and EMPLOYEES of the same company.
  if (category === 'holiday') {
    return true;
  }

  // 2. Leave Application & 3. Leave Approved / Rejected:
  // Notify only the concerned employee (and ADMIN handled above)
  if (category === 'leave') {
    return Boolean(
      n.userId &&
        (n.userId === user.id ||
          n.userId === user.userId ||
          (user.employeeId && n.userId === user.employeeId)),
    );
  }

  // 7. Recruitment:
  // Notify only the assigned interviewer (and ADMIN handled above)
  if (category === 'recruitment') {
    return Boolean(
      n.userId &&
        (n.userId === user.id ||
          n.userId === user.userId ||
          (user.employeeId && n.userId === user.employeeId)),
    );
  }

  // 8. Other personal notifications:
  // Notify only the concerned user (and ADMIN handled above)
  if (n.userId) {
    return Boolean(
      n.userId === user.id ||
        n.userId === user.userId ||
        (user.employeeId && n.userId === user.employeeId),
    );
  }

  // General company-wide notice (e.g. system broadcast with no specific userId):
  // All employees of the same company receive it
  return true;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Evaluates if a given user is an authorized recipient of the notification based on HRMS rules.
   */
  public isNotificationRecipient(n: NotificationItem, user: User): boolean {
    return isNotificationRecipient(n, user);
  }

  /**
   * Formats a notification for a specific user so reading one user's notification
   * never marks another user's notification as read (independent read status).
   */
  public formatForUser(n: NotificationItem, userId: string): NotificationItem {
    const readByList: string[] = Array.isArray((n as any).readBy)
      ? (n as any).readBy
      : typeof (n as any).readBy === 'string'
        ? (n as any).readBy.split(',').filter(Boolean)
        : [];

    const isUserRead = readByList.includes(userId);

    return {
      ...n,
      isRead: isUserRead,
    };
  }

  findAll(actorUser?: User): NotificationItem[] {
    if (!actorUser) return [];

    // Rule 1: SUPER_ADMIN must always have zero notifications and zero unread count
    const roleUpper = (actorUser.role || '').toUpperCase();
    if (
      roleUpper === 'SUPER_ADMIN' ||
      (actorUser as any).isSuperAdmin === true ||
      actorUser.id === 'user-super-admin-paneliya'
    ) {
      return [];
    }

    return this.db.notifications
      .filter((n) => isNotificationRecipient(n, actorUser))
      .map((n) => this.formatForUser(n, actorUser.id))
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  getUnreadCount(actorUser?: User): { count: number } {
    if (!actorUser) return { count: 0 };

    // Rule 1: SUPER_ADMIN must always have zero notifications and zero unread count
    const roleUpper = (actorUser.role || '').toUpperCase();
    if (
      roleUpper === 'SUPER_ADMIN' ||
      (actorUser as any).isSuperAdmin === true ||
      actorUser.id === 'user-super-admin-paneliya'
    ) {
      return { count: 0 };
    }

    const list = this.findAll(actorUser);
    const count = list.filter((n) => !n.isRead).length;
    return { count };
  }

  async markAsRead(id: string, actorUser?: User) {
    const notif = this.db.notifications.find((n) => n.id === id);
    if (!notif) throw new NotFoundException('Notification not found');

    if (!actorUser) {
      notif.isRead = true;
      return notif;
    }

    const roleUpper = (actorUser.role || '').toUpperCase();
    if (
      roleUpper === 'SUPER_ADMIN' ||
      (actorUser as any).isSuperAdmin === true ||
      actorUser.id === 'user-super-admin-paneliya'
    ) {
      throw new ForbiddenException('SUPER_ADMIN does not receive or manage notifications.');
    }

    if (!isNotificationRecipient(notif, actorUser)) {
      throw new ForbiddenException('Cannot modify notification not addressed to you');
    }

    if (!Array.isArray((notif as any).readBy)) {
      (notif as any).readBy = (notif as any).readBy
        ? typeof (notif as any).readBy === 'string'
          ? (notif as any).readBy.split(',').filter(Boolean)
          : []
        : [];
    }

    if (!(notif as any).readBy.includes(actorUser.id)) {
      (notif as any).readBy.push(actorUser.id);
    }

    await this.db.saveNotificationToMysql(notif);
    this.db.persist();

    return this.formatForUser(notif, actorUser.id);
  }

  async markAllAsRead(actorUser?: User) {
    if (!actorUser) return { success: true };

    const roleUpper = (actorUser.role || '').toUpperCase();
    if (
      roleUpper === 'SUPER_ADMIN' ||
      (actorUser as any).isSuperAdmin === true ||
      actorUser.id === 'user-super-admin-paneliya'
    ) {
      return { success: true };
    }

    const userNotifs = this.db.notifications.filter((n) =>
      isNotificationRecipient(n, actorUser),
    );

    for (const notif of userNotifs) {
      if (!Array.isArray((notif as any).readBy)) {
        (notif as any).readBy = (notif as any).readBy
          ? typeof (notif as any).readBy === 'string'
            ? (notif as any).readBy.split(',').filter(Boolean)
            : []
          : [];
      }
      if (!(notif as any).readBy.includes(actorUser.id)) {
        (notif as any).readBy.push(actorUser.id);
        void this.db.saveNotificationToMysql(notif);
      }
    }

    this.db.persist();
    return { success: true };
  }
}
