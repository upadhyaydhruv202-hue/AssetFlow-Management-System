import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from '@simplewebauthn/browser';

export async function isPasskeySupported() {
  return browserSupportsWebAuthn();
}

export async function hasPlatformAuthenticator() {
  if (!browserSupportsWebAuthn()) return false;
  return platformAuthenticatorIsAvailable();
}

function getDeviceName() {
  const ua = navigator.userAgent;
  if (ua.includes('Windows')) return 'Windows Hello';
  if (ua.includes('Mac')) return 'Touch ID';
  return ua.slice(0, 60);
}

export async function registerPasskey(api) {
  const { data } = await api.post('/auth/passkey/register/options');
  const attestation = await startRegistration({ optionsJSON: data.data });
  const { data: result } = await api.post('/auth/passkey/register/verify', {
    response: attestation,
    deviceName: getDeviceName(),
  });
  return result.data;
}

export async function loginWithPasskey(api, email) {
  const trimmed = email?.trim();
  if (!trimmed) {
    throw new Error('Enter your email address, then click Sign in with Passkey');
  }

  const { data } = await api.post('/auth/passkey/authenticate/options', { email: trimmed.toLowerCase() });
  const assertion = await startAuthentication({ optionsJSON: data.data });
  const { data: result } = await api.post('/auth/passkey/authenticate/verify', {
    response: assertion,
  });
  return result.data;
}
