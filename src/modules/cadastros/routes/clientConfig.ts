import { Router } from 'express';
import { authenticate, authorize } from '../../../core/auth/middleware';
import { ClientConfigController } from '../controllers/ClientConfigController';
import { UserRole } from '../../../shared/types';

const router = Router();
const controller = new ClientConfigController();

// Middleware de autenticação para todas as rotas
router.use(authenticate);

// GET /api/client-config/options - Todas opções para dropdowns
router.get('/options', (req, res) => controller.getConfigOptions(req, res));

// GET /api/client-config/statistics - Estatísticas de configurações (admin)
router.get('/statistics', authorize(UserRole.ADMIN), (req, res) => controller.getStatistics(req, res));

// GET /api/client-config/:type - Listar configs de um tipo (admin)
router.get('/:type', authorize(UserRole.ADMIN), (req, res) => controller.getConfigs(req, res));

// GET /api/client-config/:type/search - Buscar configs por termo (admin)
router.get('/:type/search', authorize(UserRole.ADMIN), (req, res) => controller.searchConfigs(req, res));

// GET /api/client-config/:type/:id - Buscar config específica (admin)
router.get('/:type/:id', authorize(UserRole.ADMIN), (req, res) => controller.getConfigById(req, res));

// POST /api/client-config/:type - Criar config (admin)
router.post('/:type', authorize(UserRole.ADMIN), (req, res) => controller.createConfig(req, res));

// PUT /api/client-config/:type/:id - Atualizar config (admin)
router.put('/:type/:id', authorize(UserRole.ADMIN), (req, res) => controller.updateConfig(req, res));

// DELETE /api/client-config/:type/:id - Deletar config (soft delete) (admin)
router.delete('/:type/:id', authorize(UserRole.ADMIN), (req, res) => controller.deleteConfig(req, res));

// DELETE /api/client-config/:type/:id/hard - Deletar config permanentemente (admin)
router.delete('/:type/:id/hard', authorize(UserRole.ADMIN), (req, res) => controller.hardDeleteConfig(req, res));

export default router;
