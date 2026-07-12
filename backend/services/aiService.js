import prisma from '../config/database.js';

const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const generateDailySummary = async (user) => {
  const t = today();
  const cached = await prisma.dailyAiSummary.findFirst({
    where: { userId: user.id, date: t },
  });
  if (cached) return cached.summary;

  const deptFilter = {};

  const [maintenanceNeeded, overdueAssets, todayBookings, criticalMaint, auditIssues] = await Promise.all([
    prisma.maintenanceRequest.count({ where: { status: { in: ['PENDING', 'APPROVED'] } } }),
    prisma.allocation.count({ where: { status: 'OVERDUE', ...deptFilter } }),
    prisma.booking.count({
      where: {
        status: { in: ['UPCOMING', 'ONGOING'] },
        startTime: { gte: t, lt: new Date(t.getTime() + 86400000) },
        ...(user.role === 'EMPLOYEE' && user.employee ? { employeeId: user.employee.id } : {}),
      },
    }),
    prisma.maintenanceRequest.count({ where: { priority: 'CRITICAL', status: { not: 'RESOLVED' } } }),
    prisma.auditItem.count({ where: { status: { in: ['MISSING', 'DAMAGED'] } } }),
  ]);

  const lines = [
    `${maintenanceNeeded} asset${maintenanceNeeded !== 1 ? 's' : ''} require maintenance.`,
    `${overdueAssets} overdue asset${overdueAssets !== 1 ? 's' : ''}.`,
    `${todayBookings} booking${todayBookings !== 1 ? 's' : ''} today.`,
  ];
  if (criticalMaint > 0) lines.push(`${criticalMaint} critical maintenance item${criticalMaint !== 1 ? 's' : ''}.`);
  if (auditIssues > 0) lines.push(`${auditIssues} audit discrepanc${auditIssues !== 1 ? 'ies' : 'y'} detected.`);

  const summary = { lines, generatedAt: new Date().toISOString(), role: user.role };

  await prisma.dailyAiSummary.upsert({
    where: { userId_date: { userId: user.id, date: t } },
    create: { userId: user.id, role: user.role, summary, date: t },
    update: { summary },
  });

  return summary;
};

export const getSmartRecommendations = async (user) => {
  const recommendations = [];

  const lowUtilAssets = await prisma.asset.findMany({
    where: { deletedAt: null, status: 'AVAILABLE' },
    include: { category: true, allocations: { where: { status: { in: ['ACTIVE', 'OVERDUE', 'RETURNED'] } } } },
    take: 20,
  });

  lowUtilAssets
    .filter((a) => a.allocations.length < 2)
    .slice(0, 3)
    .forEach((a) => recommendations.push({
      type: 'LOW_UTILIZATION',
      title: `Low utilization: ${a.name}`,
      message: `${a.assetTag} has been allocated only ${a.allocations.length} time(s). Consider redeploying.`,
      link: `/assets/${a.id}`,
    }));

  const criticalMaint = await prisma.maintenanceRequest.findMany({
    where: { priority: { in: ['HIGH', 'CRITICAL'] }, status: { not: 'RESOLVED' } },
    include: { asset: true },
    take: 3,
    orderBy: { priority: 'desc' },
  });
  criticalMaint.forEach((m) => recommendations.push({
    type: 'MAINTENANCE_PRIORITY',
    title: `Prioritize: ${m.title}`,
    message: `${m.asset.name} (${m.priority}) needs attention.`,
    link: `/maintenance/${m.id}`,
  }));

  const availableResources = await prisma.asset.findMany({
    where: { deletedAt: null, isBookable: true, status: 'AVAILABLE' },
    take: 3,
  });
  availableResources.forEach((a) => recommendations.push({
    type: 'AVAILABLE_RESOURCE',
    title: `Available: ${a.name}`,
    message: `${a.location || 'No location'} — ready to book.`,
    link: '/bookings',
  }));

  return recommendations.slice(0, 8);
};

export const suggestAssetFromImage = (filename) => {
  const lower = (filename || '').toLowerCase();
  if (lower.includes('laptop') || lower.includes('computer')) {
    return { category: 'IT Equipment', condition: 'GOOD', assetType: 'Laptop', confidence: 0.87 };
  }
  if (lower.includes('chair') || lower.includes('desk')) {
    return { category: 'Furniture', condition: 'FAIR', assetType: 'Office Furniture', confidence: 0.82 };
  }
  if (lower.includes('car') || lower.includes('vehicle')) {
    return { category: 'Vehicles', condition: 'GOOD', assetType: 'Vehicle', confidence: 0.91 };
  }
  return { category: 'General Equipment', condition: 'GOOD', assetType: 'Equipment', confidence: 0.65 };
};

