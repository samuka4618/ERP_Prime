import { Router } from 'express';
import { CategoryAssignmentController } from '../controllers/CategoryAssignmentController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/auth';
import { UserRole } from '../types';

const router = Router();

// Todas as rotas precisam de autenticação
router.use(authenticate);

// Apenas administradores podem gerenciar atribuições
router.use(authorize(UserRole.ADMIN));

// Criar nova atribuição
router.post('/', CategoryAssignmentController.create);

// Listar todas as atribuições
router.get('/', CategoryAssignmentController.findAll);

// Buscar atribuições por categoria
router.get('/category/:category_id', CategoryAssignmentController.findByCategory);

// Buscar atribuições por técnico
router.get('/attendant/:attendant_id', CategoryAssignmentController.findByAttendant);

// Buscar técnicos disponíveis para uma categoria
router.get('/category/:category_id/available', CategoryAssignmentController.getAvailableAttendants);

// Buscar técnicos atribuídos para uma categoria
router.get('/category/:category_id/assigned', CategoryAssignmentController.getAssignedAttendants);

// Obter resumo das atribuições (para tela de configuração)
router.get('/summary', CategoryAssignmentController.getAssignmentSummary);

// Deletar atribuição por ID
router.delete('/:id', CategoryAssignmentController.delete);

// Deletar atribuição por categoria e técnico
router.delete('/', CategoryAssignmentController.deleteByCategoryAndAttendant);

export default router;
