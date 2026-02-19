import { Request, Response } from 'express';
import { AprovadorModel } from '../models/Aprovador';
import { asyncHandler } from '../../../shared/middleware/errorHandler';
import { createAprovadorSchema, updateAprovadorSchema } from '../schemas/aprovador';
import Joi from 'joi';

export class AprovadorController {
  static create = asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = createAprovadorSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const aprovador = await AprovadorModel.create(value);

    res.status(201).json({
      message: 'Aprovador criado com sucesso',
      data: { aprovador }
    });
  });

  static findAll = asyncHandler(async (req: Request, res: Response) => {
    const aprovadores = await AprovadorModel.findAll();

    res.json({
      message: 'Aprovadores obtidos com sucesso',
      data: { aprovadores }
    });
  });

  static findById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const aprovadorId = parseInt(id);

    if (isNaN(aprovadorId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const aprovador = await AprovadorModel.findById(aprovadorId);
    if (!aprovador) {
      res.status(404).json({ error: 'Aprovador não encontrado' });
      return;
    }

    res.json({
      message: 'Aprovador obtido com sucesso',
      data: { aprovador }
    });
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const aprovadorId = parseInt(id);

    if (isNaN(aprovadorId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const { error, value } = updateAprovadorSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const updated = await AprovadorModel.update(aprovadorId, value);

    res.json({
      message: 'Aprovador atualizado com sucesso',
      data: { aprovador: updated }
    });
  });

  static delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const aprovadorId = parseInt(id);

    if (isNaN(aprovadorId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    await AprovadorModel.delete(aprovadorId);

    res.json({
      message: 'Aprovador excluído com sucesso'
    });
  });
}

