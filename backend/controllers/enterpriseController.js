import prisma from '../config/database.js';
import { ApiError, successResponse } from '../utils/apiResponse.js';
import { logActivity } from '../utils/activityLogger.js';
import {
  generateDailySummary,
  getSmartRecommendations,
  suggestAssetFromImage,
  recommendAllocation,
  predictReturnDate,
  suggestAlternativeResources,
  predictMaintenance,
  detectMissingAssets,
  generateBusinessInsights,
  forecastAnalytics,
  departmentBenchmarking,
  predictCosts,
  summarizeNotifications,
} from '../services/aiService.js';
import { getDigitalTwin, getAssetHealthOverview, getWarrantyTimeline } from '../services/assetHealthService.js';
import { getCustodyTimeline } from '../services/custodyService.js';
import { runImportJob, batchReassignAssets } from '../services/importService.js';
import { syncEmployees, syncDepartments, syncRoles, getHrmsStatus } from '../services/hrmsService.js';
import {
  generateBookingQR, checkInBooking, addToWaitlist, generateCalendarEvent,
} from '../services/bookingExtensionService.js';
import {
  calculateMttr, getSlaBreaches, getPredictiveMaintenanceList, getSensorDashboard, generateSensorReadings,
} from '../services/maintenanceExtensionService.js';
import {
  generateAutoDiscrepancyReport, storeOfflineSync, syncOfflineAudit, verifyByQR,
} from '../services/auditExtensionService.js';

export const getAiSummary = async (req, res, next) => {
  try {
    const summary = await generateDailySummary(req.user);
    return successResponse(res, summary);
  } catch (error) { next(error); }
};

export const getRecommendations = async (req, res, next) => {
  try {
    const recommendations = await getSmartRecommendations(req.user);
    return successResponse(res, recommendations);
  } catch (error) { next(error); }
};

export const analyzeImage = async (req, res, next) => {
  try {
    const filename = req.file?.originalname || req.body.filename || 'asset.jpg';
    const suggestion = suggestAssetFromImage(filename);
    return successResponse(res, suggestion);
  } catch (error) { next(error); }
};

export const getAllocationRecommendations = async (req, res, next) => {
  try {
    const recs = await recommendAllocation(req.query);
    return successResponse(res, recs);
  } catch (error) { next(error); }
};

export const getReturnPrediction = async (req, res, next) => {
  try {
    const date = await predictReturnDate(req.params.assetId, req.query.employeeId);
    return successResponse(res, { predictedReturnDate: date });
  } catch (error) { next(error); }
};

export const getBookingAlternatives = async (req, res, next) => {
  try {
    const { assetId, startTime, endTime } = req.query;
    const alternatives = await suggestAlternativeResources(assetId, startTime, endTime);
    return successResponse(res, alternatives);
  } catch (error) { next(error); }
};

export const getAssetTwin = async (req, res, next) => {
  try {
    const twin = await getDigitalTwin(req.params.id);
    if (!twin) throw new ApiError(404, 'Asset not found');
    return successResponse(res, twin);
  } catch (error) { next(error); }
};

export const getAssetHealth = async (req, res, next) => {
  try {
    const health = await getAssetHealthOverview(parseInt(req.query.limit) || 10);
    return successResponse(res, health);
  } catch (error) { next(error); }
};

export const getWarranty = async (req, res, next) => {
  try {
    const asset = await prisma.asset.findUnique({ where: { id: req.params.id }, include: { category: true } });
    if (!asset) throw new ApiError(404, 'Asset not found');
    return successResponse(res, getWarrantyTimeline(asset));
  } catch (error) { next(error); }
};

export const getCustody = async (req, res, next) => {
  try {
    const timeline = await getCustodyTimeline(req.params.id);
    return successResponse(res, timeline);
  } catch (error) { next(error); }
};

export const bulkImport = async (req, res, next) => {
  try {
    const { entityType, csvContent } = req.body;
    const result = await runImportJob(entityType, csvContent, req.user.id);
    await logActivity(req.user.id, 'IMPORT', entityType, result.jobId, result, req.ip);
    return successResponse(res, result, 'Import completed');
  } catch (error) { next(error); }
};

