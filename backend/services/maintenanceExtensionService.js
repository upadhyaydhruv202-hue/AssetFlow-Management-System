import prisma from '../config/database.js';
import { predictMaintenance } from './aiService.js';
import { createNotification } from './notificationService.js';

const SLA_HOURS = { LOW: 168, MEDIUM: 72, HIGH: 24, CRITICAL: 8 };

export const setMaintenanceSla = (priority, createdAt = new Date()) => {
  const hours = SLA_HOURS[priority] || 72;
  return new Date(createdAt.getTime() + hours * 3600000);
};

export const calculateMttr = async () => {
  const resolved = await prisma.maintenanceRequest.findMany({
    where: { status: 'RESOLVED', startedAt: { not: null }, resolvedAt: { not: null } },
    select: { startedAt: true, resolvedAt: true, priority: true, mttrMinutes: true },
  });

  const byPriority = {};
  resolved.forEach((r) => {
    const minutes = r.mttrMinutes || Math.round((new Date(r.resolvedAt) - new Date(r.startedAt)) / 60000);
    if (!byPriority[r.priority]) byPriority[r.priority] = [];
    byPriority[r.priority].push(minutes);
  });

  const result = {};
  Object.entries(byPriority).forEach(([priority, times]) => {
    result[priority] = {
      count: times.length,
      avgMinutes: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
      min: Math.min(...times),
      max: Math.max(...times),
    };
  });

  const allTimes = resolved.map((r) => r.mttrMinutes || Math.round((new Date(r.resolvedAt) - new Date(r.startedAt)) / 60000));
  return {
    overall: allTimes.length ? Math.round(allTimes.reduce((a, b) => a + b, 0) / allTimes.length) : 0,
    byPriority: result,
    chartData: Object.entries(result).map(([priority, data]) => ({ priority, mttr: data.avgMinutes, count: data.count })),
  };
};

export const getSlaBreaches = async () => {
  const now = new Date();
  return prisma.maintenanceRequest.findMany({
    where: {
      status: { notIn: ['RESOLVED', 'REJECTED'] },
      slaDeadline: { lt: now },
    },
    include: { asset: true, requestedBy: true },
    orderBy: { slaDeadline: 'asc' },
  });
};

export const checkSlaBreaches = async () => {
  const breaches = await getSlaBreaches();
  for (const req of breaches) {
    const existing = await prisma.notification.findFirst({
      where: { userId: req.requestedBy.userId, type: 'MAINTENANCE_SLA_BREACH', message: { contains: req.id } },
    });
    if (!existing) {
      await createNotification(
        req.requestedBy.userId,
        'MAINTENANCE_SLA_BREACH',
        'SLA Breach',
        `Maintenance request "${req.title}" (${req.id}) has exceeded SLA deadline.`,
        `/maintenance/${req.id}`
      );
    }
  }
};

export const getPredictiveMaintenanceList = async () => {
  const assets = await prisma.asset.findMany({
    where: { deletedAt: null, healthScore: { lt: 70 } },
    take: 20,
  });

  const predictions = [];
  for (const asset of assets) {
    const pred = await predictMaintenance(asset.id);
    if (pred) predictions.push({ asset, ...pred });
  }
  return predictions.sort((a, b) => new Date(a.predictedDate) - new Date(b.predictedDate));
};

export const generateSensorReadings = async (assetId) => {
  const types = [
    { sensorType: 'temperature', unit: '°C', min: 18, max: 35 },
    { sensorType: 'battery', unit: '%', min: 20, max: 100 },
    { sensorType: 'vibration', unit: 'mm/s', min: 0, max: 10 },
    { sensorType: 'humidity', unit: '%', min: 30, max: 80 },
  ];

  const readings = [];
  for (const t of types) {
    const value = Math.round((Math.random() * (t.max - t.min) + t.min) * 100) / 100;
    const isAlert = (t.sensorType === 'temperature' && value > 32) ||
      (t.sensorType === 'battery' && value < 25) ||
      (t.sensorType === 'vibration' && value > 7);
    readings.push(await prisma.sensorReading.create({
      data: { assetId, sensorType: t.sensorType, value, unit: t.unit, isAlert },
    }));
  }
  return readings;
};

export const getSensorDashboard = async (assetId) => {
  const readings = await prisma.sensorReading.findMany({
    where: { assetId },
    orderBy: { recordedAt: 'desc' },
    take: 40,
  });

  const latest = {};
  readings.forEach((r) => {
    if (!latest[r.sensorType]) latest[r.sensorType] = r;
  });

  return { latest: Object.values(latest), history: readings, alerts: readings.filter((r) => r.isAlert).slice(0, 5) };
};

export const useSparePart = async (maintenanceRequestId, sparePartId, quantity) => {
  const part = await prisma.sparePart.findUnique({ where: { id: sparePartId } });
  if (!part || part.stockQty < quantity) throw new Error('Insufficient stock');

  await prisma.$transaction([
    prisma.sparePart.update({ where: { id: sparePartId }, data: { stockQty: { decrement: quantity } } }),
    prisma.sparePartUsage.create({ data: { sparePartId, maintenanceRequestId, quantity } }),
  ]);
};
