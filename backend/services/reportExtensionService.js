import prisma from '../config/database.js';
import { buildPagination, parsePagination } from '../utils/apiResponse.js';
import { createNotification, getManagersAndAdmins, notifyUsers } from './notificationService.js';
import { logActivity } from '../utils/activityLogger.js';

const MS_PER_DAY = 86400000;
const DEFAULT_MAINTENANCE_INTERVAL = 90;
const DEFAULT_LIFESPAN_YEARS = 5;

const TIME_SLOTS = Array.from({ length: 11 }, (_, i) => {
  const hour = 8 + i;
  return {
    hour,
    label: `${String(hour).padStart(2, '0')}:00–${String(hour + 1).padStart(2, '0')}:00`,
  };
});

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const addYears = (date, years) => {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
};

const daysBetween = (from, to) => Math.ceil((new Date(to) - new Date(from)) / MS_PER_DAY);

const getLastResolvedMaintenance = (requests = []) =>
  requests
    .filter((r) => r.resolvedAt)
    .sort((a, b) => new Date(b.resolvedAt) - new Date(a.resolvedAt))[0];

const enrichAssetRow = (asset) => {
  const lastMaint = getLastResolvedMaintenance(asset.maintenanceRequests);
  const lastMaintenanceDate = lastMaint?.resolvedAt || null;
  const interval = asset.maintenanceInterval || DEFAULT_MAINTENANCE_INTERVAL;

  let nextMaintenanceDate = asset.nextMaintenanceDate;
  if (!nextMaintenanceDate) {
    const base = lastMaintenanceDate || asset.acquisitionDate || asset.createdAt;
    nextMaintenanceDate = addDays(base, interval);
  }

  let retirementDate = asset.retirementDate;
  if (!retirementDate && asset.acquisitionDate) {
    retirementDate = addYears(asset.acquisitionDate, DEFAULT_LIFESPAN_YEARS);
  }

  const now = new Date();
  const daysUntilMaintenance = nextMaintenanceDate ? daysBetween(now, nextMaintenanceDate) : null;
  const daysUntilRetirement = retirementDate ? daysBetween(now, retirementDate) : null;

  const activeAllocation = asset.allocations?.find((a) => ['ACTIVE', 'OVERDUE'].includes(a.status));

  let priority = 'LOW';
  let highlight = 'green';
  let daysRemaining = daysUntilMaintenance;

  if (['RETIRED', 'DISPOSED'].includes(asset.status)) {
    priority = 'RETIRED';
    highlight = 'gray';
    daysRemaining = null;
  } else if (daysUntilMaintenance !== null && daysUntilMaintenance < 0) {
    priority = 'CRITICAL';
    highlight = 'red';
    daysRemaining = daysUntilMaintenance;
  } else if (daysUntilMaintenance !== null && daysUntilMaintenance <= 30) {
    priority = 'HIGH';
    highlight = 'orange';
  } else if (daysUntilRetirement !== null && daysUntilRetirement <= 90) {
    priority = 'MEDIUM';
    highlight = 'yellow';
    daysRemaining = daysUntilRetirement;
  }

  return {
    id: asset.id,
    assetTag: asset.assetTag,
    assetName: asset.name,
    category: asset.category?.name || '—',
    department: activeAllocation?.department?.name || activeAllocation?.employee?.department?.name || '—',
    assignedEmployee: activeAllocation?.employee
      ? `${activeAllocation.employee.firstName} ${activeAllocation.employee.lastName}`
      : '—',
    status: asset.status,
    healthScore: asset.healthScore,
    lastMaintenanceDate,
    nextMaintenanceDate,
    retirementDate,
    daysUntilMaintenance,
    daysUntilRetirement,
    daysRemaining,
    priority,
    highlight,
    location: asset.location || '—',
    maintenanceOverdue: daysUntilMaintenance !== null && daysUntilMaintenance < 0,
    nearRetirement: daysUntilRetirement !== null && daysUntilRetirement <= 90 && daysUntilRetirement > 0,
    dueForMaintenance: daysUntilMaintenance !== null && daysUntilMaintenance >= 0 && daysUntilMaintenance <= 30,
  };
};