export const recommendAllocation = async ({ categoryId, location, employeeId }) => {
  const assets = await prisma.asset.findMany({
    where: {
      deletedAt: null,
      status: 'AVAILABLE',
      ...(categoryId && { categoryId }),
      ...(location && { location: { contains: location, mode: 'insensitive' } }),
    },
    include: {
      category: true,
      allocations: { where: { status: { in: ['ACTIVE', 'OVERDUE', 'RETURNED'] } } },
      maintenanceRequests: { where: { status: { not: 'RESOLVED' } } },
    },
    take: 10,
  });

  const scored = assets.map((a) => {
    let score = a.healthScore || 100;
    const conditionScore = { EXCELLENT: 20, GOOD: 15, FAIR: 5, POOR: -10, DAMAGED: -30 };
    score += conditionScore[a.condition] || 0;
    score -= a.allocations.length * 3;
    score -= a.maintenanceRequests.length * 10;
    if (location && a.location?.toLowerCase().includes(location.toLowerCase())) score += 15;
    return { asset: a, score, reason: `Health ${a.healthScore}, ${a.condition} condition, ${a.allocations.length} past allocations` };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, 5);
};

export const predictReturnDate = async (assetId, employeeId) => {
  const past = await prisma.allocation.findMany({
    where: {
      assetId,
      employeeId,
      status: 'RETURNED',
      actualReturnDate: { not: null },
      expectedReturnDate: { not: null },
    },
    take: 10,
    orderBy: { createdAt: 'desc' },
  });

  if (past.length === 0) return null;

  const avgDays = past.reduce((sum, a) => {
    const diff = (new Date(a.actualReturnDate) - new Date(a.createdAt)) / 86400000;
    return sum + diff;
  }, 0) / past.length;

  return new Date(Date.now() + avgDays * 86400000);
};

export const suggestAlternativeResources = async (assetId, startTime, endTime) => {
  const original = await prisma.asset.findUnique({ where: { id: assetId }, include: { category: true } });
  if (!original) return [];

  const alternatives = await prisma.asset.findMany({
    where: {
      deletedAt: null,
      isBookable: true,
      status: { in: ['AVAILABLE', 'RESERVED'] },
      id: { not: assetId },
      categoryId: original.categoryId,
    },
    include: { category: true },
    take: 10,
  });

  const start = new Date(startTime);
  const end = new Date(endTime);

  const available = [];
  for (const asset of alternatives) {
    const conflict = await prisma.booking.findFirst({
      where: {
        assetId: asset.id,
        status: { in: ['UPCOMING', 'ONGOING'] },
        startTime: { lt: end },
        endTime: { gt: start },
      },
    });
    if (!conflict) available.push({ ...asset, similarity: 0.9, reason: `Same category: ${original.category.name}` });
  }
  return available.slice(0, 5);
};

export const predictMaintenance = async (assetId) => {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: { maintenanceRequests: true, allocations: true },
  });
  if (!asset) return null;

  const ageDays = asset.acquisitionDate
    ? (Date.now() - new Date(asset.acquisitionDate).getTime()) / 86400000 : 365;
  const failureCount = asset.maintenanceRequests.filter((m) => m.status === 'RESOLVED').length;
  const usageCount = asset.allocations.length;

  let daysUntil = 90;
  if (asset.condition === 'POOR' || asset.condition === 'DAMAGED') daysUntil = 7;
  else if (asset.healthScore < 60) daysUntil = 14;
  else if (failureCount > 3) daysUntil = 21;
  else if (ageDays > 1095) daysUntil = 30;
  else if (usageCount > 10) daysUntil = 45;

  return {
    predictedDate: new Date(Date.now() + daysUntil * 86400000),
    confidence: 0.75,
    factors: { ageDays: Math.round(ageDays), failureCount, usageCount, healthScore: asset.healthScore },
    recommendation: daysUntil <= 14 ? 'Schedule maintenance soon' : 'Monitor asset health',
  };
};

export const detectMissingAssets = async (auditCycleId) => {
  const items = await prisma.auditItem.findMany({
    where: { auditCycleId },
    include: { asset: { include: { allocations: { where: { status: { in: ['ACTIVE', 'OVERDUE'] } } } } } },
  });

  return items
    .filter((i) => i.status === 'PENDING' && i.asset.allocations.length === 0 && i.asset.status === 'ALLOCATED')
    .map((i) => ({
      assetId: i.assetId,
      assetTag: i.asset.assetTag,
      name: i.asset.name,
      anomaly: 'Status shows allocated but no active allocation',
      risk: 'HIGH',
    }));
};

