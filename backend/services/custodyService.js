import prisma from '../config/database.js';

export const recordCustodyEvent = async ({ assetId, eventType, fromName, toName, performedBy, entityId, notes }) => {
  return prisma.custodyEvent.create({
    data: { assetId, eventType, fromName, toName, performedBy, entityId, notes },
  });
};

export const getCustodyTimeline = async (assetId) => {
  return prisma.custodyEvent.findMany({
    where: { assetId },
    orderBy: { createdAt: 'desc' },
  });
};

export const storeSignature = async ({ userId, signatureType, signatureData, entityType, entityId }) => {
  return prisma.digitalSignature.create({
    data: { userId, signatureType, signatureData, entityType, entityId },
  });
};