const buildAssetWhere = (query, user) => {
  const where = { deletedAt: null };
  const and = [];

  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.status) where.status = query.status;
  if (query.location) where.location = { contains: query.location, mode: 'insensitive' };

  if (query.departmentId) {
    and.push({
      allocations: {
        some: {
          departmentId: query.departmentId,
          status: { in: ['ACTIVE', 'OVERDUE'] },
        },
      },
    });
  }

  if (query.search) {
    and.push({
      OR: [
        { assetTag: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
        { serialNumber: { contains: query.search, mode: 'insensitive' } },
      ],
    });
  }

  if (query.dateFrom || query.dateTo) {
    const dateFilter = {};
    if (query.dateFrom) dateFilter.gte = new Date(query.dateFrom);
    if (query.dateTo) dateFilter.lte = new Date(query.dateTo);
    and.push({
      OR: [
        { nextMaintenanceDate: dateFilter },
        { retirementDate: dateFilter },
      ],
    });
  }

  if (and.length) where.AND = and;
  return where;
};

export const getMaintenanceRetirementSummary = async (user) => {
  const assets = await prisma.asset.findMany({
    where: buildAssetWhere({}, user),
    include: {
      category: true,
      maintenanceRequests: { select: { resolvedAt: true, status: true } },
      allocations: {
        where: { status: { in: ['ACTIVE', 'OVERDUE'] } },
        include: {
          department: true,
          employee: { include: { department: true } },
        },
      },
    },
  });

  const rows = assets.map(enrichAssetRow);
  return {
    dueForMaintenance: rows.filter((r) => r.dueForMaintenance).length,
    maintenanceOverdue: rows.filter((r) => r.maintenanceOverdue).length,
    nearRetirement: rows.filter((r) => r.nearRetirement).length,
    retiredAssets: rows.filter((r) => ['RETIRED', 'DISPOSED'].includes(r.status)).length,
    healthyAssets: rows.filter((r) => r.highlight === 'green').length,
    averageHealthScore: rows.length
      ? Math.round(rows.reduce((s, r) => s + r.healthScore, 0) / rows.length)
      : 0,
  };
};

export const getMaintenanceRetirementReport = async (query = {}, user) => {
  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query);
  const where = buildAssetWhere(query, user);

  const assets = await prisma.asset.findMany({
    where,
    include: {
      category: true,
      maintenanceRequests: { select: { resolvedAt: true, status: true, priority: true } },
      allocations: {
        where: { status: { in: ['ACTIVE', 'OVERDUE'] } },
        include: {
          department: true,
          employee: { include: { department: true } },
        },
      },
    },
  });

  let rows = assets.map(enrichAssetRow);

  if (query.priority) {
    rows = rows.filter((r) => r.priority === query.priority);
  }

  const sortKey = sortBy || 'daysRemaining';
  const dir = sortOrder === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    const av = a[sortKey] ?? (sortKey === 'assetTag' ? a.assetTag : 9999);
    const bv = b[sortKey] ?? (sortKey === 'assetTag' ? b.assetTag : 9999);
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });

  const total = rows.length;
  const paginated = rows.slice(skip, skip + limit);
  const summary = {
    dueForMaintenance: rows.filter((r) => r.dueForMaintenance).length,
    maintenanceOverdue: rows.filter((r) => r.maintenanceOverdue).length,
    nearRetirement: rows.filter((r) => r.nearRetirement).length,
    retiredAssets: rows.filter((r) => ['RETIRED', 'DISPOSED'].includes(r.status)).length,
    healthyAssets: rows.filter((r) => r.highlight === 'green').length,
    averageHealthScore: rows.length
      ? Math.round(rows.reduce((s, r) => s + r.healthScore, 0) / rows.length)
      : 0,
  };

  return {
    summary,
    items: paginated,
    pagination: buildPagination(total, page, limit),
    filters: {
      departments: await prisma.department.findMany({
        where: { deletedAt: null, status: 'ACTIVE' },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      categories: await prisma.assetCategory.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    },
  };
};

const getHeatmapDateRange = (query) => {
  const dateTo = query.dateTo ? new Date(query.dateTo) : new Date();
  const dateFrom = query.dateFrom
    ? new Date(query.dateFrom)
    : new Date(dateTo.getTime() - 30 * MS_PER_DAY);
  return { dateFrom, dateTo };
};

const bookingOverlapsSlot = (booking, slotHour) => {
  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);
  const slotStart = new Date(start);
  slotStart.setHours(slotHour, 0, 0, 0);
  const slotEnd = new Date(slotStart);
  slotEnd.setHours(slotHour + 1, 0, 0, 0);
  return start < slotEnd && end > slotStart;
};

