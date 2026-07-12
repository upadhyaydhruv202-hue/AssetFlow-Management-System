import prisma from '../config/database.js';
import {
  generateAccessToken,
  generateRefreshToken,
} from '../utils/jwt.js';
import { ApiError, successResponse } from '../utils/apiResponse.js';
import { logActivity } from '../utils/activityLogger.js';
import {
  isDomainAllowed,
  parseClientInfo,
  assessLoginRisk,
  createMfaOtp,
  verifyMfaOtp,
  sendMfaEmail,
  createMagicLink,
  sendMagicLinkEmail,
  verifyMagicLink,
  logSecurityEvent,
  handleSuspiciousLogin,
  trustDevice,
  updateLoginMetadata,
} from '../services/securityService.js';
import {
  getRegistrationOptions,
  verifyRegistration,
  getAuthenticationOptions,
  verifyAuthentication,
  deletePasskey,
} from '../services/webauthnService.js';
import { isEmailConfigured, sendTestEmail, verifyMailConnection } from '../services/mailService.js';

const issueTokens = async (user, res, message = 'Login successful') => {
  const accessToken = generateAccessToken({ userId: user.id, role: user.role, email: user.email });
  const refreshTokenValue = generateRefreshToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { token: refreshTokenValue, userId: user.id, expiresAt } });
  const { password: _, ...safeUser } = user;
  return successResponse(res, { user: safeUser, accessToken, refreshToken: refreshTokenValue }, message);
};

export const verifyMfa = async (req, res, next) => {
  try {
    const { userId, code, trustDevice: shouldTrust, deviceName } = req.body;
    const valid = await verifyMfaOtp(userId, code);
    if (!valid) throw new ApiError(401, 'Invalid or expired OTP');

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { employee: { include: { department: true } } },
    });
    if (!user) throw new ApiError(404, 'User not found');

    const clientInfo = parseClientInfo(req);
    await logSecurityEvent(user.id, 'MFA_VERIFIED', clientInfo);
    if (shouldTrust) await trustDevice(user.id, clientInfo, deviceName);
    await updateLoginMetadata(user.id, clientInfo);
    await logActivity(user.id, 'LOGIN', 'User', user.id, { mfa: true }, req.ip);
    return issueTokens(user, res);
  } catch (error) {
    next(error);
  }
};

export const requestMagicLink = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const allowed = await isDomainAllowed(email);
      if (!allowed) throw new ApiError(403, 'Email domain not allowed');
      const { token } = await createMagicLink(user.id);
      await sendMagicLinkEmail(email, token);
      await logSecurityEvent(user.id, 'MAGIC_LINK_SENT', parseClientInfo(req));
      if (!isEmailConfigured()) {
        const magicUrl = `${process.env.FRONTEND_URL}/magic-login?token=${token}`;
        return successResponse(res, {
          devMagicLink: magicUrl,
          message: 'SMTP not configured — use the magic link shown below',
        }, 'Magic link generated (dev mode)');
      }
    }
    return successResponse(res, null, 'If the email exists, a magic link has been sent');
  } catch (error) {
    next(error);
  }
};

export const magicLinkLogin = async (req, res, next) => {
  try {
    const { token } = req.body;
    const user = await verifyMagicLink(token);
    if (!user) throw new ApiError(400, 'Invalid or expired magic link');

    const clientInfo = parseClientInfo(req);
    await logSecurityEvent(user.id, 'MAGIC_LINK_USED', clientInfo);
    await updateLoginMetadata(user.id, clientInfo);
    await logActivity(user.id, 'LOGIN', 'User', user.id, { magicLink: true }, req.ip);
    return issueTokens(user, res, 'Magic link login successful');
  } catch (error) {
    next(error);
  }
};

export const getPasskeyRegistrationOptions = async (req, res, next) => {
  try {
    const options = await getRegistrationOptions(req.user);
    return successResponse(res, options);
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    next(new ApiError(400, error.message || 'Passkey registration failed'));
  }
};

export const verifyPasskeyRegistration = async (req, res, next) => {
  try {
    const { response, deviceName } = req.body;
    if (!response) throw new ApiError(400, 'Registration response required');
    const cred = await verifyRegistration(req.user, response, deviceName);
    await logActivity(req.user.id, 'PASSKEY_REGISTER', 'User', req.user.id, { deviceName }, req.ip);
    return successResponse(res, cred, 'Passkey registered with Windows Hello', 201);
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    next(new ApiError(400, error.message || 'Passkey registration failed'));
  }
};

