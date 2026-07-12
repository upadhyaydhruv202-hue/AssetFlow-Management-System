import prisma from '../config/database.js';

const creds = await prisma.webAuthnCredential.findMany({
  include: { user: { select: { email: true } } },
});
console.log('Passkeys in DB:', creds.length);
for (const c of creds) {
  const legacy = c.credentialId.startsWith('passkey-');
  console.log('-', c.user.email, legacy ? '[LEGACY FAKE]' : '[REAL]', c.credentialId.slice(0, 30), c.deviceName);
}

await prisma.$disconnect();
