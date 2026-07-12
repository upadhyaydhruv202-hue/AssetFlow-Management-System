import prisma from '../config/database.js';
import { generateQRCode } from './qrService.js';
import { createNotification } from './notificationService.js';

export const generateBookingQR = async (bookingId) => {
  const qrCode = await generateQRCode(`BOOKING:${bookingId}`);
  await prisma.booking.update({ where: { id: bookingId }, data: { qrCode } });
  return qrCode;
};

export const checkInBooking = async (bookingId, qrData) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { asset: true, employee: true },
  });
  if (!booking) return { success: false, message: 'Booking not found' };
  if (qrData && !qrData.includes(bookingId)) return { success: false, message: 'Invalid QR code' };

  await prisma.booking.update({
    where: { id: bookingId },
    data: { checkInAt: new Date(), status: 'ONGOING' },
  });
  return { success: true, booking };
};

export const addToWaitlist = async ({ assetId, employeeId, startTime, endTime }) => {
  const count = await prisma.bookingWaitlist.count({ where: { assetId, status: 'WAITING' } });
  return prisma.bookingWaitlist.create({
    data: {
      assetId,
      employeeId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      position: count + 1,
    },
  });
};

export const promoteWaitlist = async (assetId, cancelledStart, cancelledEnd) => {
  const next = await prisma.bookingWaitlist.findFirst({
    where: { assetId, status: 'WAITING' },
    orderBy: { position: 'asc' },
    include: { employee: { include: { user: true } } },
  });
  if (!next) return null;

  const booking = await prisma.booking.create({
    data: {
      assetId,
      employeeId: next.employeeId,
      title: 'Promoted from waitlist',
      startTime: next.startTime,
      endTime: next.endTime,
      status: 'UPCOMING',
    },
  });

  await prisma.bookingWaitlist.update({
    where: { id: next.id },
    data: { status: 'PROMOTED' },
  });

  await createNotification(
    next.employee.userId,
    'WAITLIST_PROMOTED',
    'Waitlist Promotion',
    `You have been promoted from the waitlist for a booking.`,
    '/bookings'
  );

  return booking;
};

export const processNoShows = async () => {
  const now = new Date();
  const gracePeriod = 15 * 60000;
  const noShows = await prisma.booking.findMany({
    where: {
      status: 'UPCOMING',
      startTime: { lt: new Date(now - gracePeriod) },
      checkInAt: null,
      noShowReleased: false,
    },
    include: { employee: true, asset: true },
  });

  for (const booking of noShows) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'CANCELLED', noShowReleased: true },
    });
    await promoteWaitlist(booking.assetId, booking.startTime, booking.endTime);
    await createNotification(
      booking.employee.userId,
      'BOOKING_CANCELLED',
      'No-show: Booking Released',
      `Your booking for ${booking.asset.name} was released due to no check-in.`,
      '/bookings'
    );
  }
  return noShows.length;
};

export const generateCalendarEvent = (booking) => {
  const formatICS = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  return {
    calendarEventId: `assetflow-${booking.id}`,
    ics: [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `UID:assetflow-${booking.id}@assetflow.com`,
      `DTSTART:${formatICS(new Date(booking.startTime))}`,
      `DTEND:${formatICS(new Date(booking.endTime))}`,
      `SUMMARY:${booking.title || 'AssetFlow Booking'}`,
      `DESCRIPTION:Booking for asset ${booking.assetId}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n'),
  };
};
