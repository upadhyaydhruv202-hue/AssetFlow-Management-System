import { Router } from 'express';
import { body } from 'express-validator';
import * as categoryController from '../controllers/categoryController.js';
import { authenticate } from '../middleware/auth.js';
import { isAdmin } from '../middleware/roles.js';
import { validate } from '../utils/validators.js';

const router = Router();
router.use(authenticate);

router.get('/', categoryController.getCategories);
router.get('/all', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategory);

router.post('/', isAdmin, [
  body('name').trim().notEmpty(),
  validate,
], categoryController.createCategory);

router.put('/:id', isAdmin, categoryController.updateCategory);
router.delete('/:id', isAdmin, categoryController.deleteCategory);

export default router;
