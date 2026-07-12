import { Router } from 'express';
import { body } from 'express-validator';
import * as assetController from '../controllers/assetController.js';
import { authenticate } from '../middleware/auth.js';
import { isAdminOrManager } from '../middleware/roles.js';
import { upload } from '../middleware/upload.js';
import { validate } from '../utils/validators.js';

const router = Router();
router.use(authenticate);

router.get('/', assetController.getAssets);
router.get('/bookable', assetController.getBookableAssets);
router.get('/:id', assetController.getAsset);

router.post('/', upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'document', maxCount: 1 },
]), [
  body('name').trim().notEmpty(),
  body('categoryId').isUUID(),
  validate,
], assetController.createAsset);

router.put('/:id', isAdminOrManager, upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'document', maxCount: 1 },
]), assetController.updateAsset);

router.patch('/:id/status', isAdminOrManager, assetController.updateAssetStatus);
router.delete('/:id', isAdminOrManager, assetController.deleteAsset);

export default router;