export const batchReassign = async (req, res, next) => {
  try {
    const { fromEmployeeId, toEmployeeId } = req.body;
    if (!req.employee) throw new ApiError(400, 'Employee profile required');
    const results = await batchReassignAssets(fromEmployeeId, toEmployeeId, req.employee.id);
    await logActivity(req.user.id, 'BATCH_REASSIGN', 'Employee', fromEmployeeId, { toEmployeeId, count: results.length }, req.ip);
    return successResponse(res, results, `${results.length} assets reassigned`);
  } catch (error) { next(error); }
};

export const getApprovalMatrices = async (req, res, next) => {
  try {
    const matrices = await prisma.approvalMatrix.findMany({ where: { isActive: true } });
    return successResponse(res, matrices);
  } catch (error) { next(error); }
};

export const saveApprovalMatrix = async (req, res, next) => {
  try {
    const { workflowType, name, steps } = req.body;
    const matrix = await prisma.approvalMatrix.upsert({
      where: { id: req.body.id || '00000000-0000-0000-0000-000000000000' },
      create: { workflowType, name, steps },
      update: { name, steps },
    }).catch(async () => {
      return prisma.approvalMatrix.create({ data: { workflowType, name, steps } });
    });
    await logActivity(req.user.id, 'CREATE', 'ApprovalMatrix', matrix.id, req.body, req.ip);
    return successResponse(res, matrix, 'Approval matrix saved', 201);
  } catch (error) { next(error); }
};

export const reorderDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { parentId, sortOrder } = req.body;

    if (parentId === id) {
      throw new ApiError(400, 'Department cannot be its own parent');
    }

    if (parentId) {
      const parent = await prisma.department.findFirst({
        where: { id: parentId, deletedAt: null },
      });
      if (!parent) throw new ApiError(404, 'Parent department not found');

      const descendants = new Set();
      const queue = [id];
      while (queue.length) {
        const currentId = queue.shift();
        const children = await prisma.department.findMany({
          where: { parentId: currentId, deletedAt: null },
          select: { id: true },
        });
        for (const child of children) {
          descendants.add(child.id);
          queue.push(child.id);
        }
      }
      if (descendants.has(parentId)) {
        throw new ApiError(400, 'Cannot move a department under its own descendant');
      }
    }

    const dept = await prisma.department.update({
      where: { id },
      data: { parentId: parentId || null },
    });
    await logActivity(req.user.id, 'UPDATE', 'Department', id, { parentId, sortOrder }, req.ip);
    return successResponse(res, dept, 'Department moved');
  } catch (error) { next(error); }
};

export const getDepartmentTree = async (req, res, next) => {
  try {
    const departments = await prisma.department.findMany({
      where: { deletedAt: null },
      include: { departmentHead: { select: { firstName: true, lastName: true } }, _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    });
    const buildTree = (parentId = null) => departments
      .filter((d) => d.parentId === parentId)
      .map((d) => ({ ...d, children: buildTree(d.id) }));
    return successResponse(res, buildTree());
  } catch (error) { next(error); }
};

export const hrmsStatus = async (req, res, next) => {
  try { return successResponse(res, getHrmsStatus()); } catch (error) { next(error); }
};

export const hrmsSyncEmployees = async (req, res, next) => {
  try {
    const result = await syncEmployees(req.body.employees || []);
    return successResponse(res, result);
  } catch (error) { next(error); }
};

export const hrmsSyncDepartments = async (req, res, next) => {
  try {
    const result = await syncDepartments(req.body.departments || []);
    return successResponse(res, result);
  } catch (error) { next(error); }
};

export const hrmsSyncRoles = async (req, res, next) => {
  try {
    const result = await syncRoles(req.body.roles || []);
    return successResponse(res, result);
  } catch (error) { next(error); }
};

export const bookingQR = async (req, res, next) => {
  try {
    const qr = await generateBookingQR(req.params.id);
    return successResponse(res, { qrCode: qr });
  } catch (error) { next(error); }
};

export const bookingCheckIn = async (req, res, next) => {
  try {
    const result = await checkInBooking(req.params.id, req.body.qrData);
    if (!result.success) throw new ApiError(400, result.message);
    await logActivity(req.user.id, 'CHECK_IN', 'Booking', req.params.id, null, req.ip);
    return successResponse(res, result.booking, 'Checked in');
  } catch (error) { next(error); }
};

export const joinWaitlist = async (req, res, next) => {
  try {
    const entry = await addToWaitlist({ ...req.body, employeeId: req.employee.id });
    return successResponse(res, entry, 'Added to waitlist', 201);
  } catch (error) { next(error); }
};

export const calendarSync = async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) throw new ApiError(404, 'Booking not found');
    const cal = generateCalendarEvent(booking);
    await prisma.booking.update({ where: { id: booking.id }, data: { calendarEventId: cal.calendarEventId } });
    return successResponse(res, cal);
  } catch (error) { next(error); }
};

