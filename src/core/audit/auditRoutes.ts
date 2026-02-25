import { Router } from 'express';
import { requirePermission } from '../permissions/middleware';
import { AuditLogController } from './AuditLogController';

const router = Router();

router.get('/', requirePermission('system.audit.view'), AuditLogController.list);

export default router;
