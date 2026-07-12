import 'dotenv/config';
import { verifyMailConnection, sendTestEmail } from '../services/mailService.js';

const status = await verifyMailConnection();
console.log('SMTP Status:', status);

if (status.configured) {
  await sendTestEmail('aaruv5620@gmail.com');
  console.log('Test email sent to aaruv5620@gmail.com — check your inbox!');
} else {
  console.error('SMTP not ready:', status.message);
  process.exit(1);
}
