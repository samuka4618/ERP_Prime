import { Request, Response } from 'express';
import { asyncHandler } from '../../../shared/middleware/errorHandler';
import { TicketCategoryApproverModel } from '../models/TicketCategoryApprover';
import Joi from 'joi';

const paramsCategory = Joi.object({
  categoryId: Joi.number().integer().positive().required()
});

const paramsApprover = Joi.object({
  id: Joi.number().integer().positive().required()
});

const createSchema = Joi.object({
  user_id: Joi.number().integer().positive().required(),
  valor_minimo: Joi.number().min(0).optional(),
  valor_maximo: Joi.number().min(0).optional(),
  priority: Joi.number().integer().min(0).optional(),
  is_active: Joi.boolean().optional()
});

const updateSchema = Joi.object({
  user_id: Joi.number().integer().positive().optional(),
  valor_minimo: Joi.number().min(0).optional(),
  valor_maximo: Joi.number().min(0).optional(),
  priority: Joi.number().integer().min(0).optional(),
  is_active: Joi.boolean().optional()
})
  .min(1)
  .messages({ 'object.min': 'Informe ao menos um campo' });

export class CategoryApproverController {
  static listByCategory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { error, value } = paramsCategory.validate({ categoryId: parseInt(req.params.categoryId, 10) });
    if (error) {
      res.status(400).json({ error: 'Categoria inválida' });
      return;
    }
    const rows = await TicketCategoryApproverModel.findByCategory(value.categoryId);
    res.json({ data: rows });
  });

  static create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { error: pe } = paramsCategory.validate({ categoryId: parseInt(req.params.categoryId, 10) });
    if (pe) {
      res.status(400).json({ error: 'Categoria inválida' });
      return;
    }
    const categoryId = parseInt(req.params.categoryId, 10);
    const { error, value } = createSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0]?.message || 'Dados inválidos' });
      return;
    }
    const row = await TicketCategoryApproverModel.create(categoryId, value);
    res.status(201).json({ data: row });
  });

  static update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { error: pe } = paramsApprover.validate({ id: parseInt(req.params.id, 10) });
    if (pe) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }
    const id = parseInt(req.params.id, 10);
    const { error, value } = updateSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0]?.message || 'Dados inválidos' });
      return;
    }
    const row = await TicketCategoryApproverModel.update(id, value);
    if (!row) {
      res.status(404).json({ error: 'Registro não encontrado' });
      return;
    }
    res.json({ data: row });
  });

  static remove = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }
    await TicketCategoryApproverModel.delete(id);
    res.json({ message: 'Removido' });
  });
}
