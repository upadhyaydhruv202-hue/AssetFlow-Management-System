import crypto from 'crypto';
import prisma from '../config/database.js';
import { sendEmail, sendMfaOtpEmail, sendMagicLinkEmail as sendMagicLink } from './mailService.js';
import { createNotification } from './notificationService.js';
import { logActivity } from '../utils/activityLogger.js';

const MAGIC_LINK_EXPIRY_MINUTES = 15;
const MFA_OTP_EXPIRY_MINUTES = 10;
const TRUSTED_DEVICE_DAYS = 30;

export const getSystemSetting = async (key, defaultValue) => {
  const setting = await prisma.systemSetting.findUnique({ where: { key } });
  return setting?.value ?? defaultValue;
};

export const isDomainAllowed = async (email) => {
  const domains = await prisma.allowedDomain.findMany({ where: { isActive: true } });
  if (domains.length === 0) return true;
  const domain = email.split('@')[1]?.toLowerCase();
  return domains.some((d) => d.domain.toLowerCase() === domain);
};

export const parseClientInfo = (req) => ({
  ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
  browser: req.headers['user-agent']?.slice(0, 200) || 'unknown',
  country: req.headers['cf-ipcountry'] || req.body?.country || 'unknown',
  fingerprint: req.body?.deviceFingerprint || req.headers['x-device-fingerprint'] || null,
});

export const assessLoginRisk = async (user, clientInfo) => {
  let riskScore = 0;
  const reasons = [];

  if (!user.emailVerified) { riskScore += 20; reasons.push('email_unverified'); }
  if (user.lastLoginCountry && clientInfo.country !== 'unknown' && user.lastLoginCountry !== clientInfo.country) {
    riskScore += 40; reasons.push('new_country');
  }
  if (user.lastLoginBrowser && user.lastLoginBrowser !== clientInfo.browser) {
    riskScore += 15; reasons.push('new_browser');
  }
  if (clientInfo.fingerprint) {
    const trusted = await prisma.trustedDevice.findFirst({
      where: { userId: user.id, fingerprint: clientInfo.fingerprint, expiresAt: { gt: new Date() } },
    });
    if (!trusted) { riskScore += 25; reasons.push('untrusted_device'); }
  } else {
    riskScore += 10; reasons.push('no_fingerprint');
  }

  if (user.lastLoginAt) {
    const hoursSince = (Date.now() - new Date(user.lastLoginAt).getTime()) / 3600000;
    if (hoursSince < 1 && user.lastLoginCountry && clientInfo.country !== user.lastLoginCountry && clientInfo.country !== 'unknown') {
      riskScore += 50; reasons.push('impossible_travel');
    }
  }

  return { riskScore, reasons, requiresMfa: riskScore >= 50 || user.mfaEnabled };
};

export const createMfaOtp = async (userId) => {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + MFA_OTP_EXPIRY_MINUTES * 60000);
  await prisma.mfaOtp.create({ data: { userId, code, expiresAt } });
  return code;
};

export const verifyMfaOtp = async (userId, code) => {
  const otp = await prisma.mfaOtp.findFirst({
    where: { userId, code, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp) return false;
  await prisma.mfaOtp.update({ where: { id: otp.id }, data: { usedAt: new Date() } });
  return true;
};

export const sendMfaEmail = async (email, code) => sendMfaOtpEmail(email, code);

export const createMagicLink = async (userId) => {
  const expiry = parseInt(await getSystemSetting('magic_link_expiry_minutes', String(MAGIC_LINK_EXPIRY_MINUTES)), 10);
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + expiry * 60000);
  await prisma.magicLink.create({ data: { userId, token, expiresAt } });
  return { token, expiresAt, expiryMinutes: expiry };
};

export const sendMagicLinkEmail = async (email, token) => sendMagicLink(email, token);

export const verifyMagicLink = async (token) => {
  const link = await prisma.magicLink.findFirst({
    where: { token, usedAt: null, expiresAt: { gt: new Date() } },
    include: { user: { include: { employee: { include: { department: true } } } } },
  });
  if (!link) return null;
  await prisma.magicLink.update({ where: { id: link.id }, data: { usedAt: new Date() } });
  return link.user;
};

export const logSecurityEvent = async (userId, type, clientInfo, details = null) => {
  await prisma.securityEvent.create({
    data: {
      userId,
      type,
      ipAddress: clientInfo.ip,
      country: clientInfo.country,
      browser: clientInfo.browser,
      deviceFp: clientInfo.fingerprint,
      details,
    },
  });
};

export const handleSuspiciousLogin = async (user, clientInfo, reasons) => {
  await logSecurityEvent(user.id, 'SUSPICIOUS_LOGIN', clientInfo, { reasons });
  await createNotification(
    user.id,
    'SECURITY_ALERT',
    'Suspicious Login Detected',
    `Unusual login from ${clientInfo.country}: ${reasons.join(', ')}`,
    '/profile/security'
  );
};

export const trustDevice = async (userId, clientInfo, deviceName) => {
  const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_DAYS * 24 * 3600000);
  if (!clientInfo.fingerprint) return null;
  return prisma.trustedDevice.upsert({
    where: { userId_fingerprint: { userId, fingerprint: clientInfo.fingerprint } },
    create: {
      userId,
      fingerprint: clientInfo.fingerprint,
      deviceName: deviceName || 'Trusted Device',
      browser: clientInfo.browser,
      country: clientInfo.country,
      expiresAt,
    },
    update: { lastUsedAt: new Date(), expiresAt, deviceName: deviceName || 'Trusted Device' },
  });
};

export const updateLoginMetadata = async (userId, clientInfo) => {
  await prisma.user.update({
    where: { id: userId },
    data: {
      lastLoginAt: new Date(),
      lastLoginIp: clientInfo.ip,
      lastLoginCountry: clientInfo.country,
      lastLoginBrowser: clientInfo.browser,
      emailVerified: true,
    },
  });
};

export const generateWebAuthnChallenge = () => crypto.randomBytes(32).toString('base64url');

export const registerPasskey = async (userId, { credentialId, publicKey, deviceName }) => {
  const cred = await prisma.webAuthnCredential.create({
    data: { userId, credentialId, publicKey, deviceName },
  });
  await logSecurityEvent(userId, 'PASSKEY_REGISTERED', { ip: 'local', browser: deviceName, country: 'local', fingerprint: null });
  return cred;
};

export const findPasskey = async (credentialId) => {
  return prisma.webAuthnCredential.findUnique({
    where: { credentialId },
    include: { user: { include: { employee: { include: { department: true } } } } },
  });
};

export const completePasskeyLogin = async (credentialId) => {
  const cred = await findPasskey(credentialId);
  if (!cred) return null;
  await prisma.webAuthnCredential.update({
    where: { id: cred.id },
    data: { lastUsedAt: new Date(), counter: { increment: 1 } },
  });
  return cred.user;
};
