import { Router } from 'express';
import * as enterpriseController from '../controllers/enterpriseController.js';
import { authenticate } from '../middleware/auth.js';
import { isAdmin, isAdminOrManager, isManagerOrHead } from '../middleware/roles.js';

const router = Router();

// Security admin routes moved to securityRoutes.js

// AI & Dashboard extensions
router.get('/ai/summary', authenticate, enterpriseController.getAiSummary);
router.get('/ai/recommendations', authenticate, enterpriseController.getRecommendations);
router.post('/ai/analyze-image', authenticate, enterpriseController.analyzeImage);

// Organization extensions
router.get('/organization/tree', authenticate, enterpriseController.getDepartmentTree);
router.patch('/organization/departments/:id/move', authenticate, isAdmin, enterpriseController.reorderDepartment);
router.get('/organization/approval-matrices', authenticate, isAdmin, enterpriseController.getApprovalMatrices);
router.post('/organization/approval-matrices', authenticate, isAdmin, enterpriseController.saveApprovalMatrix);
router.post('/organization/import', authenticate, isAdmin, enterpriseController.bulkImport);
router.post('/organization/batch-reassign', authenticate, isAdmin, enterpriseController.batchReassign);

// HRMS stubs
router.get('/hrms/status', authenticate, isAdmin, enterpriseController.hrmsStatus);
router.post('/hrms/employees/sync', authenticate, isAdmin, enterpriseController.hrmsSyncEmployees);
router.post('/hrms/departments/sync', authenticate, isAdmin, enterpriseController.hrmsSyncDepartments);
router.post('/hrms/roles/sync', authenticate, isAdmin, enterpriseController.hrmsSyncRoles);

// Asset extensions
router.get('/assets/health-overview', authenticate, enterpriseController.getAssetHealth);
router.get('/assets/:id/twin', authenticate, enterpriseController.getAssetTwin);
router.get('/assets/:id/warranty', authenticate, enterpriseController.getWarranty);
router.get('/assets/:id/custody', authenticate, enterpriseController.getCustody);
router.get('/allocations/recommendations', authenticate, isAdminOrManager, enterpriseController.getAllocationRecommendations);
router.get('/allocations/predict-return/:assetId', authenticate, enterpriseController.getReturnPrediction);

// Booking extensions
router.get('/bookings/alternatives', authenticate, enterpriseController.getBookingAlternatives);
router.get('/bookings/:id/qr', authenticate, enterpriseController.bookingQR);
router.post('/bookings/:id/check-in', authenticate, enterpriseController.bookingCheckIn);
router.post('/bookings/waitlist', authenticate, enterpriseController.joinWaitlist);
router.get('/bookings/:id/calendar', authenticate, enterpriseController.calendarSync);

// Maintenance extensions
router.get('/maintenance/predictive', authenticate, isManagerOrHead, enterpriseController.maintenancePredictive);
router.get('/maintenance/mttr', authenticate, isManagerOrHead, enterpriseController.maintenanceMttr);
router.get('/maintenance/sla-breaches', authenticate, isManagerOrHead, enterpriseController.maintenanceSla);
router.get('/maintenance/sensors/:assetId', authenticate, enterpriseController.maintenanceSensors);
router.get('/maintenance/predict/:assetId', authenticate, enterpriseController.maintenancePredictAsset);
router.get('/maintenance/spare-parts', authenticate, isAdminOrManager, enterpriseController.getSpareParts);
router.post('/maintenance/spare-parts', authenticate, isAdminOrManager, enterpriseController.createSparePart);

// Audit extensions
router.get('/audits/:id/discrepancy-report', authenticate, isAdminOrManager, enterpriseController.auditDiscrepancyReport);
router.get('/audits/:id/ai-missing', authenticate, isAdminOrManager, enterpriseController.auditAiMissing);
router.post('/audits/:id/offline', authenticate, enterpriseController.auditOfflineStore);
router.post('/audits/offline/:syncId/sync', authenticate, enterpriseController.auditOfflineSyncHandler);
router.post('/audits/:id/qr-verify', authenticate, enterpriseController.auditQrVerify);

// Reports extensions
router.get('/reports/insights', authenticate, isManagerOrHead, enterpriseController.reportsInsights);
router.get('/reports/forecast', authenticate, isManagerOrHead, enterpriseController.reportsForecast);
router.get('/reports/benchmark', authenticate, isManagerOrHead, enterpriseController.reportsBenchmark);
router.get('/reports/cost-prediction', authenticate, isManagerOrHead, enterpriseController.reportsCostPrediction);

// Notifications extensions
router.get('/notifications/ai-summary', authenticate, enterpriseController.notificationAiSummary);
router.get('/notifications/security-incidents', authenticate, isAdmin, enterpriseController.getSecurityIncidents);
router.get('/activity/live', authenticate, enterpriseController.getLiveActivity);

export default router;
