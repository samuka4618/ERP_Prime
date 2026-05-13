import { Router } from 'express';
import { CategoryApproverController } from '../controllers/CategoryApproverController';
import { authenticate } from '../../../core/auth/middleware';
import { adminOrPermission } from '../../../core/permissions/middleware';

const router = Router();
router.use(authenticate);

router.get(
  '/by-category/:categoryId',
  adminOrPermission('tickets.categories.manage'),
  CategoryApproverController.listByCategory
);
router.post(
  '/by-category/:categoryId',
  adminOrPermission('tickets.categories.manage'),
  CategoryApproverController.create
);
router.patch('/:id', adminOrPermission('tickets.categories.manage'), CategoryApproverController.update);
router.delete('/:id', adminOrPermission('tickets.categories.manage'), CategoryApproverController.remove);

export default router;
