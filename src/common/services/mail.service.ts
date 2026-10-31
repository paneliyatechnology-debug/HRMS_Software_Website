import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter, type TestAccount } from 'nodemailer';

export interface SendInvitationParams {
  toEmail: string;
  employeeName: string;
  companyName: string;
  rawToken: string;
}

export interface MailSendResult {
  sent: boolean;
  messageId?: string;
  previewUrl?: string;
  error?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private testAccountPromise: Promise<TestAccount | null> | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT) || 465;
    const user = process.env.SMTP_USER;
    const rawPass = process.env.SMTP_PASS;
    const pass = rawPass ? rawPass.replace(/\s+/g, '') : undefined;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass,
        },
      });
      this.logger.log(`SMTP Mail Transporter successfully configured for ${host}:${port} (${user})`);
    } else {
      this.logger.warn(
        'SMTP service is not configured (missing SMTP_HOST, SMTP_USER, or SMTP_PASS). Live invitation emails will require valid SMTP credentials.',
      );
    }
  }

  public isConfigured(): boolean {
    return !!(process.env.SMTP_HOST && process.env.SMTP_USER) || process.env.ENABLE_TEST_SMTP === 'true';
  }

  private async getTestTransporter(): Promise<Transporter | null> {
    try {
      if (!this.testAccountPromise) {
        this.testAccountPromise = nodemailer.createTestAccount();
      }
      const testAccount = await this.testAccountPromise;
      if (testAccount) {
        return nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
      }
    } catch (e: any) {
      this.logger.error('Failed to create Ethereal test account:', e.message);
    }
    return null;
  }

  public async sendEmployeeInvitation(params: SendInvitationParams): Promise<MailSendResult> {
    const { toEmail, employeeName, companyName, rawToken } = params;

    let activeTransporter = this.transporter;

    if (!activeTransporter) {
      if (process.env.ENABLE_TEST_SMTP === 'true') {
        activeTransporter = await this.getTestTransporter();
      }
    }

    if (!activeTransporter) {
      const errorMsg =
        'SMTP credentials are not configured in environment (SMTP_HOST / SMTP_USER missing).';
      this.logger.warn(`Cannot send invitation email to "${toEmail}": ${errorMsg}`);
      return { sent: false, error: errorMsg };
    }

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const setupLink = `${frontendUrl}/set-password?token=${encodeURIComponent(rawToken)}`;
    const fromAddress = process.env.MAIL_FROM || `"Enterprise HRMS" <noreply@hrms.com>`;
    const subject = 'Welcome to HRMS – Set Up Your Account Password';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 36px 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { text-align: center; margin-bottom: 24px; }
    .brand { font-size: 20px; font-weight: 700; color: #0f172a; }
    .company { font-size: 15px; color: #64748b; margin-top: 4px; }
    .greeting { font-size: 18px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
    .message { font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 24px; }
    .button-container { text-align: center; margin: 32px 0; }
    .btn { background-color: #059669; color: #ffffff !important; padding: 14px 28px; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px; display: inline-block; }
    .notice { font-size: 13px; color: #64748b; line-height: 1.5; padding: 16px; background-color: #f1f5f9; border-radius: 8px; margin-top: 24px; }
    .footer { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 28px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="brand">Enterprise HRMS</div>
      <div class="company">${companyName}</div>
    </div>
    <div class="greeting">Hello ${employeeName},</div>
    <div class="message">
      Welcome to HRMS!<br><br>
      Your employee account has been created successfully.
      To activate your account, please click the button below and create your password.
    </div>
    <div class="button-container">
      <a href="${setupLink}" class="btn" target="_blank">Set Up Your Password</a>
    </div>
    <div class="notice">
      <strong>Important Security Notice:</strong><br>
      • This secure link expires in <strong>30 minutes</strong> and can only be used once.<br>
      • If this link expires before completing setup, please contact your company administrator to issue a new invitation.
    </div>
    <div class="footer">
      If the button does not work, copy and paste this URL into your browser:<br>
      <a href="${setupLink}" style="color: #059669; word-break: break-all;">${setupLink}</a>
    </div>
  </div>
</body>
</html>
`;

    const textContent = `
Welcome to HRMS!

Hello ${employeeName},

Your employee account for ${companyName} has been created successfully.
To activate your account, please visit the link below and create your password:

${setupLink}

This secure link expires in 30 minutes and can only be used once.
If this link expires before completing setup, please contact your company administrator.
`;

    try {
      const info = await activeTransporter.sendMail({
        from: fromAddress,
        to: toEmail,
        subject,
        text: textContent,
        html: htmlContent,
      });

      this.logger.log(`Invitation email successfully dispatched to ${toEmail}. MessageId: ${info.messageId}`);
      return {
        sent: true,
        messageId: info.messageId,
        previewUrl: nodemailer.getTestMessageUrl(info) || undefined,
      };
    } catch (err: any) {
      this.logger.error(`Error sending email to ${toEmail}: ${err.message}`);
      return { sent: false, error: err.message };
    }
  }
}
