import { Router } from 'express';
import { CardSubscriptionController } from '../controllers/CardSubscriptionController';
import { authenticate } from '../../../core/auth/middleware';
import { validateParams } from '../../../shared/middleware/validation';
import { adminOrPermission } from '../../../core/permissions/middleware';
import { subscriptionsCatalogOrSelfGate, subscriptionsRevealGate } from '../middleware/subscriptionsAccess';
import Joi from 'joi';

const router = Router();
router.use(authenticate);

const idParam = Joi.object({
  id: Joi.number().integer().positive().required()
});

router.get('/summary', subscriptionsCatalogOrSelfGate, CardSubscriptionController.summary);
router.get('/renewals', subscriptionsCatalogOrSelfGate, CardSubscriptionController.renewals);
router.get('/', subscriptionsCatalogOrSelfGate, CardSubscriptionController.list);
router.get('/:id', subscriptionsCatalogOrSelfGate, validateParams(idParam), CardSubscriptionController.getById);
router.post(
  '/:id/reveal',
  validateParams(idParam),
  subscriptionsRevealGate,
  CardSubscriptionController.reveal
);
router.patch(
  '/:id/cancel',
  adminOrPermission('chamados.subscriptions.manage'),
  validateParams(idParam),
  CardSubscriptionController.cancel
);

export default router;