export const getResourceBookingHeatmap = async (query = {}, user) => {
  const { dateFrom, dateTo } = getHeatmapDateRange(query);

  const assetWhere = { deletedAt: null, isBookable: true };
  if (query.categoryId) assetWhere.categoryId = query.categoryId;
  if (query.location) assetWhere.location = { contains: query.location, mode: 'insensitive' };
  if (query.building) assetWhere.location = { contains: query.building, mode: 'insensitive' };
  if (query.floor) assetWhere.location = { contains: query.floor, mode: 'insensitive' };

  const bookableAssets = await prisma.asset.findMany({
    where: assetWhere,
    include: { category: true },
    orderBy: { name: 'asc' },
  });

  const assetIds = bookableAssets.map((a) => a.id);
  const bookings = assetIds.length
    ? await prisma.booking.findMany({
        where: {
          assetId: { in: assetIds },
          status: { in: ['COMPLETED', 'ONGOING', 'UPCOMING'] },
          startTime: { gte: dateFrom, lte: dateTo },
        },
        include: { asset: { include: { category: true } } },
      })
    : [];

  const resources = bookableAssets.map((asset) => ({
    id: asset.id,
    name: asset.name,
    category: asset.category.name,
    location: asset.location,
    type: asset.category.name,
  }));

  const matrix = resources.map((resource) => {
    const resourceBookings = bookings.filter((b) => b.assetId === resource.id);
    const cells = TIME_SLOTS.map((slot) => {
      const slotBookings = resourceBookings.filter((b) => bookingOverlapsSlot(b, slot.hour));
      const dayCounts = {};
      slotBookings.forEach((b) => {
        const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(b.startTime).getDay()];
        dayCounts[day] = (dayCounts[day] || 0) + 1;
      });
      const peakDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
      return {
        hour: slot.hour,
        label: slot.label,
        count: slotBookings.length,
        peakDay,
      };
    });

    const totalBookings = resourceBookings.length;
    const maxSlot = Math.max(...cells.map((c) => c.count), 1);
    const daysInRange = Math.max(1, daysBetween(dateFrom, dateTo));
    const utilizationPct = Math.round((totalBookings / (TIME_SLOTS.length * daysInRange)) * 100);

    return {
      ...resource,
      totalBookings,
      utilizationPct,
      cells: cells.map((c) => ({
        ...c,
        utilizationPct: Math.round((c.count / maxSlot) * 100),
        intensity: c.count === 0 ? 'low' : c.count / maxSlot >= 0.75 ? 'peak' : c.count / maxSlot >= 0.5 ? 'high' : c.count / maxSlot >= 0.25 ? 'medium' : 'low',
      })),
      peakSlot: cells.sort((a, b) => b.count - a.count)[0],
    };
  });

  const maxCount = Math.max(...matrix.flatMap((r) => r.cells.map((c) => c.count)), 1);
  matrix.forEach((row) => {
    row.cells.forEach((c) => {
      const ratio = c.count / maxCount;
      c.intensity = ratio === 0 ? 'low' : ratio >= 0.75 ? 'peak' : ratio >= 0.5 ? 'high' : ratio >= 0.25 ? 'medium' : 'low';
      c.utilizationPct = Math.round(ratio * 100);
    });
  });

  const sortedByBookings = [...matrix].sort((a, b) => b.totalBookings - a.totalBookings);
  const hourTotals = TIME_SLOTS.map((slot) => ({
    hour: slot.hour,
    label: slot.label,
    count: matrix.reduce((sum, r) => sum + (r.cells.find((c) => c.hour === slot.hour)?.count || 0), 0),
  }));
  const peakHour = hourTotals.sort((a, b) => b.count - a.count)[0];

  const totalBookings = bookings.length;
  const avgDailyBookings = Math.round((totalBookings / Math.max(1, daysBetween(dateFrom, dateTo))) * 10) / 10;
  const resourceUtilizationPct = matrix.length
    ? Math.round(matrix.reduce((s, r) => s + r.utilizationPct, 0) / matrix.length)
    : 0;

  return {
    timeSlots: TIME_SLOTS,
    resources: matrix,
    summary: {
      mostBookedResource: sortedByBookings[0] || null,
      leastUsedResource: sortedByBookings[sortedByBookings.length - 1] || null,
      peakBookingHour: peakHour,
      averageDailyBookings: avgDailyBookings,
      resourceUtilizationPct,
      totalBookings,
    },
    filters: {
      departments: await prisma.department.findMany({
        where: { deletedAt: null, status: 'ACTIVE' },
        select: { id: true, name: true },
      }),
      categories: await prisma.assetCategory.findMany({
        where: { deletedAt: null, assets: { some: { isBookable: true, deletedAt: null } } },
        select: { id: true, name: true },
      }),
    },
    dateRange: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
  };
};

