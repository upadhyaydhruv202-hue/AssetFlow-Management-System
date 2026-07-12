import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../config/database.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import {
  generateAccessToken,
  generateRefreshToken,
  generateResetToken,
} from '../utils/jwt.js';
import { ApiError, successResponse } from '../utils/apiResponse.js';
import { logActivity } from '../utils/activityLogger.js';
import { sendPasswordResetEmail, isEmailConfigured } from '../services/mailService.js';
import {
  isDomainAllowed,
  parseClientInfo,
  assessLoginRisk,
  createMfaOtp,
  sendMfaEmail,
  handleSuspiciousLogin,
  trustDevice,
  updateLoginMetadata,
  logSecurityEvent,
} from '../services/securityService.js';

const userSelect = {
  id: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  employee: {
    include: { department: true },
  },
};

const googleClient = new OAuth2Client();

export const googleConfig = async (_req, res, next) => {
  try {
    return successResponse(res, { clientId: process.env.GOOGLE_CLIENT_ID || null });
  } catch (error) {
    next(error);
  }
};

export const googleLogin = async (req, res, next) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new ApiError(503, 'Google sign-in is not configured. Set GOOGLE_CLIENT_ID in backend/.env');
    }

    const { credential } = req.body;
    if (!credential) throw new ApiError(400, 'Google credential required');

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: clientId });
      payload = ticket.getPayload();
    } catch {
      throw new ApiError(401, 'Invalid Google token. Please try again.');
    }

    if (!payload?.email || !payload.email_verified) {
      throw new ApiError(401, 'Google account email is not verified');
    }

    const email = payload.email.toLowerCase();
    const clientInfo = parseClientInfo(req);

    const allowed = await isDomainAllowed(email);
    if (!allowed) {
      await logSecurityEvent(null, 'LOGIN_FAILED', clientInfo, { email, reason: 'domain_restricted' });
      throw new ApiError(403, 'Login restricted to approved company domains');
    }

    let user = await prisma.user.findUnique({
      where: { email },
      include: { employee: { include: { department: true } } },
    });

    if (user?.deletedAt) throw new ApiError(403, 'Account has been deactivated');
    if (user?.status === 'INACTIVE') throw new ApiError(403, 'Account is inactive');

    if (!user) {
      // Google-only accounts get a random password; they can set one later via password reset
      const randomPassword = await hashPassword(crypto.randomBytes(32).toString('hex'));
      user = await prisma.user.create({
        data: {
          email,
          password: randomPassword,
          role: 'EMPLOYEE',
          emailVerified: true,
          employee: {
            create: {
              firstName: payload.given_name || payload.name || 'Google',
              lastName: payload.family_name || 'User',
            },
          },
        },
        include: { employee: { include: { department: true } } },
      });
      await logActivity(user.id, 'SIGNUP', 'User', user.id, { email, provider: 'google' }, req.ip);
    }

    const accessToken = generateAccessToken({ userId: user.id, role: user.role, email: user.email });
    const refreshTokenValue = generateRefreshToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({ data: { token: refreshTokenValue, userId: user.id, expiresAt } });

    await updateLoginMetadata(user.id, clientInfo);
    await logSecurityEvent(user.id, 'LOGIN_SUCCESS', clientInfo, { provider: 'google' });
    await logActivity(user.id, 'LOGIN', 'User', user.id, { provider: 'google' }, req.ip);

    const { password: _, ...safeUser } = user;
    return successResponse(res, {
      user: safeUser,
      accessToken,
      refreshToken: refreshTokenValue,
    }, 'Google login successful');
  } catch (error) {
    next(error);
  }
};

