import prisma from '../config/database.js';

export const createNotification = async (userId, type, title, message, link = null) => {
  return prisma.notification.create({
    data: { userId, type, title, message, link },
  });
};

export const notifyUsers = async (userIds, type, title, message, link = null) => {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (!uniqueIds.length) return [];
  return prisma.notification.createMany({
    data: uniqueIds.map((userId) => ({ userId, type, title, message, link })),
  });
};

export const getManagersAndAdmins = async () => {
  const users = await prisma.user.findMany({
    where: {
      role: 'ADMIN',
      status: 'ACTIVE',
      deletedAt: null,
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
};
