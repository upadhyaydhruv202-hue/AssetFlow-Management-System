import prisma from '../config/database.js';
import { paginatedResponse, parsePagination, buildPagination } from '../utils/apiResponse.js';

export const getActivityLogs = async (req, res, next) => {
  try {
    const { page, limit, skip, sortOrder } = parsePagination(req.query);
    const { entityType, userId, action } = req.query;

    const where = {
      ...(entityType && { entityType }),
      ...(userId && { userId }),
      ...(action && { action: { contains: action, mode: 'insensitive' } }),
    };

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: sortOrder },
        include: {
          user: {
            select: {
              email: true,
              employee: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      prisma.activityLog.count({ where }),
    ]);

    return paginatedResponse(res, logs, buildPagination(total, page, limit));
  } catch (error) {
    next(error);
  }
};
