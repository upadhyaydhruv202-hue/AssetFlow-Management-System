import prisma from '../config/database.js';
import { ApiError, successResponse, paginatedResponse, parsePagination, buildPagination } from '../utils/apiResponse.js';
import { logActivity } from '../utils/activityLogger.js';
import { createNotification } from '../services/notificationService.js';
import { generateBookingQR, generateCalendarEvent } from '../services/bookingExtensionService.js';

const checkOverlap = async (assetId, startTime, endTime, excludeId = null) => {
  const overlapping = await prisma.booking.findFirst({
    where: {
      assetId,
      status: { not: 'CANCELLED' },
      ...(excludeId && { id: { not: excludeId } }),
      AND: [
        { startTime: { lt: new Date(endTime) } },
        { endTime: { gt: new Date(startTime) } },
      ],
    },
    include: { employee: true },
  });
  return overlapping;
};

export const getBookings = async (req, res, next) => {
  try {
    const { page, limit, skip, sortBy, sortOrder } = parsePagination(req.query);
    const { assetId, status, employeeId, startDate, endDate } = req.query;

    const where = {
      ...(assetId && { assetId }),
      ...(status && { status }),
      ...(employeeId && { employeeId }),
      ...(startDate && endDate && {
        startTime: { gte: new Date(startDate) },
        endTime: { lte: new Date(endDate) },
      }),
    };

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          asset: { include: { category: true } },
          employee: true,
        },
      }),
      prisma.booking.count({ where }),
    ]);

    return paginatedResponse(res, bookings, buildPagination(total, page, limit));
  } catch (error) {
    next(error);
  }
};

export const getAssetBookings = async (req, res, next) => {
  try {
    const { assetId } = req.params;
    const { startDate, endDate } = req.query;

    const where = {
      assetId,
      status: { not: 'CANCELLED' },
      ...(startDate && endDate && {
        startTime: { gte: new Date(startDate) },
        endTime: { lte: new Date(endDate) },
      }),
    };

    const bookings = await prisma.booking.findMany({
      where,
      include: { employee: true },
      orderBy: { startTime: 'asc' },
    });

    return successResponse(res, bookings);
  } catch (error) {
    next(error);
  }
};

export const createBooking = async (req, res, next) => {
  try {
    const { assetId, title, startTime, endTime, notes } = req.body;

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) throw new ApiError(404, 'Asset not found');
    if (!asset.isBookable) throw new ApiError(400, 'This asset is not bookable');

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (end <= start) throw new ApiError(400, 'End time must be after start time');

    const overlap = await checkOverlap(assetId, start, end);
    if (overlap) {
      const holder = `${overlap.employee.firstName} ${overlap.employee.lastName}`;
      throw new ApiError(409, `Time slot overlaps with existing booking by ${holder}`, {
        conflictingBooking: overlap,
      });
    }

    const booking = await prisma.booking.create({
      data: {
        assetId,
        employeeId: req.employee.id,
        title,
        startTime: start,
        endTime: end,
        notes,
        status: 'UPCOMING',
      },
      include: {
        asset: true,
        employee: true,
      },
    });

    const qrCode = await generateBookingQR(booking.id);
    const cal = generateCalendarEvent(booking);
    await prisma.booking.update({
      where: { id: booking.id },
      data: { calendarEventId: cal.calendarEventId },
    });
    booking.qrCode = qrCode;
    booking.calendarEventId = cal.calendarEventId;

    await createNotification(
      req.user.id,
      'BOOKING_CONFIRMED',
      'Booking Confirmed',
      `Your booking for ${asset.name} is confirmed`,
      `/bookings`
    );

    await logActivity(req.user.id, 'CREATE', 'Booking', booking.id, req.body, req.ip);
    return successResponse(res, booking, 'Booking created', 201);
  } catch (error) {
    next(error);
  }
};

export const cancelBooking = async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { asset: true },
    });

    if (!booking) throw new ApiError(404, 'Booking not found');
    if (booking.status === 'CANCELLED') throw new ApiError(400, 'Booking already cancelled');
    if (booking.status === 'COMPLETED') throw new ApiError(400, 'Cannot cancel completed booking');

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'CANCELLED' },
      include: { asset: true, employee: true },
    });

    await createNotification(
      booking.employeeId === req.employee.id ? req.user.id : (await prisma.employee.findUnique({ where: { id: booking.employeeId } }))?.userId,
      'BOOKING_CANCELLED',
      'Booking Cancelled',
      `Booking for ${booking.asset.name} has been cancelled`,
      '/bookings'
    );

    await logActivity(req.user.id, 'CANCEL', 'Booking', booking.id, null, req.ip);
    return successResponse(res, updated, 'Booking cancelled');
  } catch (error) {
    next(error);
  }
};

export const rescheduleBooking = async (req, res, next) => {
  try {
    const { startTime, endTime } = req.body;
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });

    if (!booking) throw new ApiError(404, 'Booking not found');
    if (booking.status === 'CANCELLED' || booking.status === 'COMPLETED') {
      throw new ApiError(400, 'Cannot reschedule this booking');
    }

    const overlap = await checkOverlap(booking.assetId, startTime, endTime, booking.id);
    if (overlap) {
      throw new ApiError(409, 'New time slot overlaps with existing booking');
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        reminderSent: false,
      },
      include: { asset: true, employee: true },
    });

    await logActivity(req.user.id, 'RESCHEDULE', 'Booking', booking.id, req.body, req.ip);
    return successResponse(res, updated, 'Booking rescheduled');
  } catch (error) {
    next(error);
  }
};

export const getMyBookings = async (req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { employeeId: req.employee.id },
      include: { asset: { include: { category: true } } },
      orderBy: { startTime: 'desc' },
    });
    return successResponse(res, bookings);
  } catch (error) {
    next(error);
  }
};
