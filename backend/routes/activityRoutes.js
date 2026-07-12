import { Router } from 'express';
import * as activityController from '../controllers/activityController.js';
import { authenticate } from '../middleware/auth.js';
import { isAdminOrManager } from '../middleware/roles.js';

const router = Router();
router.use(authenticate, isAdminOrManager);
router.get('/', activityController.getActivityLogs);
export default router;
