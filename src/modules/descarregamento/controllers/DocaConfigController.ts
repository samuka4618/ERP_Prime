import { Request, Response } from 'express';
import { DocaConfigModel } from '../models/DocaConfig';
import { asyncHandler } from '../../../shared/middleware/errorHandler';
import { validate, validateParams } from '../../../shared/middleware/validation';
import Joi from 'joi';

const createDocaSchema = Joi.object({
  numero: Joi.string().required().min(1).max(10),
  nome: Joi.string().optional().max(255).allow(null, ''),
  is_active: Joi.boolean().optional()
});

const updateDocaSchema = Joi.object({
  numero: Joi.string().optional().min(1).max(10),
  nome: Joi.string().optional().max(255).allow(null, ''),
  is_active: Joi.boolean().optional()
});

export class DocaConfigController {
  static create = asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = createDocaSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const doca = await DocaConfigModel.create(value);

    res.status(201).json({
      message: 'Doca criada com sucesso',
      data: { doca }
    });
  });

  static findAll = asyncHandler(async (req: Request, res: Response) => {
    const activeOnly = req.query.activeOnly === 'true';
    const docas = await DocaConfigModel.findAll(activeOnly);

    res.json({
      message: 'Docas obtidas com sucesso',
      data: { docas }
    });
  });

  static findById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const docaId = parseInt(id);

    if (isNaN(docaId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const doca = await DocaConfigModel.findById(docaId);
    if (!doca) {
      res.status(404).json({ error: 'Doca não encontrada' });
      return;
    }

    res.json({
      message: 'Doca obtida com sucesso',
      data: { doca }
    });
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const docaId = parseInt(id);

    if (isNaN(docaId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const { error, value } = updateDocaSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const doca = await DocaConfigModel.update(docaId, value);
    if (!doca) {
      res.status(404).json({ error: 'Doca não encontrada' });
      return;
    }

    res.json({
      message: 'Doca atualizada com sucesso',
      data: { doca }
    });
  });

  static delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const docaId = parseInt(id);

    if (isNaN(docaId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const doca = await DocaConfigModel.findById(docaId);
    if (!doca) {
      res.status(404).json({ error: 'Doca não encontrada' });
      return;
    }

    await DocaConfigModel.delete(docaId);

    res.json({
      message: 'Doca excluída com sucesso'
    });
  });
}
