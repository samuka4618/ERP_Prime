import { Request, Response } from 'express';
import { asyncHandler } from '../../../shared/middleware/errorHandler';
import { CategoryAssignmentModel } from '../models/CategoryAssignment';
import { CategoryAssignmentRuleModel } from '../models/CategoryAssignmentRule';
import { CategoryModel } from '../models/Category';
import { UserModel } from '../../../core/users/User';
import { UserRole } from '../types';
import Joi from 'joi';

const RULE_OPERATORS = ['equals', 'not_equals', 'contains', 'gt', 'gte', 'lt', 'lte'] as const;

// Schema de validação para criar atribuição
const createAssignmentSchema = Joi.object({
  category_id: Joi.number().integer().positive().required(),
  attendant_id: Joi.number().integer().positive().required()
}).strict();

// Schema para criar/atualizar regra de atribuição por resposta
const createRuleSchema = Joi.object({
  field_name: Joi.string().min(1).max(100).required(),
  operator: Joi.string().valid(...RULE_OPERATORS).required(),
  value: Joi.string().max(500).required(),
  attendant_id: Joi.number().integer().positive().required(),
  priority: Joi.number().integer().min(0).optional()
}).strict();

// Schema de validação para buscar atribuições por categoria
const getByCategorySchema = Joi.object({
  category_id: Joi.number().integer().positive().required()
});

// Schema de validação para buscar atribuições por técnico
const getByAttendantSchema = Joi.object({
  attendant_id: Joi.number().integer().positive().required()
});

export class CategoryAssignmentController {
  // Criar nova atribuição
  static create = asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = createAssignmentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { category_id, attendant_id } = value;

