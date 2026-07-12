import { Router } from 'express';
import { body } from 'express-validator';
import * as bookingController from '../controllers/bookingController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../utils/validators.js';

const router = Router();
router.use(authenticate);

router.get('/', bookingController.getBookings);
router.get('/my', bookingController.getMyBookings);
router.get('/asset/:assetId', bookingController.getAssetBookings);

router.post('/', [
  body('assetId').isUUID(),
  body('startTime').isISO8601(),
  body('endTime').isISO8601(),
  validate,
], bookingController.createBooking);

router.post('/:id/cancel', bookingController.cancelBooking);
router.put('/:id/reschedule', [
  body('startTime').isISO8601(),
  body('endTime').isISO8601(),
  validate,
], bookingController.rescheduleBooking);

export default router;
