import getTransporter, { getFromAddress, verifyMailConnection } from '../config/mail.js';
import logger from '../config/logger.js';

export const isEmailConfigured = () => Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

const emailWrapper = (title, body) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#2563eb;padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;">AssetFlow</h1>
          <p style="margin:4px 0 0;color:#bfdbfe;font-size:13px;">Enterprise Asset Management</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">${title}</h2>
          ${body}
        </td></tr>
        <tr><td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">This is an automated message from AssetFlow. Do not reply.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const button = (url, label) => `
  <a href="${url}" style="display:inline-block;margin:20px 0;padding:14px 28px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:15px;">${label}</a>
  <p style="margin:8px 0 0;color:#6b7280;font-size:13px;word-break:break-all;">Or copy this link:<br><a href="${url}" style="color:#2563eb;">${url}</a></p>`;

export const sendEmail = async ({ to, subject, html, text }) => {
  if (!isEmailConfigured()) {
    logger.warn(`[Email Mock] SMTP not configured. Would send to: ${to}, Subject: ${subject}`);
    return { mock: true, to, subject };
  }

  const info = await getTransporter().sendMail({
    from: getFromAddress(),
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(),
  });

  logger.info(`Email sent to ${to} — messageId: ${info.messageId}`);
  return info;
};

export const sendPasswordResetEmail = async (email, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  await sendEmail({
    to: email,
    subject: 'AssetFlow — Reset Your Password',
    html: emailWrapper('Reset Your Password', `
      <p style="color:#374151;font-size:15px;line-height:1.6;">We received a request to reset your password. Click the button below to choose a new password.</p>
      ${button(resetUrl, 'Reset Password')}
      <p style="color:#9ca3af;font-size:13px;">This link expires in <strong>1 hour</strong>. If you didn't request this, ignore this email.</p>
    `),
  });
  return resetUrl;
};

export const sendMfaOtpEmail = async (email, code) => {
  await sendEmail({
    to: email,
    subject: 'AssetFlow — Your Verification Code',
    html: emailWrapper('Verification Code', `
      <p style="color:#374151;font-size:15px;">Use this code to complete your sign-in:</p>
      <div style="margin:24px 0;padding:20px;background:#eff6ff;border-radius:8px;text-align:center;">
        <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#2563eb;">${code}</span>
      </div>
      <p style="color:#9ca3af;font-size:13px;">This code expires in <strong>10 minutes</strong>.</p>
    `),
  });
};

export const sendMagicLinkEmail = async (email, token) => {
  const url = `${process.env.FRONTEND_URL}/magic-login?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'AssetFlow — Your Magic Sign-In Link',
    html: emailWrapper('Sign In to AssetFlow', `
      <p style="color:#374151;font-size:15px;line-height:1.6;">Click the button below to sign in instantly. No password needed.</p>
      ${button(url, 'Sign In Now')}
      <p style="color:#9ca3af;font-size:13px;">This link expires shortly and can only be used once.</p>
    `),
  });
  return url;
};

export const sendTestEmail = async (to) => {
  await sendEmail({
    to,
    subject: 'AssetFlow — Test Email',
    html: emailWrapper('Email Configuration Test', `
      <p style="color:#374151;font-size:15px;">Your AssetFlow email system is working correctly.</p>
      <p style="color:#059669;font-size:15px;font-weight:bold;">✓ SMTP connection successful</p>
    `),
  });
};

export { verifyMailConnection };
