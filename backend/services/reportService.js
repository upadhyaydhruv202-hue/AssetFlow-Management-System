import prisma from '../config/database.js';

export const getUtilizationReport = async () => {
  const assets = await prisma.asset.findMany({
    where: { deletedAt: null },
    include: {
      _count: { select: { allocations: true, bookings: true } },
      category: { select: { name: true } },
    },
  });

  return assets
    .map((a) => ({
      id: a.id,
      assetTag: a.assetTag,
      name: a.name,
      category: a.category.name,
      status: a.status,
      allocationCount: a._count.allocations,
      bookingCount: a._count.bookings,
      utilizationScore: a._count.allocations + a._count.bookings,
    }))
    .sort((a, b) => b.utilizationScore - a.utilizationScore);
};

export const getMaintenanceFrequency = async () => {
  const data = await prisma.maintenanceRequest.groupBy({
    by: ['assetId'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 20,
  });

  const assetIds = data.map((d) => d.assetId);
  const assets = await prisma.asset.findMany({
    where: { id: { in: assetIds } },
    include: { category: { select: { name: true } } },
  });

  const assetMap = Object.fromEntries(assets.map((a) => [a.id, a]));

  return data.map((d) => ({
    asset: assetMap[d.assetId],
    count: d._count.id,
  }));
};

export const getDepartmentAllocationSummary = async () => {
  const departments = await prisma.department.findMany({
    where: { deletedAt: null, status: 'ACTIVE' },
    include: {
      _count: {
        select: {
          allocations: { where: { status: { in: ['ACTIVE', 'OVERDUE'] } } },
          employees: true,
        },
      },
    },
  });

  return departments.map((d) => ({
    id: d.id,
    name: d.name,
    code: d.code,
    activeAllocations: d._count.allocations,
    employeeCount: d._count.employees,
  }));
};

export const getBookingHeatmap = async () => {
  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ['COMPLETED', 'ONGOING', 'UPCOMING'] },
      startTime: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    select: { startTime: true, endTime: true },
  });

  const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));

  bookings.forEach((b) => {
    const start = new Date(b.startTime);
    const day = start.getDay();
    const hour = start.getHours();
    heatmap[day][hour]++;
  });

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days.map((day, i) => ({
    day,
    hours: heatmap[i].map((count, hour) => ({ hour, count })),
  }));
};

export const getAssetsDueForMaintenance = async () => {
  return prisma.asset.findMany({
    where: {
      deletedAt: null,
      OR: [
        { status: 'UNDER_MAINTENANCE' },
        {
          maintenanceRequests: {
            some: { status: { in: ['PENDING', 'APPROVED', 'IN_PROGRESS'] } },
          },
        },
      ],
    },
    include: {
      category: true,
      maintenanceRequests: {
        where: { status: { not: 'RESOLVED' } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    take: 20,
  });
};

export const getCategoryMaintenanceStats = async () => {
  const requests = await prisma.maintenanceRequest.findMany({
    include: { asset: { include: { category: true } } },
  });

  const stats = {};
  requests.forEach((r) => {
    const cat = r.asset.category.name;
    stats[cat] = (stats[cat] || 0) + 1;
  });

  return Object.entries(stats).map(([category, count]) => ({ category, count }));
};
