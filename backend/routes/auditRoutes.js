import { Router } from 'express';
import { body } from 'express-validator';
import * as auditController from '../controllers/auditController.js';
import { authenticate } from '../middleware/auth.js';
import { isAdmin, isAdminOrManager } from '../middleware/roles.js';
import { validate } from '../utils/validators.js';

const router = Router();
router.use(authenticate);

router.get('/', auditController.getAuditCycles);
router.get('/:id', auditController.getAuditCycle);
router.get('/:id/discrepancies', auditController.getDiscrepancyReport);

router.post('/', isAdmin, [
  body('name').trim().notEmpty(),
  body('startDate').isISO8601(),
  body('endDate').isISO8601(),
  validate,
], auditController.createAuditCycle);

router.post('/:id/start', isAdminOrManager, auditController.startAuditCycle);
router.post('/:id/close', isAdminOrManager, auditController.closeCycle);
router.post('/:id/auditors', isAdmin, auditController.assignAuditors);
router.patch('/:id/items/:itemId', auditController.updateAuditItem);

export default router;