export const getMaintenanceRetirementExportRows = async (query, user) => {
  const report = await getMaintenanceRetirementReport({ ...query, page: '1', limit: '10000' }, user);
  return report.items;
};

export const getHeatmapExportRows = async (query, user) => {
  const data = await getResourceBookingHeatmap(query, user);
  const rows = [];
  data.resources.forEach((resource) => {
    resource.cells.forEach((cell) => {
      rows.push({
        resource: resource.name,
        category: resource.category,
        location: resource.location,
        timeSlot: cell.label,
        bookings: cell.count,
        utilizationPct: cell.utilizationPct,
        peakDay: cell.peakDay,
      });
    });
  });
  return rows;
};

export const processMaintenanceRetirementAlerts = async () => {
  const since = new Date(Date.now() - 24 * 3600000);
  const recentTitles = new Set(
    (await prisma.notification.findMany({
      where: { createdAt: { gte: since }, title: { in: ['Maintenance Overdue', 'Upcoming Maintenance', 'Asset Near Retirement'] } },
      select: { message: true },
    })).map((n) => n.message)
  );

  const assets = await prisma.asset.findMany({
    where: { deletedAt: null, status: { notIn: ['RETIRED', 'DISPOSED'] } },
    include: {
      maintenanceRequests: { select: { resolvedAt: true } },
      allocations: { where: { status: { in: ['ACTIVE', 'OVERDUE'] } } },
      category: true,
    },
  });

  const managerIds = await getManagersAndAdmins();
  const rows = assets.map(enrichAssetRow);
  let alertsSent = 0;

  for (const row of rows) {
    if (row.maintenanceOverdue) {
      const msg = `Asset ${row.assetTag} (${row.assetName}) is overdue for maintenance`;
      if (!recentTitles.has(msg)) {
        await notifyUsers(managerIds, 'MAINTENANCE_SLA_BREACH', 'Maintenance Overdue', msg, '/reports');
        alertsSent++;
      }
    } else if (row.dueForMaintenance) {
      const msg = `Asset ${row.assetTag} due for maintenance in ${row.daysUntilMaintenance} day(s)`;
      if (!recentTitles.has(msg)) {
        await notifyUsers(managerIds, 'GENERAL', 'Upcoming Maintenance', msg, '/reports');
        alertsSent++;
      }
    } else if (row.nearRetirement) {
      const msg = `Asset ${row.assetTag} approaches retirement in ${row.daysUntilRetirement} day(s)`;
      if (!recentTitles.has(msg)) {
        await notifyUsers(managerIds, 'WARRANTY_EXPIRING', 'Asset Near Retirement', msg, '/reports');
        alertsSent++;
      }
    }
  }

  return alertsSent;
};

export const logMaintenanceStatusChange = async (userId, assetId, details, ip) => {
  await logActivity(userId, 'UPDATE', 'Asset', assetId, details, ip);
};