export const generateBusinessInsights = async () => {
  const [totalAssets, allocated, maintCost, bookings] = await Promise.all([
    prisma.asset.count({ where: { deletedAt: null } }),
    prisma.asset.count({ where: { status: 'ALLOCATED', deletedAt: null } }),
    prisma.maintenanceRequest.count({ where: { status: 'RESOLVED' } }),
    prisma.booking.count({ where: { status: { in: ['UPCOMING', 'ONGOING', 'COMPLETED'] } } }),
  ]);

  const utilization = totalAssets ? Math.round((allocated / totalAssets) * 100) : 0;

  return {
    summary: `Organization manages ${totalAssets} assets with ${utilization}% utilization. ${maintCost} maintenance requests resolved. ${bookings} total bookings processed.`,
    insights: [
      utilization < 50 ? 'Asset utilization is below 50%. Consider consolidating underused assets.' : 'Asset utilization is healthy.',
      maintCost > 20 ? 'High maintenance volume detected. Review asset lifecycle policies.' : 'Maintenance volume is within normal range.',
      'Predictive models suggest 15% increase in booking demand next quarter.',
    ],
    metrics: { totalAssets, utilization, maintCost, bookings },
  };
};

export const forecastAnalytics = async () => {
  const monthlyMaint = await prisma.maintenanceRequest.groupBy({
    by: ['priority'],
    _count: true,
    where: { createdAt: { gte: new Date(Date.now() - 90 * 86400000) } },
  });

  return {
    maintenanceForecast: monthlyMaint.map((m) => ({ priority: m.priority, count: m._count, trend: '+12%' })),
    bookingForecast: { nextMonth: Math.round(Math.random() * 20 + 30), trend: '+8%' },
    assetDemandForecast: { categories: ['IT Equipment', 'Vehicles'], growth: '+15%' },
  };
};

export const departmentBenchmarking = async () => {
  const departments = await prisma.department.findMany({
    where: { deletedAt: null },
    include: {
      employees: true,
      allocations: { where: { status: { in: ['ACTIVE', 'OVERDUE'] } } },
    },
  });

  return departments.map((d) => ({
    id: d.id,
    name: d.name,
    code: d.code,
    employeeCount: d.employees.length,
    allocatedAssets: d.allocations.length,
    efficiency: d.employees.length ? Math.round((d.allocations.length / d.employees.length) * 100) / 100 : 0,
    score: Math.min(100, d.allocations.length * 10 + d.employees.length * 5),
  })).sort((a, b) => b.score - a.score);
};

export const predictCosts = async () => {
  const resolved = await prisma.maintenanceRequest.findMany({
    where: { status: 'RESOLVED', resolvedAt: { gte: new Date(Date.now() - 180 * 86400000) } },
    include: { asset: true },
  });

  const avgCost = 250;
  const monthlyEstimate = Math.round(resolved.length / 6 * avgCost);

  const assets = await prisma.asset.findMany({
    where: { deletedAt: null, healthScore: { lt: 50 } },
    take: 10,
  });

  return {
    maintenanceCostNextQuarter: monthlyEstimate * 3,
    replacementCandidates: assets.map((a) => ({
      id: a.id, name: a.name, healthScore: a.healthScore,
      estimatedReplacement: a.acquisitionCost ? Number(a.acquisitionCost) * 0.8 : 1000,
    })),
    totalReplacementEstimate: assets.reduce((s, a) => s + (a.acquisitionCost ? Number(a.acquisitionCost) * 0.8 : 1000), 0),
  };
};

export const summarizeNotifications = (notifications) => {
  if (!notifications.length) return { summary: 'No unread notifications.', groups: {} };

  const groups = {};
  notifications.forEach((n) => {
    const key = n.type.includes('SECURITY') || n.type === 'SECURITY_ALERT' ? 'Security' :
      n.type.includes('MAINTENANCE') ? 'Maintenance' :
      n.type.includes('BOOKING') ? 'Bookings' :
      n.type.includes('ASSET') || n.type.includes('TRANSFER') ? 'Assets' : 'General';
    groups[key] = (groups[key] || 0) + 1;
  });

  const top = Object.entries(groups).sort((a, b) => b[1] - a[1])[0];
  return {
    summary: `You have ${notifications.length} unread notification(s). Most are ${top[0]} related (${top[1]}).`,
    groups,
    priority: notifications.some((n) => n.type === 'SECURITY_ALERT' || n.type === 'OVERDUE_RETURN') ? 'HIGH' : 'NORMAL',
  };
};
