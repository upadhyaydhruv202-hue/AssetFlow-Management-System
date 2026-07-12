import 'dotenv/config';
import nodemailer from 'nodemailer';
import logger from './logger.js';

let transporter = null;

const createTransporter = () => {
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure,
    auth: process.env.SMTP_USER && process.env.SMTP_PASS
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
    tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
  });
};

export const getTransporter = () => {
  if (!transporter) transporter = createTransporter();
  return transporter;
};

export const resetTransporter = () => { transporter = null; };

export const getFromAddress = () => {
  if (process.env.SMTP_FROM) return process.env.SMTP_FROM;
  if (process.env.SMTP_USER) return `AssetFlow <${process.env.SMTP_USER}>`;
  return 'AssetFlow <noreply@assetflow.com>';
};

export const verifyMailConnection = async () => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return { configured: false, message: 'SMTP_USER and SMTP_PASS not set in .env' };
  }
  try {
    await getTransporter().verify();
    return { configured: true, message: `SMTP ready (${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587})` };
  } catch (error) {
    logger.error('SMTP verification failed:', error.message);
    return { configured: false, message: error.message };
  }
};

export default getTransporter;