export const signup = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;

    const allowed = await isDomainAllowed(email);
    if (!allowed) throw new ApiError(403, 'Registration is restricted to approved company domains');

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ApiError(409, 'This email is already registered. Please sign in instead.');

    const hashed = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        role: 'EMPLOYEE',
        employee: {
          create: { firstName, lastName, phone },
        },
      },
      select: userSelect,
    });

    await logActivity(user.id, 'SIGNUP', 'User', user.id, { email }, req.ip);

    return successResponse(res, { user }, 'Account created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password, trustDevice: shouldTrust, deviceName } = req.body;
    const clientInfo = parseClientInfo(req);

    const allowed = await isDomainAllowed(email);
    if (!allowed) {
      await logSecurityEvent(null, 'LOGIN_FAILED', clientInfo, { email, reason: 'domain_restricted' });
      throw new ApiError(403, 'Login restricted to approved company domains');
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { employee: { include: { department: true } } },
    });

    if (!user || user.deletedAt) {
      await logSecurityEvent(user?.id, 'LOGIN_FAILED', clientInfo, { email });
      throw new ApiError(401, 'Invalid credentials');
    }
    if (user.status === 'INACTIVE') throw new ApiError(403, 'Account is inactive');

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      await logSecurityEvent(user.id, 'LOGIN_FAILED', clientInfo, { email });
      throw new ApiError(401, 'Invalid credentials');
    }

    const { riskScore, reasons, requiresMfa } = await assessLoginRisk(user, clientInfo);

  if (reasons.includes('new_country') || reasons.includes('impossible_travel')) {
    await handleSuspiciousLogin(user, clientInfo, reasons);
  }

  if (requiresMfa && !reasons.includes('untrusted_device')) {
      const code = await createMfaOtp(user.id);
      await sendMfaEmail(user.email, code);
      await logSecurityEvent(user.id, 'MFA_REQUIRED', clientInfo, { riskScore, reasons });
      const payload = {
        mfaRequired: true,
        userId: user.id,
        riskScore,
        reasons,
        message: isEmailConfigured()
          ? 'OTP sent to your email'
          : 'SMTP not configured — use the verification code shown below',
      };
      if (!isEmailConfigured()) payload.devOtp = code;
      return successResponse(res, payload, 'MFA verification required');
    }

    const accessToken = generateAccessToken({
      userId: user.id,
      role: user.role,
      email: user.email,
    });

    const refreshTokenValue = generateRefreshToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: { token: refreshTokenValue, userId: user.id, expiresAt },
    });

    if (shouldTrust) await trustDevice(user.id, clientInfo, deviceName);
    await updateLoginMetadata(user.id, clientInfo);
    await logSecurityEvent(user.id, 'LOGIN_SUCCESS', clientInfo, { riskScore });

    const { password: _, ...safeUser } = user;

    await logActivity(user.id, 'LOGIN', 'User', user.id, null, req.ip);

    return successResponse(res, {
      user: safeUser,
      accessToken,
      refreshToken: refreshTokenValue,
    }, 'Login successful');
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) throw new ApiError(400, 'Refresh token required');

    const stored = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new ApiError(401, 'Invalid or expired refresh token');
    }

    const accessToken = generateAccessToken({
      userId: stored.user.id,
      role: stored.user.role,
      email: stored.user.email,
    });

    return successResponse(res, { accessToken }, 'Token refreshed');
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (token) {
      await prisma.refreshToken.deleteMany({ where: { token } });
    }
    await logActivity(req.user.id, 'LOGOUT', 'User', req.user.id, null, req.ip);
    return successResponse(res, null, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const { password: _, ...safeUser } = req.user;
    return successResponse(res, { user: safeUser });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const { token, hashed } = generateResetToken();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken: hashed,
          resetExpires: new Date(Date.now() + 3600000),
        },
      });
      if (!isEmailConfigured()) {
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
        return successResponse(res, {
          devResetLink: resetUrl,
          message: 'SMTP not configured — use the reset link shown below',
        }, 'Password reset link generated (dev mode)');
      }
      await sendPasswordResetEmail(email, token);
    }

    return successResponse(res, null, 'If the email exists, a reset link has been sent');
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    const crypto = await import('crypto');
    const hashed = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        resetToken: hashed,
        resetExpires: { gt: new Date() },
      },
    });

    if (!user) throw new ApiError(400, 'Invalid or expired reset token');

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: await hashPassword(password),
        resetToken: null,
        resetExpires: null,
      },
    });

    return successResponse(res, null, 'Password reset successful');
  } catch (error) {
    next(error);
  }
};
