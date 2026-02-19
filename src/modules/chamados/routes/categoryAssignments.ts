import { Router } from 'express';
import { CategoryAssignmentController } from '../controllers/CategoryAssignmentController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/auth';
import { UserRole } from '../types';
import { requirePermission } from '../../../core/permissions/middleware';

const router = Router();

// Todas as rotas precisam de autenticação
router.use(authenticate);

// Apenas administradores podem gerenciar atribuições
router.use(authorize(UserRole.ADMIN));

// Criar nova atribuição
router.post('/', requirePermission('tickets.assignments.manage'), CategoryAssignmentController.create);

// Listar todas as atribuições
router.get('/', requirePermission('tickets.assignments.manage'), CategoryAssignmentController.findAll);

// Buscar atribuições por categoria
router.get('/category/:category_id', requirePermission('tickets.assignments.manage'), CategoryAssignmentController.findByCategory);

// Buscar atribuições por técnico
router.get('/attendant/:attendant_id', requirePermission('tickets.assignments.manage'), CategoryAssignmentController.findByAttendant);

// Buscar técnicos disponíveis para uma categoria
router.get('/category/:category_id/available', requirePermission('tickets.assignments.manage'), CategoryAssignmentController.getAvailableAttendants);

// Buscar técnicos atribuídos para uma categoria
router.get('/category/:category_id/assigned', requirePermission('tickets.assignments.manage'), CategoryAssignmentController.getAssignedAttendants);

// Obter resumo das atribuições (para tela de configuração)
router.get('/summary', requirePermission('tickets.assignments.manage'), CategoryAssignmentController.getAssignmentSummary);

// Deletar atribuição por ID
router.delete('/:id', requirePermission('tickets.assignments.manage'), CategoryAssignmentController.delete);

// Deletar atribuição por categoria e técnico
router.delete('/', requirePermission('tickets.assignments.manage'), CategoryAssignmentController.deleteByCategoryAndAttendant);

export default router;
