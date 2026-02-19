import { Router } from 'express';
import { SystemConfigModel } from '../models/SystemConfig';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { updateSystemConfigSchema } from '../schemas/system';
import { UserRole } from '../types';

const router = Router();

// Todas as rotas precisam de autenticação
router.use(authenticate);

// Apenas administradores podem acessar configurações do sistema
router.use(authorize(UserRole.ADMIN));

// Rotas de configuração do sistema
router.get('/config', async (req, res) => {
  try {
    const config = await SystemConfigModel.getSystemConfig();
    res.json({ message: 'Configurações obtidas com sucesso', data: config });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter configurações' });
  }
});

router.put('/config', validate(updateSystemConfigSchema), async (req, res) => {
  try {
    const config = await SystemConfigModel.updateSystemConfig(req.body);
    res.json({ message: 'Configurações atualizadas com sucesso', data: config });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar configurações' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await SystemConfigModel.getSystemStats();
    res.json({ message: 'Estatísticas obtidas com sucesso', data: stats });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter estatísticas' });
  }
});

export default router;
