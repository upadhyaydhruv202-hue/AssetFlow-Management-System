import { Router } from 'express';
import { body } from 'express-validator';
import * as transferController from '../controllers/transferController.js';
import { authenticate } from '../middleware/auth.js';
import { isManagerOrHead } from '../middleware/roles.js';
import { validate } from '../utils/validators.js';

const router = Router();
router.use(authenticate);

router.get('/', transferController.getTransfers);

router.post('/', [
  body('assetId').isUUID(),
  validate,
], transferController.createTransfer);

router.post('/:id/approve', isManagerOrHead, transferController.approveTransfer);
router.post('/:id/reject', isManagerOrHead, transferController.rejectTransfer);

export default router;
