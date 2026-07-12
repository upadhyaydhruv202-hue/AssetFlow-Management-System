import prisma from '../config/database.js';
import { ApiError, successResponse, paginatedResponse, parsePagination, buildPagination } from '../utils/apiResponse.js';
import { summarizeNotifications } from '../services/aiService.js';

export const getNotifications = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { isRead } = req.query;

    const where = {
      userId: req.user.id,
      ...(isRead !== undefined && { isRead: isRead === 'true' }),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: req.user.id, isRead: false } }),
    ]);

    return res.status(200).json({
      success: true,
      data: notifications,
      unreadCount,
      pagination: buildPagination(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { isRead: true },
    });
    return successResponse(res, null, 'Notification marked as read');
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead = async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });
    return successResponse(res, null, 'All notifications marked as read');
  } catch (error) {
    next(error);
  }
};

export const deleteNotification = async (req, res, next) => {
  try {
    await prisma.notification.deleteMany({
      where: { id: req.params.id, userId: req.user.id },
    });
    return successResponse(res, null, 'Notification deleted');
  } catch (error) {
    next(error);
  }
};

export const getAiSummary = async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id, isRead: false },
      orderBy: { createdAt: 'desc' },
    });
    const summary = summarizeNotifications(notifications);
    const grouped = notifications.reduce((acc, n) => {
      const key = n.type.includes('SECURITY') ? 'Security' :
        n.type.includes('MAINTENANCE') ? 'Maintenance' :
        n.type.includes('BOOKING') ? 'Bookings' :
        n.type.includes('ASSET') || n.type.includes('TRANSFER') ? 'Assets' : 'General';
      if (!acc[key]) acc[key] = [];
      acc[key].push(n);
      return acc;
    }, {});
    return successResponse(res, { ...summary, grouped });
  } catch (error) {
    next(error);
  }
};
