import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import crypto from 'crypto';
import { DatabaseService } from '../../database/database.service.js';
import { MailService } from '../../common/services/mail.service.js';
import { EmployeeInvitation, Role, EmployeeStatus } from '../../common/types.js';

@Injectable()
export class EmployeeInvitationService {
  private readonly logger = new Logger(EmployeeInvitationService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Generates a 30-minute one-time password setup token, stores its SHA-256 hash,
   * revokes any prior unused tokens for this user, and sends the invitation email.
   */
  public async createAndSendInvitation(params: {
    userId: string;
    email: string;
    employeeName: string;
    companyId: string;
    companyCode: string;
    companyName: string;
    expiresInSeconds?: number;
  }): Promise<{
    invitationId: string;
    sent: boolean;
    error?: string;
    rawToken?: string;
  }> {
    const { userId, email, employeeName, companyId, companyCode, companyName, expiresInSeconds } = params;

    // 1. Revoke any prior pending/unused invitation tokens for this employee
    const now = new Date().toISOString();
    for (const inv of this.db.employeeInvitations) {
      if (inv.userId === userId && !inv.usedAt && !inv.revokedAt) {
        inv.revokedAt = now;
      }
    }

    // 2. Generate cryptographically secure random token (32 bytes = 64 hex characters)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // 3. Expiration: default strictly 30 minutes from creation
    const durationSeconds = expiresInSeconds !== undefined ? expiresInSeconds : 30 * 60;
    const expiresAt = new Date(Date.now() + durationSeconds * 1000).toISOString();

    const record: EmployeeInvitation = {
      id: `inv-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      userId,
      email,
      companyId,
      companyCode,
      tokenHash,
      expiresAt,
      usedAt: null,
      revokedAt: null,
      createdAt: now,
    };

    this.db.employeeInvitations.push(record);
    this.db.persist();

    // 4. Send email via SMTP
    const mailResult = await this.mailService.sendEmployeeInvitation({
      toEmail: email,
      employeeName,
      companyName,
      rawToken,
    });

    const result: any = {
      invitationId: record.id,
      sent: mailResult.sent,
      error: mailResult.error,
    };

    // Expose rawToken in response ONLY during automated testing or explicit dev environment
    if (process.env.NODE_ENV !== 'production' || process.env.RETURN_INVITATION_TOKEN === 'true') {
      result.rawToken = rawToken;
    }

    return result;
  }

  /**
   * Resends an invitation to an employee.
   * Enforces strict multi-company tenancy: Admin can only resend within their own company.
   */
  public async resendInvitation(
    employeeId: string,
    actor: { id: string; role: Role; companyId: string },
    options?: { expiresInSeconds?: number },
  ) {
    const employee = this.db.employees.find(
      (e) => e.id === employeeId || e.userId === employeeId,
    );
    if (!employee) {
      throw new NotFoundException(`Employee "${employeeId}" not found.`);
    }

    // Enforce tenant boundary: Admin can only invite their own employees
    if (actor.role === Role.ADMIN && employee.companyId !== actor.companyId) {
      throw new ForbiddenException(
        'Tenant Access Denied: You can only resend invitations to employees within your own company.',
      );
    }

    if (employee.status !== EmployeeStatus.ACTIVE) {
      throw new BadRequestException('Cannot send invitation to an inactive or terminated employee.');
    }

    const company = this.db.companies.find((c) => c.id === employee.companyId);
    const companyName = company?.name || company?.companyName || 'Your Company';

    const invResult = await this.createAndSendInvitation({
      userId: employee.id,
      email: employee.email,
      employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
      companyId: employee.companyId || 'cmp-1',
      companyCode: employee.companyCode || 'CMP-000001',
      companyName,
      expiresInSeconds: options?.expiresInSeconds,
    });

    return {
      message: invResult.sent
        ? 'Invitation email resent successfully.'
        : `Invitation created, but email could not be delivered: ${invResult.error || 'SMTP not configured'}`,
      invitationId: invResult.invitationId,
      emailSent: invResult.sent,
      rawToken: invResult.rawToken,
    };
  }
}
