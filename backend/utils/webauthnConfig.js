export const getWebAuthnConfig = () => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const configuredOrigin = process.env.WEBAUTHN_ORIGIN || frontendUrl;
  const origins = new Set([configuredOrigin, frontendUrl, 'http://localhost:5173', 'http://127.0.0.1:5173']);

  return {
    rpName: process.env.WEBAUTHN_RP_NAME || 'AssetFlow',
    rpID: process.env.WEBAUTHN_RP_ID || 'localhost',
    origin: [...origins],
  };
};