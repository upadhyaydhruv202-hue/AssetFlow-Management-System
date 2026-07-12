import { Router } from 'express';
import { body } from 'express-validator';
import * as maintenanceController from '../controllers/maintenanceController.js';
import { authenticate } from '../middleware/auth.js';
import { isAdminOrManager } from '../middleware/roles.js';
import { upload } from '../middleware/upload.js';
import { validate } from '../utils/validators.js';

const router = Router();
router.use(authenticate);

router.get('/', maintenanceController.getMaintenanceRequests);
router.get('/:id', maintenanceController.getMaintenanceRequest);

router.post('/', upload.single('photo'), [
  body('assetId').isUUID(),
  body('title').trim().notEmpty(),
  body('description').trim().notEmpty(),
  validate,
], maintenanceController.createMaintenanceRequest);

router.post('/:id/approve', isAdminOrManager, maintenanceController.approveMaintenance);
router.post('/:id/reject', isAdminOrManager, maintenanceController.rejectMaintenance);
router.post('/:id/assign', isAdminOrManager, [
  body('technicianId').isUUID(),
  validate,
], maintenanceController.assignTechnician);
router.post('/:id/start', maintenanceController.startMaintenance);
router.post('/:id/resolve', maintenanceController.resolveMaintenance);

export default router;
