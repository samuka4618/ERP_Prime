import { Router } from 'express';
import { SystemSettingsController } from '../controllers/SystemSettingsController';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../types';

const router = Router();

// GET /api/system-config/timezone - Obter configurações de timezone (público)
router.get('/timezone', SystemSettingsController.getTimezoneConfig);

// Todas as outras rotas de configuração requerem autenticação
router.use(authenticate);

// Apenas administradores podem gerenciar configurações
router.use(authorize(UserRole.ADMIN));

// GET /api/system-config - Listar todas as configurações
router.get('/', SystemSettingsController.getAll);

// GET /api/system-config/:key - Obter configuração específica
router.get('/:key', SystemSettingsController.get);

// PUT /api/system-config - Atualizar configuração
router.put('/', SystemSettingsController.update);

// PUT /api/system-config/multiple - Atualizar múltiplas configurações
router.put('/multiple', SystemSettingsController.updateMultiple);

export default router;