export const maintenancePredictive = async (req, res, next) => {
  try {
    const list = await getPredictiveMaintenanceList();
    return successResponse(res, list);
  } catch (error) { next(error); }
};

export const maintenanceMttr = async (req, res, next) => {
  try {
    const mttr = await calculateMttr();
    return successResponse(res, mttr);
  } catch (error) { next(error); }
};

export const maintenanceSla = async (req, res, next) => {
  try {
    const breaches = await getSlaBreaches();
    return successResponse(res, breaches);
  } catch (error) { next(error); }
};

export const maintenanceSensors = async (req, res, next) => {
  try {
    if (req.query.generate === 'true') await generateSensorReadings(req.params.assetId);
    const dashboard = await getSensorDashboard(req.params.assetId);
    return successResponse(res, dashboard);
  } catch (error) { next(error); }
};

export const maintenancePredictAsset = async (req, res, next) => {
  try {
    const pred = await predictMaintenance(req.params.assetId);
    return successResponse(res, pred);
  } catch (error) { next(error); }
};

export const getSpareParts = async (req, res, next) => {
  try {
    const parts = await prisma.sparePart.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    return successResponse(res, parts);
  } catch (error) { next(error); }
};

export const createSparePart = async (req, res, next) => {
  try {
    const part = await prisma.sparePart.create({ data: req.body });
    return successResponse(res, part, 'Spare part created', 201);
  } catch (error) { next(error); }
};

export const auditDiscrepancyReport = async (req, res, next) => {
  try {
    const report = await generateAutoDiscrepancyReport(req.params.id);
    return successResponse(res, report);
  } catch (error) { next(error); }
};

export const auditOfflineStore = async (req, res, next) => {
  try {
    const sync = await storeOfflineSync(req.params.id, req.employee.id, req.body);
    return successResponse(res, sync, 'Offline data stored', 201);
  } catch (error) { next(error); }
};

export const auditOfflineSyncHandler = async (req, res, next) => {
  try {
    const result = await syncOfflineAudit(req.params.syncId);
    if (!result) throw new ApiError(404, 'Sync record not found');
    return successResponse(res, result, 'Offline audit synced');
  } catch (error) { next(error); }
};

export const auditQrVerify = async (req, res, next) => {
  try {
    const result = await verifyByQR(req.params.id, req.body.assetTag, req.employee.id);
    return successResponse(res, result);
  } catch (error) { next(error); }
};

export const auditAiMissing = async (req, res, next) => {
  try {
    const anomalies = await detectMissingAssets(req.params.id);
    return successResponse(res, anomalies);
  } catch (error) { next(error); }
};

export const reportsInsights = async (req, res, next) => {
  try {
    const insights = await generateBusinessInsights();
    return successResponse(res, insights);
  } catch (error) { next(error); }
};

export const reportsForecast = async (req, res, next) => {
  try {
    const forecast = await forecastAnalytics();
    return successResponse(res, forecast);
  } catch (error) { next(error); }
};

export const reportsBenchmark = async (req, res, next) => {
  try {
    const benchmark = await departmentBenchmarking();
    return successResponse(res, benchmark);
  } catch (error) { next(error); }
};

export const reportsCostPrediction = async (req, res, next) => {
  try {
    const costs = await predictCosts();
    return successResponse(res, costs);
  } catch (error) { next(error); }
};

export const notificationAiSummary = async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id, isRead: false },
      orderBy: { createdAt: 'desc' },
    });
    const summary = summarizeNotifications(notifications);
    return successResponse(res, { ...summary, notifications });
  } catch (error) { next(error); }
};

export const getSecurityIncidents = async (req, res, next) => {
  try {
    const incidents = await prisma.securityEvent.findMany({
      where: { type: { in: ['SUSPICIOUS_LOGIN', 'LOGIN_FAILED', 'UNAUTHORIZED_ACCESS'] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { email: true } } },
    });
    return successResponse(res, incidents);
  } catch (error) { next(error); }
};

export const getLiveActivity = async (req, res, next) => {
  try {
    const logs = await prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { user: { select: { email: true, employee: { select: { firstName: true, lastName: true } } } } },
    });
    return successResponse(res, logs);
  } catch (error) { next(error); }
};
