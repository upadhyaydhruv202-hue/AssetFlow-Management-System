import { Router } from 'express';
import { body } from 'express-validator';
import * as allocationController from '../controllers/allocationController.js';
import { authenticate } from '../middleware/auth.js';
import { isAdminOrManager, isManagerOrHead } from '../middleware/roles.js';
import { validate } from '../utils/validators.js';

const router = Router();
router.use(authenticate);

router.get('/', allocationController.getAllocations);
router.get('/my', allocationController.getMyAllocations);
router.get('/check/:assetId', allocationController.checkAssetAvailability);

router.post('/', isAdminOrManager, [
  body('assetId').isUUID(),
  validate,
], allocationController.allocateAsset);

router.post('/:id/return', allocationController.returnAsset);

export default router;
