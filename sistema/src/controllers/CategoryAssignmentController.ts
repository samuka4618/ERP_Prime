import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { CategoryAssignmentModel } from '../models/CategoryAssignment';
import { CategoryModel } from '../models/Category';
import { UserModel } from '../models/User';
import { UserRole } from '../types';
import Joi from 'joi';

// Schema de validação para criar atribuição
const createAssignmentSchema = Joi.object({
  category_id: Joi.number().integer().positive().required(),
  attendant_id: Joi.number().integer().positive().required()
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

    // Organizar dados para o frontend
    const summary = categories.map(category => {
      const categoryAssignments = assignments.filter(a => a.category_id === category.id);
      const assignedAttendants = categoryAssignments.map(a => ({
        id: a.attendant_id,
        name: a.attendant_name || 'Técnico não encontrado'
      }));

      return {
        category: {
          id: category.id,
          name: category.name,
          description: category.description
        },
        assigned_attendants: assignedAttendants,
        available_attendants: attendants.filter(attendant => 
          !assignedAttendants.some(assigned => assigned.id === attendant.id)
        ).map(attendant => ({
          id: attendant.id,
          name: attendant.name
        }))
      };
    });

    return res.json({
      message: 'Resumo das atribuições obtido com sucesso',
      data: {
        categories: summary,
        all_attendants: attendants.map(attendant => ({
          id: attendant.id,
          name: attendant.name,
          email: attendant.email
        }))
      }
    });
  });
}
