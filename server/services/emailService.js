const nodemailer = require('nodemailer');
const config = require('../config');

function getTransporter() {
  const user = (process.env.SMTP_USER || config.smtp.user || '').trim();
  const pass = (process.env.SMTP_PASS || config.smtp.pass || '').trim().replace(/\s+/g, '');
  const host = (process.env.SMTP_HOST || config.smtp.host || 'smtp.gmail.com').trim();
  const port = parseInt(process.env.SMTP_PORT || String(config.smtp.port) || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || config.smtp.secure || false;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Verify Gmail SMTP connection
 */
async function verifySmtp() {
  const mailer = getTransporter();
  if (!mailer) {
    return {
      connected: false,
      message: 'Gmail SMTP credentials (SMTP_USER & SMTP_PASS) not configured in .env',
    };
  }

  try {
    await mailer.verify();
    return { connected: true, message: 'Gmail SMTP connection successful!' };
  } catch (err) {
    return { connected: false, message: `SMTP verification failed: ${err.message}` };
  }
}

/**
 * Send Fee Reminder HTML Email to a Student
 */
async function sendFeeReminderEmail(options) {
  const {
    to,
    studentName,
    libraryName,
    amount,
    currency = 'INR',
    dueDate,
    phone = '',
    address = '',
    customNotes = '',
  } = options;

  if (!to) {
    return { status: 'failed', failureReason: 'Student email is missing.' };
  }

  const subject = `Fee Reminder: Your Membership Fee for ${libraryName} is Due`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
        .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .header { background: #4f46e5; color: #ffffff; padding: 28px 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
        .body { padding: 28px 24px; }
        .greeting { font-size: 16px; font-weight: 600; margin-bottom: 12px; }
        .card-due { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 18px; margin: 20px 0; text-align: center; }
        .due-label { font-size: 13px; color: #991b1b; text-transform: uppercase; font-weight: 600; }
        .due-amount { font-size: 32px; font-weight: 800; color: #dc2626; margin: 6px 0; }
        .due-date { font-size: 13px; color: #7f1d1d; }
        .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13.5px; }
        .info-table td { padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
        .info-table td.label { color: #64748b; width: 40%; }
        .info-table td.value { font-weight: 600; color: #0f172a; }
        .footer { background: #f8fafc; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${libraryName}</h1>
        </div>
        <div class="body">
          <div class="greeting">Dear ${studentName},</div>
          <p style="font-size: 14px; line-height: 1.6; color: #334155;">
            This is a friendly reminder regarding your upcoming study library membership renewal fee. Please settle your fee to keep your dedicated seat and shift reserved without interruption.
          </p>

          <div class="card-due">
            <div class="due-label">Outstanding Balance Due</div>
            <div class="due-amount">${currency} ${amount}</div>
            <div class="due-date">Due on or before: <strong>${dueDate}</strong></div>
          </div>

          <table class="info-table">
            <tr>
              <td class="label">Library</td>
              <td class="value">${libraryName}</td>
            </tr>
            <tr>
              <td class="label">Contact Phone</td>
              <td class="value">${phone || 'Contact Reception'}</td>
            </tr>
            <tr>
              <td class="label">Premises Address</td>
              <td class="value">${address || 'Main Campus'}</td>
            </tr>
          </table>

          ${customNotes ? `<p style="background: #f1f5f9; padding: 12px; border-radius: 6px; font-size: 13px; color: #475569;">${customNotes}</p>` : ''}

          <p style="font-size: 13.5px; color: #334155; margin-top: 24px;">
            You can pay via UPI, cash, or card at the library reception desk to collect your official stamped receipt.
          </p>

          <p style="font-size: 13.5px; color: #334155;">
            Best wishes for your preparation and studies,<br>
            <strong>${libraryName} Administration</strong>
          </p>
        </div>
        <div class="footer">
          This is an automated administrative notification sent by ${libraryName}.
        </div>
      </div>
    </body>
    </html>
  `;

  const mailer = getTransporter();

  if (mailer) {
    try {
      const senderUser = (process.env.SMTP_USER || config.smtp.user || '').trim();
      const fromAddress = (process.env.SMTP_FROM || config.smtp.from || `"${libraryName}" <${senderUser}>`).trim();
      const info = await mailer.sendMail({
        from: fromAddress,
        to,
        subject,
        html: htmlContent,
      });

      return {
        status: 'delivered',
        messageId: info.messageId,
        provider: 'gmail_smtp',
      };
    } catch (err) {
      console.error('Gmail SMTP send error:', err);
      return {
        status: 'failed',
        failureReason: err.message,
      };
    }
  }

  // Transparent simulation / sandbox mode if credentials not configured yet
  return {
    status: 'failed',
    sent: false,
    failureReason: 'Gmail SMTP credentials (SMTP_USER & SMTP_PASS) not configured in .env',
    provider: 'none',
  };
}

/**
 * Send Account Activation Email to newly created Library Owner
 */
async function sendOwnerActivationEmail(options) {
  const {
    to,
    ownerName,
    libraryName,
    libraryCode,
    accountId,
    planName = 'Standard Plan',
    status = 'active',
    activationLink,
    loginUrl = 'http://localhost:5000',
  } = options;

  if (!to) {
    return { status: 'failed', sent: false, failureReason: 'Owner email address is missing.' };
  }

  const subject = 'Your Library Management Account Is Ready';

  const statusLabel =
    status === 'active'
      ? '<span style="color: #059669; font-weight: 700;">Active</span>'
      : status === 'pending'
      ? '<span style="color: #d97706; font-weight: 700;">Pending Platform Approval</span>'
      : '<span style="color: #dc2626; font-weight: 700;">Suspended</span>';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .header { background: #4338ca; color: #ffffff; padding: 32px 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
        .header p { margin: 6px 0 0; font-size: 14px; opacity: 0.9; }
        .body { padding: 32px 28px; }
        .greeting { font-size: 17px; font-weight: 600; margin-bottom: 14px; }
        .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin: 22px 0; }
        .info-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .info-table td { padding: 8px 0; border-bottom: 1px solid #edf2f7; }
        .info-table td:last-child { border-bottom: none; }
        .info-table td.label { color: #64748b; width: 42%; }
        .info-table td.value { font-weight: 600; color: #0f172a; }
        .btn-container { text-align: center; margin: 30px 0; }
        .btn { display: inline-block; background: #4f46e5; color: #ffffff !important; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 700; text-decoration: none; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.3); }
        .security-notice { background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 14px; font-size: 12.5px; color: #92400e; margin: 20px 0; }
        .steps { background: #f1f5f9; border-radius: 8px; padding: 18px 20px; margin: 20px 0; font-size: 13px; color: #334155; }
        .steps ol { margin: 8px 0 0; padding-left: 20px; line-height: 1.6; }
        .link-fallback { word-break: break-all; font-size: 12px; color: #6366f1; }
        .footer { background: #f8fafc; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Library Management SaaS</h1>
          <p>Multi-Tenant Study Hall & Library Automation Platform</p>
        </div>
        <div class="body">
          <div class="greeting">Dear ${ownerName},</div>
          <p style="font-size: 14px; line-height: 1.6; color: #334155;">
            Welcome aboard! Your study library <strong>${libraryName}</strong> has been successfully registered on the platform. Your dedicated management account has been created with full administrative access.
          </p>

          <div class="info-card">
            <table class="info-table">
              <tr>
                <td class="label">Library Name</td>
                <td class="value">${libraryName}</td>
              </tr>
              <tr>
                <td class="label">Library ID</td>
                <td class="value"><span style="font-family: monospace; color: #4338ca;">${libraryCode}</span></td>
              </tr>
              <tr>
                <td class="label">Owner Account ID</td>
                <td class="value"><span style="font-family: monospace; color: #4338ca;">${accountId}</span></td>
              </tr>
              <tr>
                <td class="label">Registered Email</td>
                <td class="value">${to}</td>
              </tr>
              <tr>
                <td class="label">Subscription Plan</td>
                <td class="value">${planName}</td>
              </tr>
              <tr>
                <td class="label">Account Status</td>
                <td class="value">${statusLabel}</td>
              </tr>
            </table>
          </div>

          <div class="btn-container">
            <a href="${activationLink}" class="btn" target="_blank">Set Your Password &amp; Activate Account</a>
          </div>

          <div class="security-notice">
            🔒 <strong>Security Policy:</strong> To protect your library records, we never send passwords via email. Please click the button above to set your personal secure password. This activation link is strictly single-use and will expire in <strong>48 hours</strong>.
          </div>

          <p style="font-size: 12px; color: #64748b; margin-top: 10px;">
            If the button doesn't open, copy and paste this secure link into your web browser:<br>
            <a href="${activationLink}" class="link-fallback">${activationLink}</a>
          </p>

          <div class="steps">
            <strong>First-Time Login Instructions:</strong>
            <ol>
              <li>Click the activation link above to open the secure password setup page.</li>
              <li>Choose a strong password (minimum 8 characters).</li>
              <li>After setting your password, navigate to the main login portal at <a href="${loginUrl}">${loginUrl}</a>.</li>
              <li>Sign in with your registered email (<strong>${to}</strong>) and your new password.</li>
              <li>Start designing your visual floor plan, arranging seats across 3 shifts, and enrolling students!</li>
            </ol>
          </div>

          <p style="font-size: 13.5px; color: #334155; margin-top: 24px;">
            If you did not request this account or believe this was done in error, please contact your platform administrator immediately.
          </p>

          <p style="font-size: 13.5px; color: #334155;">
            Warm regards,<br>
            <strong>Platform Administration Team</strong><br>
            Library Management SaaS
          </p>
        </div>
        <div class="footer">
          This is an automated administrative notification. Please do not reply directly to this email.
        </div>
      </div>
    </body>
    </html>
  `;

  const mailer = getTransporter();

  if (mailer) {
    try {
      const senderUser = (process.env.SMTP_USER || config.smtp.user || '').trim();
      const fromAddress = (process.env.SMTP_FROM || config.smtp.from || `"Library SaaS Platform" <${senderUser}>`).trim();
      const info = await mailer.sendMail({
        from: fromAddress,
        to,
        subject,
        html: htmlContent,
      });

      return {
        status: 'delivered',
        sent: true,
        messageId: info.messageId,
        provider: 'gmail_smtp',
      };
    } catch (err) {
      console.error('Gmail SMTP activation send error:', err);
      return {
        status: 'failed',
        sent: false,
        failureReason: err.message,
        provider: 'gmail_smtp',
      };
    }
  }

  // If SMTP is not configured in .env
  return {
    status: 'failed',
    sent: false,
    failureReason: 'Gmail SMTP credentials (SMTP_USER & SMTP_PASS) not configured in .env',
    provider: 'none',
  };
}

module.exports = {
  verifySmtp,
  sendFeeReminderEmail,
  sendOwnerActivationEmail,
};
