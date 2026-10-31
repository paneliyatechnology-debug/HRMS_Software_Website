const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function verifySmtp() {
  console.log('Testing Gmail SMTP connection...');
  console.log('User:', process.env.SMTP_USER);
  console.log('Host:', process.env.SMTP_HOST);
  console.log('Port:', process.env.SMTP_PORT);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS.replace(/\s+/g, ''),
    },
  });

  try {
    await transporter.verify();
    console.log('[SUCCESS] SMTP Connection and Authentication Verified successfully with Gmail servers!');

    // Send a test email to the user's email to confirm delivery
    console.log('Sending test confirmation email to', process.env.SMTP_USER, '...');
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || `"Enterprise HRMS" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      subject: 'HRMS – SMTP Email Configuration Test Successful',
      text: 'Congratulations! Your Gmail SMTP configuration is working perfectly for Enterprise HRMS.',
      html: `
        <div style="font-family: sans-serif; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 500px;">
          <h2 style="color: #059669;">HRMS Email Configuration Active</h2>
          <p>Hello Ravi,</p>
          <p>Your Gmail SMTP credentials have been successfully configured and tested in Enterprise HRMS.</p>
          <p>Now, whenever an <strong>ADMIN</strong> creates a new <strong>EMPLOYEE</strong>, the password setup invitation email will be delivered automatically via this account.</p>
          <p style="color: #64748b; font-size: 13px;">Enterprise HRMS Notification System</p>
        </div>
      `,
    });

    console.log('[SUCCESS] Test email delivered! Message ID:', info.messageId);
    process.exit(0);
  } catch (error) {
    console.error('[ERROR] Failed to authenticate or send email:', error);
    process.exit(1);
  }
}

verifySmtp();

