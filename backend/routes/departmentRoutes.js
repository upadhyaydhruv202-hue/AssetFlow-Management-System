import { Router } from 'express';
import { body } from 'express-validator';
import * as departmentController from '../controllers/departmentController.js';
import { authenticate } from '../middleware/auth.js';
import { isAdmin } from '../middleware/roles.js';
import { validate } from '../utils/validators.js';

const router = Router();
router.use(authenticate);

router.get('/', departmentController.getDepartments);
router.get('/all', departmentController.getAllDepartments);
router.get('/:id', departmentController.getDepartment);

router.post('/', isAdmin, [
  body('name').trim().notEmpty(),
  body('code').trim().notEmpty(),
  validate,
], departmentController.createDepartment);

router.put('/:id', isAdmin, departmentController.updateDepartment);
router.delete('/:id', isAdmin, departmentController.deleteDepartment);

export default router;
