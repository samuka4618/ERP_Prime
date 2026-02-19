import { Router } from 'express';
import { SystemConfigModel } from './SystemConfig';
import { authenticate, authorize } from '../auth/middleware';
import { validate } from '../../shared/middleware/validation';
import { updateSystemConfigSchema } from './schemas';
import { UserRole } from '../../shared/types';
import { uploadSingle } from '../../shared/middleware/upload';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

console.log('✅ Módulo de rotas do sistema carregado - Rota /logo será registrada');

// Rota pública para obter apenas nome e logo do sistema (para tela de login)
// DEVE vir ANTES de qualquer middleware de autenticação
router.get('/public-config', async (req, res) => {
  console.log('🔓 Rota pública /public-config acessada');
  try {
    const config = await SystemConfigModel.getSystemConfig();
    console.log('✅ Configurações obtidas:', {
      system_name: config.system_name,
      has_logo: !!config.system_logo
    });
    res.json({
      message: 'Configurações públicas obtidas com sucesso',
      data: {
        system_name: config.system_name || 'ERP PRIME',
        system_subtitle: config.system_subtitle || 'Sistema de Gestão Empresarial',
        system_logo: config.system_logo || '',
        system_version: config.system_version || '1.0.0'
      }
    });
  } catch (error) {
    console.error('Erro ao buscar configurações públicas:', error);
    // Em caso de erro, retornar valores padrão
    res.json({
      message: 'Configurações públicas obtidas com sucesso',
      data: {
        system_name: 'ERP PRIME',
        system_subtitle: 'Sistema de Gestão Empresarial',
        system_logo: '',
        system_version: '1.0.0'
      }
    });
  }
});

// Todas as outras rotas precisam de autenticação
router.use((req, res, next) => {
  console.log('🔐 Middleware de autenticação - Rota:', req.path, req.method);
  authenticate(req, res, next);
});

// Apenas administradores podem acessar configurações do sistema
router.use((req, res, next) => {
  console.log('👮 Middleware de autorização - Rota:', req.path, req.method, 'User:', req.user?.role);
  authorize(UserRole.ADMIN)(req, res, next);
});

// Rotas de configuração do sistema
router.get('/config', async (req, res) => {
  try {
    const config = await SystemConfigModel.getSystemConfig();
    res.json({ message: 'Configurações obtidas com sucesso', data: config });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter configurações' });
  }
});

// Rota para atualizar configurações GLOBAIS do sistema
// IMPORTANTE: Estas configurações são aplicadas para TODOS os usuários do sistema
router.put('/config', validate(updateSystemConfigSchema), async (req, res) => {
  try {
    const config = await SystemConfigModel.updateSystemConfig(req.body);
    console.log('✅ Configurações globais atualizadas:', {
      system_name: config.system_name,
      system_subtitle: config.system_subtitle,
      has_logo: !!config.system_logo
    });
    res.json({ message: 'Configurações globais atualizadas com sucesso', data: config });
  } catch (error) {
    console.error('❌ Erro ao atualizar configurações globais:', error);
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

// Rota para upload de logo do sistema
console.log('✅ Rota POST /system/logo registrada');
router.post('/logo', (req, res, next) => {
  console.log('📤 Recebendo requisição de upload de logo:', {
    method: req.method,
    url: req.url,
    path: req.path,
    originalUrl: req.originalUrl,
    headers: {
      'content-type': req.headers['content-type'],
      'authorization': req.headers['authorization'] ? 'Bearer ***' : 'não fornecido'
    },
    hasBody: !!req.body,
    bodyKeys: req.body ? Object.keys(req.body) : []
  });
  next();
}, (req, res, next) => {
  // Wrapper para capturar erros do multer
  uploadSingle(req, res, (err) => {
    if (err) {
      console.error('❌ Erro no multer:', err);
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ error: 'Arquivo muito grande. Tamanho máximo: 10MB' });
          return;
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          res.status(400).json({ error: 'Campo de arquivo inesperado. Use "attachment"' });
          return;
        }
      }
      res.status(400).json({ error: `Erro ao processar arquivo: ${err.message}` });
      return;
    }
    next();
  });
}, async (req, res) => {
  try {
    console.log('📁 Upload processado:', {
      hasFile: !!req.file,
      fileInfo: req.file ? {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      } : null
    });

    if (!req.file) {
      console.error('❌ Nenhum arquivo recebido na requisição');
      res.status(400).json({ error: 'Nenhum arquivo enviado' });
      return;
    }

    // Validar tipo de arquivo (apenas imagens)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      // Remover arquivo inválido
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'Tipo de arquivo não permitido. Apenas imagens são aceitas.' });
      return;
    }

    // Validar tamanho (máximo 2MB)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (req.file.size > maxSize) {
      // Remover arquivo muito grande
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'Arquivo muito grande. Tamanho máximo: 2MB' });
      return;
    }

    // Obter logo atual para remover se existir
    const currentConfig = await SystemConfigModel.getSystemConfig();
    if (currentConfig.system_logo) {
      const oldLogoPath = path.join(process.cwd(), currentConfig.system_logo);
      if (fs.existsSync(oldLogoPath)) {
        try {
          fs.unlinkSync(oldLogoPath);
        } catch (error) {
          console.warn('Erro ao remover logo antigo:', error);
        }
      }
    }

    // Salvar caminho relativo do arquivo
    const relativePath = path.relative(process.cwd(), req.file.path).replace(/\\/g, '/');
    
    // Atualizar configuração com o novo logo
    await SystemConfigModel.updateSystemConfig({
      system_logo: relativePath
    });

    res.json({
      message: 'Logo atualizado com sucesso',
      data: {
        logo_path: relativePath,
        logo_url: `/${relativePath}`
      }
    });
  } catch (error) {
    console.error('Erro ao fazer upload do logo:', error);
    res.status(500).json({ error: 'Erro ao fazer upload do logo' });
  }
});

export default router;
