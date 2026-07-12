import prisma from '../config/database.js';
import { ApiError } from '../utils/apiResponse.js';
import { createNotification, notifyUsers } from './notificationService.js';

export const closeAuditCycle = async (cycleId, userId) => {
  const cycle = await prisma.auditCycle.findUnique({
    where: { id: cycleId },
    include: { items: { include: { asset: true } } },
  });

  if (!cycle) throw new ApiError(404, 'Audit cycle not found');
  if (cycle.status === 'CLOSED') throw new ApiError(400, 'Audit cycle already closed');

  const missingItems = cycle.items.filter((i) => i.status === 'MISSING');
  const damagedItems = cycle.items.filter((i) => i.status === 'DAMAGED');

  for (const item of missingItems) {
    await prisma.asset.update({
      where: { id: item.assetId },
      data: { status: 'LOST' },
    });
  }

  for (const item of damagedItems) {
    await prisma.asset.update({
      where: { id: item.assetId },
      data: { condition: 'DAMAGED' },
    });
  }

  const updated = await prisma.auditCycle.update({
    where: { id: cycleId },
    data: { status: 'CLOSED', closedAt: new Date() },
    include: {
      items: { include: { asset: true, auditor: true } },
      assignments: { include: { auditor: true } },
      department: true,
    },
  });

  const discrepancies = [...missingItems, ...damagedItems];
  if (discrepancies.length) {
    const managers = await prisma.user.findMany({
      where: { role: 'ADMIN', status: 'ACTIVE' },
      select: { id: true },
    });
    await notifyUsers(
      managers.map((m) => m.id),
      'AUDIT_DISCREPANCY',
      'Audit Discrepancies Found',
      `${discrepancies.length} discrepancies found in audit "${cycle.name}"`,
      `/audit/${cycleId}`
    );
  }

  return {
    cycle: updated,
    discrepancyReport: {
      total: cycle.items.length,
      verified: cycle.items.filter((i) => i.status === 'VERIFIED').length,
      missing: missingItems.length,
      damaged: damagedItems.length,
      pending: cycle.items.filter((i) => i.status === 'PENDING').length,
      items: discrepancies,
    },
  };
};

export const generateDiscrepancyReport = async (cycleId) => {
  const items = await prisma.auditItem.findMany({
    where: {
      auditCycleId: cycleId,
      status: { in: ['MISSING', 'DAMAGED'] },
    },
    include: {
      asset: { include: { category: true } },
      auditor: true,
    },
  });

  return {
    count: items.length,
    items,
  };
};
