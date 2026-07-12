import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import authRoutes from './routes/authRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import assetRoutes from './routes/assetRoutes.js';
import allocationRoutes from './routes/allocationRoutes.js';
import transferRoutes from './routes/transferRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import maintenanceRoutes from './routes/maintenanceRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import enterpriseRoutes from './routes/enterpriseRoutes.js';
import securityRoutes from './routes/securityRoutes.js';

import { errorHandler, notFound } from './middleware/errorHandler.js';
import logger from './config/logger.js';
import { updateOverdueAllocations, updateBookingStatuses } from './services/dashboardService.js';
import { processMaintenanceRetirementAlerts } from './services/reportExtensionService.js';
import { processNoShows } from './services/bookingExtensionService.js';
import { checkSlaBreaches } from './services/maintenanceExtensionService.js';
import prisma from './config/database.js';
import { createNotification } from './services/notificationService.js';
import { verifyMailConnection } from './services/mailService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', async (_req, res) => {
  const mail = await verifyMailConnection();
  res.json({
    success: true,
    message: 'AssetFlow API is running',
    timestamp: new Date().toISOString(),
    email: mail,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/allocations', allocationRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/audits', auditRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api', enterpriseRoutes);
app.use('/api/security', securityRoutes);

app.use(notFound);
app.use(errorHandler);

const runScheduledTasks = async () => {
  try {
    await updateOverdueAllocations();
    await updateBookingStatuses();
    await processNoShows();
    await checkSlaBreaches();
    await processMaintenanceRetirementAlerts();

    const overdueAllocations = await prisma.allocation.findMany({
      where: { isOverdue: true, status: 'OVERDUE' },
      include: { employee: true, asset: true },
    });

    for (const alloc of overdueAllocations) {
      if (alloc.employee) {
        await createNotification(
          alloc.employee.userId,
          'OVERDUE_RETURN',
          'Overdue Return Alert',
          `Asset ${alloc.asset.assetTag} return is overdue`,
          '/allocation/returns'
        );
      }
    }

    const upcomingBookings = await prisma.booking.findMany({
      where: {
        status: 'UPCOMING',
        reminderSent: false,
        startTime: {
          lte: new Date(Date.now() + 30 * 60 * 1000),
          gte: new Date(),
        },
      },
      include: { employee: true, asset: true },
    });

    for (const booking of upcomingBookings) {
      await createNotification(
        booking.employee.userId,
        'BOOKING_REMINDER',
        'Booking Reminder',
        `Your booking for ${booking.asset.name} starts in 30 minutes`,
        '/bookings'
      );
      await prisma.booking.update({
        where: { id: booking.id },
        data: { reminderSent: true },
      });
    }
  } catch (error) {
    logger.error('Scheduled task error:', error);
  }
};

setInterval(runScheduledTasks, 5 * 60 * 1000);

app.listen(PORT, async () => {
  logger.info(`AssetFlow API server running on port ${PORT}`);
  const mail = await verifyMailConnection();
  if (mail.configured) {
    logger.info(`Email: ${mail.message}`);
  } else {
    logger.warn(`Email: ${mail.message} — emails will NOT be delivered until SMTP is configured in .env`);
  }
  runScheduledTasks();
});

export default app;