export const getPasskeyAuthenticationOptions = async (req, res, next) => {
  try {
    const { email } = req.body;
    const options = await getAuthenticationOptions(email);
    return successResponse(res, options);
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    next(new ApiError(400, error.message || 'Passkey authentication failed'));
  }
};

export const verifyPasskeyAuthentication = async (req, res, next) => {
  try {
    const { response } = req.body;
    if (!response) throw new ApiError(400, 'Authentication response required');

    const user = await verifyAuthentication(response);
    const clientInfo = parseClientInfo(req);
    await logSecurityEvent(user.id, 'PASSKEY_LOGIN', clientInfo);
    await updateLoginMetadata(user.id, clientInfo);
    await logActivity(user.id, 'LOGIN', 'User', user.id, { passkey: true }, req.ip);
    return issueTokens(user, res, 'Passkey login successful');
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    next(new ApiError(401, error.message || 'Passkey authentication failed'));
  }
};

export const deletePasskeyHandler = async (req, res, next) => {
  try {
    await deletePasskey(req.user.id, req.params.id);
    return successResponse(res, null, 'Passkey removed');
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    next(new ApiError(400, error.message || 'Failed to remove passkey'));
  }
};

export const getTrustedDevices = async (req, res, next) => {
  try {
    const devices = await prisma.trustedDevice.findMany({
      where: { userId: req.user.id },
      orderBy: { lastUsedAt: 'desc' },
    });
    return successResponse(res, devices);
  } catch (error) {
    next(error);
  }
};

export const revokeTrustedDevice = async (req, res, next) => {
  try {
    await prisma.trustedDevice.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
    await logSecurityEvent(req.user.id, 'DEVICE_REVOKED', parseClientInfo(req));
    return successResponse(res, null, 'Device revoked');
  } catch (error) {
    next(error);
  }
};

export const getSecurityEvents = async (req, res, next) => {
  try {
    const events = await prisma.securityEvent.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return successResponse(res, events);
  } catch (error) {
    next(error);
  }
};

export const getAllowedDomains = async (req, res, next) => {
  try {
    const domains = await prisma.allowedDomain.findMany({ orderBy: { domain: 'asc' } });
    return successResponse(res, domains);
  } catch (error) {
    next(error);
  }
};

export const addAllowedDomain = async (req, res, next) => {
  try {
    const { domain } = req.body;
    const d = await prisma.allowedDomain.create({ data: { domain: domain.toLowerCase() } });
    await logActivity(req.user.id, 'CREATE', 'AllowedDomain', d.id, { domain }, req.ip);
    return successResponse(res, d, 'Domain added', 201);
  } catch (error) {
    next(error);
  }
};

export const removeAllowedDomain = async (req, res, next) => {
  try {
    await prisma.allowedDomain.delete({ where: { id: req.params.id } });
    return successResponse(res, null, 'Domain removed');
  } catch (error) {
    next(error);
  }
};

export const getPasskeys = async (req, res, next) => {
  try {
    await prisma.webAuthnCredential.deleteMany({
      where: { userId: req.user.id, credentialId: { startsWith: 'passkey-' } },
    });
    const passkeys = await prisma.webAuthnCredential.findMany({
      where: { userId: req.user.id },
      select: { id: true, deviceName: true, createdAt: true, lastUsedAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return successResponse(res, passkeys);
  } catch (error) {
    next(error);
  }
};

export const getEmailStatus = async (_req, res, next) => {
  try {
    const status = await verifyMailConnection();
    return successResponse(res, status);
  } catch (error) {
    next(error);
  }
};

export const testEmail = async (req, res, next) => {
  try {
    if (!isEmailConfigured()) {
      throw new ApiError(400, 'SMTP not configured. Set SMTP_USER and SMTP_PASS in backend/.env');
    }
    const to = req.body.email || req.user.email;
    await sendTestEmail(to);
    return successResponse(res, { sentTo: to }, `Test email sent to ${to}`);
  } catch (error) {
    next(error);
  }
};

export { assessLoginRisk, parseClientInfo, isDomainAllowed, createMfaOtp, sendMfaEmail, handleSuspiciousLogin, trustDevice, updateLoginMetadata, logSecurityEvent };
