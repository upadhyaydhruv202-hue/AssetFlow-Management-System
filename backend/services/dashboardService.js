import prisma from '../config/database.js';
import { generateDailySummary, getSmartRecommendations } from './aiService.js';
import { getAssetHealthOverview } from './assetHealthService.js';
import { getMaintenanceRetirementSummary, getResourceBookingHeatmap } from './reportExtensionService.js';

const getRoleKpis = (role, baseKpis) => {
  if (role === 'ADMIN') {
    return { ...baseKpis, roleLabel: 'Executive', focus: 'Organization-wide oversight' };
  }
  return { ...baseKpis, roleLabel: 'Employee', focus: 'Personal assets & bookings' };
};

const getEmployeeDashboard = async (employeeId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    myAllocatedAssets,
    myActiveBookings,
    myPendingMaintenance,
    myPendingTransfers,
    myUpcomingReturns,
    overdueReturns,
  ] = await Promise.all([
    prisma.allocation.count({
      where: { employeeId, status: { in: ['ACTIVE', 'OVERDUE'] } },
    }),
    prisma.booking.count({
      where: { employeeId, status: { in: ['UPCOMING', 'ONGOING'] } },
    }),
    prisma.maintenanceRequest.count({
      where: { requestedById: employeeId, status: { in: ['PENDING', 'APPROVED', 'TECHNICIAN_ASSIGNED', 'IN_PROGRESS'] } },
    }),
    prisma.transfer.count({
      where: {
        status: 'REQUESTED',
        OR: [{ requestedById: employeeId }, { fromEmployeeId: employeeId }, { toEmployeeId: employeeId }],
      },
    }),
    prisma.allocation.count({
      where: {
        employeeId,
        status: 'ACTIVE',
        expectedReturnDate: { gte: today },
        isOverdue: false,
      },
    }),
    prisma.allocation.findMany({
      where: {
        employeeId,
        status: { in: ['ACTIVE', 'OVERDUE'] },
        expectedReturnDate: { lt: today },
      },
      include: {
        asset: { select: { id: true, assetTag: true, name: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
      take: 10,
      orderBy: { expectedReturnDate: 'asc' },
    }),
  ]);

  return {
    kpis: {
      assetsAvailable: 0,
      assetsAllocated: myAllocatedAssets,
      maintenanceToday: myPendingMaintenance,
      activeBookings: myActiveBookings,
      pendingTransfers: myPendingTransfers,
      upcomingReturns: myUpcomingReturns,
      overdueCount: overdueReturns.length,
    },
    overdueReturns,
    isEmployeeView: true,
  };
};

export const getDashboardStats = async (user) => {
  let data;
  if (user.role === 'EMPLOYEE' && user.employee) {
    data = await getEmployeeDashboard(user.employee.id);
  } else {
    data = await getManagerDashboard(user);
  }

  const [aiSummary, recommendations, assetHealth, criticalAlerts, maintenanceSummary, peakUsage] = await Promise.all([
    generateDailySummary(user),
    getSmartRecommendations(user),
    getAssetHealthOverview(8),
    getCriticalAlerts(user),
    user.role !== 'EMPLOYEE' ? getMaintenanceRetirementSummary(user) : null,
    user.role !== 'EMPLOYEE' ? getResourceBookingHeatmap({}, user) : null,
  ]);

  return {
    ...data,
    kpis: getRoleKpis(user.role, data.kpis),
    aiSummary,
    recommendations,
    assetHealth,
    criticalAlerts,
    maintenanceSummary,
    peakUsage: peakUsage ? {
      mostBookedResource: peakUsage.summary.mostBookedResource,
      leastUsedResource: peakUsage.summary.leastUsedResource,
      peakBookingHour: peakUsage.summary.peakBookingHour,
      resourceUtilizationPct: peakUsage.summary.resourceUtilizationPct,
    } : null,
    executiveMode: user.role,
    refreshedAt: new Date().toISOString(),
  };
};

const getManagerDashboard = async (user) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const deptFilter = {};

  const [
    assetsAvailable,
    assetsAllocated,
    maintenanceToday,
    activeBookings,
    pendingTransfers,
    upcomingReturns,
    overdueReturns,
  ] = await Promise.all([
    prisma.asset.count({ where: { status: 'AVAILABLE', deletedAt: null } }),
    prisma.asset.count({ where: { status: 'ALLOCATED', deletedAt: null } }),
    prisma.maintenanceRequest.count({
      where: {
        status: { in: ['APPROVED', 'IN_PROGRESS', 'TECHNICIAN_ASSIGNED'] },
        createdAt: { gte: today, lt: tomorrow },
      },
    }),
    prisma.booking.count({ where: { status: { in: ['UPCOMING', 'ONGOING'] } } }),
    prisma.transfer.count({ where: { status: 'REQUESTED' } }),
    prisma.allocation.count({
      where: {
        status: 'ACTIVE',
        expectedReturnDate: { gte: today },
        isOverdue: false,
        ...deptFilter,
      },
    }),
    prisma.allocation.findMany({
      where: {
        status: { in: ['ACTIVE', 'OVERDUE'] },
        expectedReturnDate: { lt: today },
        ...deptFilter,
      },
      include: {
        asset: { select: { id: true, assetTag: true, name: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
      take: 10,
      orderBy: { expectedReturnDate: 'asc' },
    }),
  ]);

  return {
    kpis: {
      assetsAvailable,
      assetsAllocated,
      maintenanceToday,
      activeBookings,
      pendingTransfers,
      upcomingReturns,
      overdueCount: overdueReturns.length,
    },
    overdueReturns,
  };
};

const getCriticalAlerts = async (user) => {
  const alerts = [];
  const overdue = await prisma.allocation.count({ where: { status: 'OVERDUE' } });
  if (overdue > 0) alerts.push({ type: 'OVERDUE_ASSETS', count: overdue, severity: 'high', message: `${overdue} overdue asset(s)` });

  const criticalMaint = await prisma.maintenanceRequest.count({
    where: { priority: 'CRITICAL', status: { notIn: ['RESOLVED', 'REJECTED'] } },
  });
  if (criticalMaint > 0) alerts.push({ type: 'CRITICAL_MAINTENANCE', count: criticalMaint, severity: 'critical', message: `${criticalMaint} critical maintenance item(s)` });

  const securityAlerts = await prisma.securityEvent.count({
    where: { type: 'SUSPICIOUS_LOGIN', createdAt: { gte: new Date(Date.now() - 24 * 3600000) } },
  });
  if (securityAlerts > 0 && user.role === 'ADMIN') {
    alerts.push({ type: 'SECURITY_ALERTS', count: securityAlerts, severity: 'high', message: `${securityAlerts} suspicious login(s) in 24h` });
  }

  const auditIssues = await prisma.auditItem.count({ where: { status: { in: ['MISSING', 'DAMAGED'] } } });
  if (auditIssues > 0) alerts.push({ type: 'AUDIT_ISSUES', count: auditIssues, severity: 'medium', message: `${auditIssues} audit discrepanc(ies)` });

  return alerts;
};

export const updateOverdueAllocations = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.allocation.updateMany({
    where: {
      status: 'ACTIVE',
      expectedReturnDate: { lt: today },
      isOverdue: false,
    },
    data: { isOverdue: true, status: 'OVERDUE' },
  });
};

export const updateBookingStatuses = async () => {
  const now = new Date();

  await prisma.booking.updateMany({
    where: { status: 'UPCOMING', startTime: { lte: now }, endTime: { gt: now } },
    data: { status: 'ONGOING' },
  });

  await prisma.booking.updateMany({
    where: { status: { in: ['UPCOMING', 'ONGOING'] }, endTime: { lte: now } },
    data: { status: 'COMPLETED' },
  });
};
