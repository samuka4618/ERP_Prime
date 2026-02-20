import { Router } from 'express';
import { SMSTemplateController } from '../controllers/SMSTemplateController';
import { authenticate } from '../../../core/auth/middleware';
import { requirePermission } from '../../../core/permissions/middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// Todas as rotas requerem permissão de gerenciar formulários (mesma permissão do módulo)
router.use(requirePermission('descarregamento.formularios.manage'));

router.post('/', SMSTemplateController.create);
router.post('/test', SMSTemplateController.test);
router.get('/', SMSTemplateController.findAll);
router.get('/:id', SMSTemplateController.findById);
router.put('/:id', SMSTemplateController.update);
router.delete('/:id', SMSTemplateController.delete);

export default router;
