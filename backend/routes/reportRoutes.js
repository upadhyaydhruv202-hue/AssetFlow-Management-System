import { Router } from 'express';
import * as reportController from '../controllers/reportController.js';
import { authenticate } from '../middleware/auth.js';
import { isManagerOrHead } from '../middleware/roles.js';

const router = Router();
router.use(authenticate, isManagerOrHead);
router.get('/', reportController.getReports);
router.get('/maintenance-retirement', reportController.getMaintenanceRetirement);
router.get('/maintenance-retirement/summary', reportController.getMaintenanceRetirementSummaryHandler);
router.get('/booking-heatmap', reportController.getBookingHeatmapAnalytics);
router.get('/export', reportController.exportReport);
export default router;
