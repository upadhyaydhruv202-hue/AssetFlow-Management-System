import { Router } from 'express';
import { body } from 'express-validator';
import * as employeeController from '../controllers/employeeController.js';
import { authenticate } from '../middleware/auth.js';
import { isAdmin } from '../middleware/roles.js';
import { validate } from '../utils/validators.js';

const router = Router();
router.use(authenticate);

router.get('/', employeeController.getEmployees);
router.get('/all', employeeController.getAllEmployees);
router.get('/:id', employeeController.getEmployee);
router.put('/:id', isAdmin, employeeController.updateEmployee);

router.patch('/:id/role', isAdmin, [
  body('role').isIn(['EMPLOYEE', 'ADMIN']),
  validate,
], employeeController.updateEmployeeRole);

export default router;
