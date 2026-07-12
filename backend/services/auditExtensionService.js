import prisma from '../config/database.js';
import { detectMissingAssets } from './aiService.js';

export const generateAutoDiscrepancyReport = async (auditCycleId) => {
  const items = await prisma.auditItem.findMany({
    where: { auditCycleId },
    include: { asset: { include: { category: true } } },
  });

  const discrepancies = items.filter((i) => ['MISSING', 'DAMAGED'].includes(i.status));
  const pending = items.filter((i) => i.status === 'PENDING');
  const aiAnomalies = await detectMissingAssets(auditCycleId);

  const report = {
    generatedAt: new Date().toISOString(),
    totalItems: items.length,
    verified: items.filter((i) => i.status === 'VERIFIED').length,
    missing: discrepancies.filter((i) => i.status === 'MISSING').length,
    damaged: discrepancies.filter((i) => i.status === 'DAMAGED').length,
    pending: pending.length,
    discrepancyRate: items.length ? Math.round((discrepancies.length / items.length) * 100) : 0,
    items: discrepancies.map((i) => ({
      assetTag: i.asset.assetTag,
      name: i.asset.name,
      status: i.status,
      notes: i.notes,
    })),
    aiAnomalies,
  };

  await prisma.auditCycle.update({
    where: { id: auditCycleId },
    data: { autoDiscrepancyReport: report },
  });

  return report;
};

export const storeOfflineSync = async (auditCycleId, auditorId, payload) => {
  return prisma.auditOfflineSync.create({
    data: { auditCycleId, auditorId, payload },
  });
};

export const syncOfflineAudit = async (syncId) => {
  const sync = await prisma.auditOfflineSync.findUnique({ where: { id: syncId } });
  if (!sync || sync.syncedAt) return null;

  const { items } = sync.payload;
  for (const item of items || []) {
    if (item.itemId && item.status) {
      await prisma.auditItem.update({
        where: { id: item.itemId },
        data: { status: item.status, notes: item.notes, verifiedAt: new Date(), auditorId: sync.auditorId },
      });
    }
  }

  await prisma.auditOfflineSync.update({
    where: { id: syncId },
    data: { syncedAt: new Date() },
  });

  return sync;
};

export const verifyByQR = async (auditCycleId, assetTag, auditorId) => {
  const item = await prisma.auditItem.findFirst({
    where: { auditCycleId, asset: { assetTag } },
    include: { asset: true },
  });
  if (!item) return { found: false, message: 'Asset not in this audit cycle' };

  await prisma.auditItem.update({
    where: { id: item.id },
    data: { status: 'VERIFIED', verifiedAt: new Date(), auditorId },
  });

  return { found: true, item, asset: item.asset };
};
