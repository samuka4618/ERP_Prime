import { Router } from 'express';
import { authenticate, authorize } from '../auth/middleware';
import { UserRole } from '../../shared/types';
import { AccessProfileModel } from './AccessProfileModel';
import { log as auditLog } from '../audit/AuditService';

const router = Router();

router.use(authenticate, authorize(UserRole.ADMIN));

router.get('/', async (_req, res) => {
  const profiles = await AccessProfileModel.findAll();
  res.json({ data: profiles });
});

router.post('/', async (req, res) => {
  const { name, slug, description } = req.body || {};
  if (!name || !slug) {
    res.status(400).json({ error: 'name e slug são obrigatórios' });
    return;
  }
  const created = await AccessProfileModel.create({ name, slug, description });
  auditLog({
    userId: req.user?.id,
    userName: req.user?.name,
    action: 'access_profile.create',
    resource: 'access_profiles',
    resourceId: String(created.id),
    details: `Perfil ${created.name} criado`,
    ip: req.ip || undefined
  });
  res.status(201).json({ data: created });
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'id inválido' });
    return;
  }
  await AccessProfileModel.update(id, req.body || {});
  res.json({ message: 'Perfil atualizado' });
});

router.get('/:id/permissions', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'id inválido' });
    return;
  }
  const data = await AccessProfileModel.getProfilePermissions(id);
  res.json({ data });
});

router.put('/:id/permissions', async (req, res) => {
  const id = Number(req.params.id);
  const permissions = Array.isArray(req.body?.permissions) ? req.body.permissions : [];
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'id inválido' });
    return;
  }
  await AccessProfileModel.replaceProfilePermissions(id, permissions);
  res.json({ message: 'Permissões do perfil atualizadas' });
});

router.get('/users/:userId', async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId)) {
    res.status(400).json({ error: 'userId inválido' });
    return;
  }
  const profiles = await AccessProfileModel.getUserProfiles(userId);
  res.json({ data: profiles });
});

router.put('/users/:userId', async (req, res) => {
  const userId = Number(req.params.userId);
  const profileIds = Array.isArray(req.body?.profileIds) ? req.body.profileIds.map(Number).filter(Number.isInteger) : [];
  if (!Number.isInteger(userId)) {
    res.status(400).json({ error: 'userId inválido' });
    return;
  }
  await AccessProfileModel.setUserProfiles(userId, profileIds, req.user?.id);
  res.json({ message: 'Perfis do usuário atualizados' });
});

export default router;

