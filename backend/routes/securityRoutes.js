import { Router } from 'express';
import * as securityController from '../controllers/securityController.js';
import { authenticate } from '../middleware/auth.js';
import { isAdmin } from '../middleware/roles.js';
import { body } from 'express-validator';
import { validate } from '../utils/validators.js';

const router = Router();

router.get('/domains', authenticate, isAdmin, securityController.getAllowedDomains);
router.post('/domains', authenticate, isAdmin, [body('domain').notEmpty(), validate], securityController.addAllowedDomain);
router.delete('/domains/:id', authenticate, isAdmin, securityController.removeAllowedDomain);
router.get('/incidents', authenticate, isAdmin, securityController.getSecurityEvents);
router.get('/email/status', authenticate, isAdmin, securityController.getEmailStatus);
router.post('/email/test', authenticate, isAdmin, securityController.testEmail);

export default router;
