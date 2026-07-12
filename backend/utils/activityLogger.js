import prisma from '../config/database.js';

export const logActivity = async (userId, action, entityType, entityId = null, details = null, ipAddress = null) => {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        details,
        ipAddress,
      },
    });
  } catch (error) {
    console.error('Failed to log activity:', error.message);
  }
};