    // Verificar se a categoria existe
    const category = await CategoryModel.findById(category_id);
    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }

    // Verificar se o técnico existe e é um attendant
    const attendant = await UserModel.findById(attendant_id);
    if (!attendant || attendant.role !== 'attendant') {
      return res.status(404).json({ error: 'Técnico não encontrado ou não é um attendant' });
    }

    // Verificar se a atribuição já existe
    const exists = await CategoryAssignmentModel.exists(category_id, attendant_id);
    if (exists) {
      return res.status(400).json({ error: 'Esta atribuição já existe' });
    }

    const assignment = await CategoryAssignmentModel.create(category_id, attendant_id);

    return res.status(201).json({
      message: 'Atribuição criada com sucesso',
      data: assignment
    });
  });

  // Listar todas as atribuições
  static findAll = asyncHandler(async (req: Request, res: Response) => {
    const assignments = await CategoryAssignmentModel.findAll();

    return res.json({
      message: 'Atribuições obtidas com sucesso',
      data: assignments
    });
  });

  // Buscar atribuições por categoria
  static findByCategory = asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = getByCategorySchema.validate(req.params);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { category_id } = value;
    const assignments = await CategoryAssignmentModel.findByCategory(category_id);

    return res.json({
      message: 'Atribuições da categoria obtidas com sucesso',
      data: assignments
    });
  });

  // Buscar atribuições por técnico
  static findByAttendant = asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = getByAttendantSchema.validate(req.params);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { attendant_id } = value;
    const assignments = await CategoryAssignmentModel.findByAttendant(attendant_id);

    return res.json({
      message: 'Atribuições do técnico obtidas com sucesso',
      data: assignments
    });
  });

  // Buscar técnicos disponíveis para uma categoria
  static getAvailableAttendants = asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = getByCategorySchema.validate(req.params);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { category_id } = value;
    const attendants = await CategoryAssignmentModel.getAvailableAttendantsForCategory(category_id);

    return res.json({
      message: 'Técnicos disponíveis obtidos com sucesso',
      data: attendants
    });
  });

  // Buscar técnicos atribuídos para uma categoria
  static getAssignedAttendants = asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = getByCategorySchema.validate(req.params);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { category_id } = value;
    const attendants = await CategoryAssignmentModel.getAssignedAttendantsForCategory(category_id);

    return res.json({
      message: 'Técnicos atribuídos obtidos com sucesso',
      data: attendants
    });
  });

  // Deletar atribuição
  static delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const assignment = await CategoryAssignmentModel.findById(Number(id));
    if (!assignment) {
      return res.status(404).json({ error: 'Atribuição não encontrada' });
    }

    await CategoryAssignmentModel.delete(Number(id));

    return res.json({
      message: 'Atribuição removida com sucesso'
    });
  });

  // Deletar atribuição por categoria e técnico
  static deleteByCategoryAndAttendant = asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = createAssignmentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { category_id, attendant_id } = value;

    const exists = await CategoryAssignmentModel.exists(category_id, attendant_id);
    if (!exists) {
      return res.status(404).json({ error: 'Atribuição não encontrada' });
    }

    await CategoryAssignmentModel.deleteByCategoryAndAttendant(category_id, attendant_id);

    return res.json({
      message: 'Atribuição removida com sucesso'
    });
  });

  // Obter resumo das atribuições (para tela de configuração)
  static getAssignmentSummary = asyncHandler(async (req: Request, res: Response) => {
    // Buscar todas as categorias
    const categoriesResponse = await CategoryModel.findAll({ page: 1, limit: 100, search: '' });
    const categories = categoriesResponse.data;
    
    // Buscar todos os técnicos
    const attendants = await UserModel.findByRole(UserRole.ATTENDANT, 100, 0);
    
    // Buscar todas as atribuições
    const assignments = await CategoryAssignmentModel.findAll();

    // Buscar regras de atribuição por resposta para todas as categorias
    const allRules = await Promise.all(
      categories.map((c: any) => CategoryAssignmentRuleModel.findByCategory(c.id))
    );

    // Organizar dados para o frontend
    const summary = categories.map((category: any, index: number) => {
      const categoryAssignments = assignments.filter(a => a.category_id === category.id);
      const assignedAttendants = categoryAssignments.map(a => ({
        id: a.attendant_id,
        name: a.attendant_name || 'Técnico não encontrado'
      }));

      return {
        category: {
          id: category.id,
          name: category.name,
          description: category.description,
          custom_fields: category.custom_fields || []
        },
        assigned_attendants: assignedAttendants,
        available_attendants: attendants.filter((attendant: any) => 
          !assignedAttendants.some(assigned => assigned.id === attendant.id)
        ).map((attendant: any) => ({
          id: attendant.id,
          name: attendant.name
        })),
        assignment_rules: (allRules[index] || []).map(r => ({
          id: r.id,
          field_name: r.field_name,
          operator: r.operator,
          value: r.value,
          attendant_id: r.attendant_id,
          attendant_name: r.attendant_name,
          priority: r.priority
        }))
      };
    });

    return res.json({
      message: 'Resumo das atribuições obtido com sucesso',
      data: {
        categories: summary,
        all_attendants: attendants.map((attendant: any) => ({
          id: attendant.id,
          name: attendant.name,
          email: attendant.email
        }))
      }
    });
  });

  // --- Regras de atribuição por resposta ---

  static getAssignmentRules = asyncHandler(async (req: Request, res: Response) => {
    const { category_id } = req.params;
    const categoryId = parseInt(category_id);
    if (isNaN(categoryId)) {
      return res.status(400).json({ error: 'ID da categoria inválido' });
    }
    const rules = await CategoryAssignmentRuleModel.findByCategory(categoryId);
    return res.json({
      message: 'Regras obtidas com sucesso',
      data: rules
    });
  });

  static createAssignmentRule = asyncHandler(async (req: Request, res: Response) => {
    const { category_id } = req.params;
    const categoryId = parseInt(category_id);
    if (isNaN(categoryId)) {
      return res.status(400).json({ error: 'ID da categoria inválido' });
    }

    const { error, value } = createRuleSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const category = await CategoryModel.findById(categoryId);
    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }

    const attendant = await UserModel.findById(value.attendant_id);
    if (!attendant || attendant.role !== 'attendant') {
      return res.status(400).json({ error: 'Técnico não encontrado ou não é atendente' });
    }

    const rule = await CategoryAssignmentRuleModel.create(categoryId, value);
    return res.status(201).json({
      message: 'Regra de atribuição criada com sucesso',
      data: rule
    });
  });

  static updateAssignmentRule = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const ruleId = parseInt(id);
    if (isNaN(ruleId)) {
      return res.status(400).json({ error: 'ID da regra inválido' });
    }

    const updateRuleSchema = Joi.object({
      field_name: Joi.string().min(1).max(100).optional(),
      operator: Joi.string().valid(...RULE_OPERATORS).optional(),
      value: Joi.string().max(500).optional(),
      attendant_id: Joi.number().integer().positive().optional(),
      priority: Joi.number().integer().min(0).optional()
    }).min(1);
    const { error, value } = updateRuleSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const rule = await CategoryAssignmentRuleModel.update(ruleId, value);
    if (!rule) {
      return res.status(404).json({ error: 'Regra não encontrada' });
    }
    return res.json({
      message: 'Regra atualizada com sucesso',
      data: rule
    });
  });

  static deleteAssignmentRule = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const ruleId = parseInt(id);
    if (isNaN(ruleId)) {
      return res.status(400).json({ error: 'ID da regra inválido' });
    }
    const rule = await CategoryAssignmentRuleModel.findById(ruleId);
    if (!rule) {
      return res.status(404).json({ error: 'Regra não encontrada' });
    }
    await CategoryAssignmentRuleModel.delete(ruleId);
    return res.json({ message: 'Regra removida com sucesso' });
  });
}
