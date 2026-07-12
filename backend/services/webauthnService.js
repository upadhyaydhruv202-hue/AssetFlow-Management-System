import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import prisma from '../config/database.js';
import { getWebAuthnConfig } from '../utils/webauthnConfig.js';
import { logSecurityEvent } from './securityService.js';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const challengeStore = new Map();

const storeChallenge = (key, challenge) => {
  challengeStore.set(key, { challenge, expiresAt: Date.now() + CHALLENGE_TTL_MS });
};

const consumeChallenge = (key) => {
  const entry = challengeStore.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    challengeStore.delete(key);
    return null;
  }
  challengeStore.delete(key);
  return entry.challenge;
};

const getExistingCredentials = async (userId) => {
  const creds = await prisma.webAuthnCredential.findMany({ where: { userId } });
  return creds.map((c) => ({
    id: c.credentialId,
    transports: ['internal', 'hybrid'],
  }));
};

const isLegacyFakePasskey = (credentialId) => credentialId.startsWith('passkey-');

const removeLegacyPasskeys = async (userId) => {
  await prisma.webAuthnCredential.deleteMany({
    where: { userId, credentialId: { startsWith: 'passkey-' } },
  });
};

export const getRegistrationOptions = async (user) => {
  const { rpName, rpID } = getWebAuthnConfig();

  await removeLegacyPasskeys(user.id);

  const excludeCredentials = await getExistingCredentials(user.id);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.email,
    userDisplayName: user.employee
      ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
      : user.email,
    userID: new TextEncoder().encode(user.id),
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    preferredAuthenticatorType: 'platform',
  });

  storeChallenge(`reg:${user.id}`, options.challenge);
  return options;
};

export const verifyRegistration = async (user, response, deviceName) => {
  const { origin, rpID } = getWebAuthnConfig();
  const expectedChallenge = consumeChallenge(`reg:${user.id}`);
  if (!expectedChallenge) {
    throw new Error('Registration challenge expired. Please try again.');
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: false,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('Passkey registration could not be verified');
  }

  const { credential } = verification.registrationInfo;
  const cred = await prisma.webAuthnCredential.create({
    data: {
      userId: user.id,
      credentialId: credential.id,
      publicKey: isoBase64URL.fromBuffer(credential.publicKey),
      counter: credential.counter,
      deviceName: deviceName || 'Windows Hello',
    },
  });

  await logSecurityEvent(user.id, 'PASSKEY_REGISTERED', {
    ip: 'local',
    browser: deviceName || 'Windows Hello',
    country: 'local',
    fingerprint: null,
  });

  return cred;
};

export const getAuthenticationOptions = async (email) => {
  const { rpID } = getWebAuthnConfig();
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Email is required for passkey sign-in');
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    include: { webAuthnCreds: true },
  });

  if (!user) {
    throw new Error('No account found with this email.');
  }

  const legacyCreds = user.webAuthnCreds.filter((c) => isLegacyFakePasskey(c.credentialId));
  if (legacyCreds.length > 0) {
    await prisma.webAuthnCredential.deleteMany({
      where: { id: { in: legacyCreds.map((c) => c.id) } },
    });
  }

  const realCreds = user.webAuthnCreds.filter((c) => !isLegacyFakePasskey(c.credentialId));

  if (realCreds.length === 0) {
    throw new Error(
      'No Windows Hello passkey on this account. Sign in with your password, go to Profile → Security Settings, click Register Passkey, and complete the Windows Hello prompt.'
    );
  }

  const allowCredentials = realCreds.map((c) => ({
    id: c.credentialId,
    transports: ['internal', 'hybrid'],
  }));

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification: 'preferred',
  });

  storeChallenge(`auth:${normalizedEmail}`, options.challenge);
  return options;
};

export const verifyAuthentication = async (response) => {
  const { origin, rpID } = getWebAuthnConfig();

  const storedCred = await prisma.webAuthnCredential.findUnique({
    where: { credentialId: response.id },
    include: { user: { include: { employee: { include: { department: true } } } } },
  });

  if (!storedCred) {
    throw new Error('Unknown passkey');
  }

  const expectedChallenge = consumeChallenge(`auth:${storedCred.user.email.toLowerCase()}`);
  if (!expectedChallenge) {
    throw new Error('Authentication challenge expired. Please try again.');
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: storedCred.credentialId,
      publicKey: isoBase64URL.toBuffer(storedCred.publicKey),
      counter: storedCred.counter,
      transports: ['internal', 'hybrid'],
    },
    requireUserVerification: false,
  });

  if (!verification.verified) {
    throw new Error('Passkey authentication could not be verified');
  }

  await prisma.webAuthnCredential.update({
    where: { id: storedCred.id },
    data: {
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    },
  });

  return storedCred.user;
};

export const deletePasskey = async (userId, passkeyId) => {
  const deleted = await prisma.webAuthnCredential.deleteMany({
    where: { id: passkeyId, userId },
  });
  if (deleted.count === 0) {
    throw new Error('Passkey not found');
  }
  await logSecurityEvent(userId, 'PASSKEY_REMOVED', {
    ip: 'local',
    browser: 'Security Settings',
    country: 'local',
    fingerprint: null,
  });
};
