import { Request, Response } from 'express';
import { CategoryModel } from '../models/Category';
import { CreateCategoryRequest, UpdateCategoryRequest } from '../types';
import { asyncHandler } from '../../../shared/middleware/errorHandler';
import { createCategorySchema, updateCategorySchema } from '../schemas/category';
import Joi from 'joi';

const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().max(255)
});

export class CategoryController {
  static create = asyncHandler(async (req: Request, res: Response) => {
    console.log('🔍 DEBUG CREATE CATEGORY - Body recebido:', req.body);
    
    const { error, value } = createCategorySchema.validate(req.body);
    if (error) {
      console.log('❌ ERRO DE VALIDAÇÃO:', error.details);
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    console.log('✅ Dados validados:', value);
    const categoryData = value as CreateCategoryRequest;
    const category = await CategoryModel.create(categoryData);
    
    res.status(201).json({
      message: 'Categoria criada com sucesso',
      data: { category }
    });
  });

  static findAll = asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = querySchema.validate(req.query);
    if (error) {
      res.status(400).json({ error: 'Parâmetros inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const params = value;
    const result = await CategoryModel.findAll(params);

    res.json({
      message: 'Categorias obtidas com sucesso',
      data: result
    });
  });

  static findActive = asyncHandler(async (req: Request, res: Response) => {
    const categories = await CategoryModel.findActive();

    res.json({
      message: 'Categorias ativas obtidas com sucesso',
      data: { categories }
    });
  });

  static findById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const categoryId = parseInt(id);

    if (isNaN(categoryId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const category = await CategoryModel.findById(categoryId);
    if (!category) {
      res.status(404).json({ error: 'Categoria não encontrada' });
      return;
    }

    res.json({
      message: 'Categoria obtida com sucesso',
      data: { category }
    });
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const categoryId = parseInt(id);

    if (isNaN(categoryId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const { error, value } = updateCategorySchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const categoryData = value as UpdateCategoryRequest;
    const category = await CategoryModel.update(categoryId, categoryData);
    
    if (!category) {
      res.status(404).json({ error: 'Categoria não encontrada' });
      return;
    }

    res.json({
      message: 'Categoria atualizada com sucesso',
      data: { category }
    });
  });

  static delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const categoryId = parseInt(id);

    if (isNaN(categoryId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    try {
      await CategoryModel.delete(categoryId);
      
      res.json({
        message: 'Categoria excluída com sucesso'
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  static getStats = asyncHandler(async (req: Request, res: Response) => {
    const totalCategories = await CategoryModel.count();
    const activeCategories = await CategoryModel.countActive();
    
    res.json({
      message: 'Estatísticas obtidas com sucesso',
      data: {
        totalCategories,
        activeCategories
      }
    });
  });
}
