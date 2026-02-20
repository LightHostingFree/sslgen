import nodemailer from 'nodemailer';

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true';

  if (!host || !user || !pass) {
    throw new Error('SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables are required');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
}

const FROM_NAME = process.env.SMTP_FROM_NAME || 'SSL Generator';
const FROM_EMAIL = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
const APP_URL = process.env.APP_URL || 'https://sslgen.app';

function baseTemplate(title, preheader, bodyContent) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#eef2ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef2ff;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="padding-bottom:24px;" align="center">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#4f46e5;border-radius:12px;padding:10px 14px;vertical-align:middle;">
                    <span style="display:inline-block;vertical-align:middle;">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;">
                        <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                      </svg>
                    </span>
                  </td>
                  <td style="padding-left:10px;">
                    <span style="font-size:18px;font-weight:700;color:#1e1b4b;letter-spacing:-0.3px;">SSL Generator</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff;border-radius:20px;padding:40px;box-shadow:0 4px 24px rgba(79,70,229,0.08);border:1px solid #e0e7ff;">
              ${bodyContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Made with ❤️ by <a href="${APP_URL}" style="color:#4f46e5;text-decoration:none;">SSL Generator</a>
              </p>
              <p style="margin:6px 0 0;font-size:12px;color:#d1d5db;">
                You received this email because an action was performed on your account.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function forgotPasswordTemplate(email, resetUrl) {
  const body = `
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:16px;margin-bottom:16px;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
      </div>
      <h1 style="margin:0;font-size:24px;font-weight:700;color:#111827;letter-spacing:-0.5px;">Reset your password</h1>
      <p style="margin:8px 0 0;font-size:15px;color:#6b7280;">We received a request to reset the password for your account.</p>
    </div>

    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
      Hi <strong>${email}</strong>,<br/><br/>
      Click the button below to reset your password. This link is valid for <strong>1 hour</strong>.
    </p>

    <div style="text-align:center;margin:32px 0;">
      <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#4338ca);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:12px;box-shadow:0 4px 14px rgba(79,70,229,0.35);">
        Reset Password
      </a>
    </div>

    <div style="background-color:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">
        If the button above doesn't work, copy and paste this link into your browser:
      </p>
      <p style="margin:8px 0 0;font-size:12px;color:#4f46e5;word-break:break-all;">${resetUrl}</p>
    </div>

    <div style="border-top:1px solid #f3f4f6;padding-top:20px;">
      <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.5;">
        ⚠️ If you did not request a password reset, please ignore this email. Your password will not be changed.
      </p>
    </div>`;

  return {
    subject: 'Reset your SSL Generator password',
    html: baseTemplate('Reset your password', 'Click to reset your SSL Generator password', body)
  };
}

export function sslExpiryReminderTemplate(email, certificates) {
  const rows = certificates.map((cert) => {
    const daysLeft = Math.ceil((new Date(cert.expiresAt) - Date.now()) / (1000 * 60 * 60 * 24));
    const isUrgent = daysLeft <= 7;
    const badgeColor = isUrgent ? '#dc2626' : '#d97706';
    const badgeBg = isUrgent ? '#fef2f2' : '#fffbeb';
    return `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #f3f4f6;font-size:14px;font-weight:600;color:#4f46e5;">${cert.domain}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280;">${new Date(cert.expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #f3f4f6;">
          <span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;color:${badgeColor};background-color:${badgeBg};border:1px solid ${badgeColor}20;">
            ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left
          </span>
        </td>
      </tr>`;
  }).join('');

  const urgentCount = certificates.filter((c) => Math.ceil((new Date(c.expiresAt) - Date.now()) / (1000 * 60 * 60 * 24)) <= 7).length;
  const headlineText = urgentCount > 0
    ? `${urgentCount} certificate${urgentCount > 1 ? 's' : ''} expire${urgentCount === 1 ? 's' : ''} within 7 days!`
    : `${certificates.length} certificate${certificates.length > 1 ? 's' : ''} expiring soon`;

  const body = `
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:16px;margin-bottom:16px;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/>
        </svg>
      </div>
      <h1 style="margin:0;font-size:24px;font-weight:700;color:#111827;letter-spacing:-0.5px;">SSL Certificate Reminder</h1>
      <p style="margin:8px 0 0;font-size:15px;color:#d97706;font-weight:600;">${headlineText}</p>
    </div>

    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
      Hi <strong>${email}</strong>,<br/><br/>
      The following SSL certificate${certificates.length > 1 ? 's are' : ' is'} expiring soon. Renew ${certificates.length > 1 ? 'them' : 'it'} before expiry to keep your website secure and avoid browser warnings.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:28px;">
      <thead>
        <tr style="background-color:#f9fafb;">
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Domain</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Expires</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Time Left</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div style="text-align:center;margin-bottom:28px;">
      <a href="${APP_URL}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#4338ca);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:12px;box-shadow:0 4px 14px rgba(79,70,229,0.35);">
        Renew Certificates Now
      </a>
    </div>

    <div style="border-top:1px solid #f3f4f6;padding-top:20px;">
      <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.5;">
        Expired certificates will cause security warnings in browsers, potentially driving visitors away from your site.
        Log in to SSL Generator to renew before expiry.
      </p>
    </div>`;

  return {
    subject: `⚠️ SSL Certificate Expiry Reminder — ${headlineText}`,
    html: baseTemplate('SSL Certificate Expiry Reminder', headlineText, body)
  };
}

export async function sendEmail({ to, subject, html }) {
  const transporter = getTransporter();
  const from = FROM_EMAIL ? `"${FROM_NAME}" <${FROM_EMAIL}>` : FROM_NAME;
  return transporter.sendMail({ from, to, subject, html });
}
