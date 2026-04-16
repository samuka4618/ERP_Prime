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
import { log as auditLog } from '../audit/AuditService';
import {
  createBackup,
  restoreBackup,
  runPostRestoreChecklist,
  validateBackupBuffer
} from '../backup/BackupService';
import { BackupAutomationService } from '../backup/BackupAutomationService';
import { NotificationService } from '../../modules/chamados/services/NotificationService';
import { NotificationTemplateModel } from './NotificationTemplateModel';
import { NOTIFICATION_TEMPLATE_DEFINITIONS } from './notificationTemplateCatalog';
import type { NotificationTemplateKey } from '../../shared/types';

/** Placeholders globais disponíveis em todos os templates (variáveis de sistema). */
const GLOBAL_PLACEHOLDERS = ['{{system_name}}', '{{current_year}}', '{{client.url}}'];

const getIp = (req: any) => req.ip || (req.headers['x-forwarded-for'] as string) || undefined;

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

// Listar todas as notificações por e-mail (catálogo + configuração armazenada)
router.get('/notification-templates', async (req, res) => {
  try {
    const stored = await NotificationTemplateModel.getAll();
    const storedByKey = new Map(stored.map((t) => [t.notification_key, t]));
    const list = NOTIFICATION_TEMPLATE_DEFINITIONS.map((def) => {
      const t = storedByKey.get(def.key);
      const existing = new Set(def.placeholders);
      GLOBAL_PLACEHOLDERS.forEach((ph) => existing.add(ph));
      return {
        key: def.key,
        label: def.label,
        description: def.description,
        placeholders: Array.from(existing),
        enabled: t?.enabled ?? true,
        subject_template: t?.subject_template ?? def.default_subject,
        body_html: t?.body_html ?? def.default_body_html,
        updated_at: t?.updated_at,
      };
    });
    res.json({ message: 'OK', data: list });
  } catch (error: any) {
    console.error('Erro ao listar templates de notificação:', error);
    res.status(500).json({ error: error.message || 'Erro ao listar templates' });
  }
});

// Atualizar um ou mais templates de notificação
router.put('/notification-templates', async (req, res) => {
  try {
    const body = req.body as
      | { notification_key: NotificationTemplateKey; enabled?: boolean; subject_template?: string; body_html?: string }
      | Array<{ notification_key: NotificationTemplateKey; enabled?: boolean; subject_template?: string; body_html?: string }>;
    const updates = Array.isArray(body) ? body : [body];
    const results = [];
    for (const u of updates) {
      if (!u?.notification_key) continue;
      const updated = await NotificationTemplateModel.update(u.notification_key, {
        enabled: u.enabled,
        subject_template: u.subject_template,
        body_html: u.body_html,
      });
      results.push(updated);
    }
    res.json({ message: 'Templates atualizados', data: results });
  } catch (error: any) {
    console.error('Erro ao atualizar templates de notificação:', error);
    res.status(500).json({ error: error.message || 'Erro ao atualizar templates' });
  }
});

// Rota para testar envio de e-mail (envia para o e-mail do usuário logado)
router.post('/test-email', async (req, res) => {
  try {
    const email = req.user?.email;
    if (!email) {
      res.status(400).json({ error: 'Usuário sem e-mail cadastrado' });
      return;
    }
    const result = await NotificationService.sendTestEmail(email);
    if (result.success) {
      res.json({ message: `E-mail de teste enviado para ${email}. Verifique sua caixa de entrada.` });
      return;
    }
    res.status(400).json({ error: result.error || 'Falha ao enviar e-mail de teste' });
  } catch (error: any) {
    console.error('Erro ao enviar e-mail de teste:', error);
    res.status(500).json({ error: error.message || 'Erro ao enviar e-mail de teste' });
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

// Backup: apenas admin (já está em router.use(authorize(ADMIN)))
router.get('/backup', async (req, res) => {
  try {
    const { stream, filename } = await createBackup();
    auditLog({
      userId: (req as any).user?.id,
      userName: (req as any).user?.name,
      action: 'system.backup.create',
      resource: 'system',
      resourceId: filename,
      details: `Backup gerado: ${filename}`,
      ip: getIp(req)
    });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    stream.pipe(res);
  } catch (error: any) {
    console.error('Erro ao gerar backup:', error);
    res.status(500).json({ error: error.message || 'Erro ao gerar backup' });
  }
});

// Restore/Validate: upload ZIP em disco (max 500 MB) para reduzir pressão de memória
const restoreUploadDir = path.join(process.cwd(), 'data', 'backups', 'uploads');
if (!fs.existsSync(restoreUploadDir)) {
  fs.mkdirSync(restoreUploadDir, { recursive: true });
}

const restoreUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, restoreUploadDir),
    filename: (_req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}-${safeName}`);
    }
  }),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype === 'application/zip' || file.originalname?.toLowerCase().endsWith('.zip');
    cb(null, !!ok);
  }
});

router.post('/backup/validate', restoreUpload.single('file'), async (req, res) => {
  try {
    if (!req.file?.path) {
      res.status(400).json({ error: 'Envie um arquivo ZIP de backup (campo: file).' });
      return;
    }
    const zipBuffer = fs.readFileSync(req.file.path);
    const validation = await validateBackupBuffer(zipBuffer);
    res.json({
      message: validation.valid ? 'Backup válido para restauração.' : 'Backup com alertas de integridade.',
      data: validation
    });
  } catch (error: any) {
    console.error('Erro ao validar backup:', error);
    res.status(400).json({ error: error.message || 'Erro ao validar backup' });
  } finally {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.rmSync(req.file.path, { force: true });
    }
  }
});

router.get('/backup/health', async (_req, res) => {
  try {
    const health = BackupAutomationService.getHealth();
    res.json({ message: 'Saúde do subsistema de backup', data: health });
  } catch (error: any) {
    console.error('Erro ao obter saúde do backup:', error);
    res.status(500).json({ error: error.message || 'Erro ao obter saúde do backup' });
  }
});

router.get('/backup/post-restore-checks', async (_req, res) => {
  try {
    const report = await runPostRestoreChecklist();
    res.json({
      message:
        report.summary.failed > 0
          ? 'Checklist pós-restore executado com alertas.'
          : 'Checklist pós-restore executado com sucesso.',
      data: report
    });
  } catch (error: any) {
    console.error('Erro ao executar checklist pós-restore:', error);
    res.status(500).json({ error: error.message || 'Erro ao executar checklist pós-restore' });
  }
});

router.post('/restore', restoreUpload.single('file'), async (req, res) => {
  try {
    if (!req.file?.path) {
      res.status(400).json({ error: 'Envie um arquivo ZIP de backup (campo: file).' });
      return;
    }
    const zipBuffer = fs.readFileSync(req.file.path);
    const result = await restoreBackup(zipBuffer);
    auditLog({
      userId: (req as any).user?.id,
      userName: (req as any).user?.name,
      action: 'system.backup.restore',
      resource: 'system',
      resourceId: result.createdAt,
      details: `Restauração: backup de ${result.createdAt}, versão ${result.backupVersion}`,
      ip: getIp(req)
    });
    res.json({
      message: result.message,
      data: {
        backupVersion: result.backupVersion,
        appVersion: result.appVersion,
        backupCreatedAt: result.createdAt,
        warnings: result.warnings,
        checks: result.checks,
        restartRequired: true
      }
    });
  } catch (error: any) {
    console.error('Erro ao restaurar backup:', error);
    res.status(400).json({ error: error.message || 'Erro ao restaurar backup' });
  } finally {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.rmSync(req.file.path, { force: true });
    }
  }
});

export default router;
