import prisma from '../config/database.js';

const CONDITION_SCORES = { EXCELLENT: 100, GOOD: 85, FAIR: 65, POOR: 40, DAMAGED: 15 };

export const calculateHealthScore = async (assetId) => {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: {
      maintenanceRequests: true,
      allocations: { where: { status: { in: ['ACTIVE', 'OVERDUE', 'RETURNED'] } } },
      category: true,
    },
  });
  if (!asset) return 100;

  let score = CONDITION_SCORES[asset.condition] || 70;

  const failures = asset.maintenanceRequests.filter((m) => m.status === 'RESOLVED').length;
  score -= failures * 5;

  const openMaint = asset.maintenanceRequests.filter((m) => m.status !== 'RESOLVED' && m.status !== 'REJECTED').length;
  score -= openMaint * 10;

  if (asset.acquisitionDate) {
    const ageYears = (Date.now() - new Date(asset.acquisitionDate).getTime()) / (365.25 * 86400000);
    score -= Math.min(30, ageYears * 3);
  }

  score -= Math.min(15, asset.allocations.length * 2);

  if (asset.warrantyExpiryDate) {
    const daysToWarranty = (new Date(asset.warrantyExpiryDate) - Date.now()) / 86400000;
    if (daysToWarranty < 0) score -= 10;
    else if (daysToWarranty < 30) score -= 5;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
};

export const updateAssetHealth = async (assetId) => {
  const healthScore = await calculateHealthScore(assetId);
  await prisma.asset.update({ where: { id: assetId }, data: { healthScore } });
  return healthScore;
};

export const getWarrantyTimeline = (asset) => {
  if (!asset.warrantyExpiryDate && !asset.acquisitionDate) return { events: [], status: 'unknown' };

  const events = [];
  if (asset.acquisitionDate) {
    events.push({ date: asset.acquisitionDate, label: 'Acquisition', type: 'start' });
  }
  if (asset.category?.warrantyPeriod && asset.acquisitionDate) {
    const warrantyEnd = new Date(asset.acquisitionDate);
    warrantyEnd.setMonth(warrantyEnd.getMonth() + asset.category.warrantyPeriod);
    events.push({ date: warrantyEnd, label: 'Warranty End (calculated)', type: 'warranty' });
  }
  if (asset.warrantyExpiryDate) {
    events.push({ date: asset.warrantyExpiryDate, label: 'Warranty Expiry', type: 'expiry' });
  }

  const now = new Date();
  const expiry = asset.warrantyExpiryDate ? new Date(asset.warrantyExpiryDate) : null;
  let status = 'active';
  if (expiry && expiry < now) status = 'expired';
  else if (expiry && (expiry - now) / 86400000 < 30) status = 'expiring_soon';

  return { events: events.sort((a, b) => new Date(a.date) - new Date(b.date)), status, daysRemaining: expiry ? Math.ceil((expiry - now) / 86400000) : null };
};

export const recordAssetHistory = async (assetId, action, changedBy, { field, oldValue, newValue, details } = {}) => {
  return prisma.assetHistory.create({
    data: { assetId, action, field, oldValue: oldValue?.toString(), newValue: newValue?.toString(), changedBy, details },
  });
};

export const getDigitalTwin = async (assetId) => {
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, deletedAt: null },
    include: {
      category: true,
      history: { orderBy: { createdAt: 'desc' }, take: 50 },
      custodyEvents: { orderBy: { createdAt: 'desc' }, take: 30 },
      maintenanceRequests: { orderBy: { createdAt: 'desc' }, take: 20 },
      allocations: { orderBy: { createdAt: 'desc' }, take: 20, include: { employee: true } },
    },
  });
  if (!asset) return null;

  const warranty = getWarrantyTimeline(asset);
  const healthScore = asset.healthScore || await calculateHealthScore(assetId);

  return {
    profile: {
      id: asset.id,
      assetTag: asset.assetTag,
      name: asset.name,
      specifications: asset.specifications || {},
      healthScore,
      condition: asset.condition,
      location: asset.location,
      qrCode: asset.qrCode,
      rfidIdentifier: asset.rfidIdentifier,
    },
    warranty,
    timeline: [
      ...asset.history.map((h) => ({ type: 'history', date: h.createdAt, action: h.action, details: h.details })),
      ...asset.custodyEvents.map((c) => ({ type: 'custody', date: c.createdAt, action: c.eventType, from: c.fromName, to: c.toName })),
      ...asset.maintenanceRequests.map((m) => ({ type: 'maintenance', date: m.createdAt, action: m.title, status: m.status })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date)),
    documents: { photoUrl: asset.photoUrl, documentUrl: asset.documentUrl },
  };
};

export const getAssetHealthOverview = async (limit = 10) => {
  return prisma.asset.findMany({
    where: { deletedAt: null },
    select: { id: true, assetTag: true, name: true, healthScore: true, condition: true, status: true, category: { select: { name: true } } },
    orderBy: { healthScore: 'asc' },
    take: limit,
  });
};
