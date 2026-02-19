import { Request, Response } from 'express';
import { CompradorModel } from '../models/Comprador';
import { asyncHandler } from '../../../shared/middleware/errorHandler';
import { createCompradorSchema, updateCompradorSchema } from '../schemas/comprador';
import Joi from 'joi';

export class CompradorController {
  static create = asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = createCompradorSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const comprador = await CompradorModel.create(value);

    res.status(201).json({
      message: 'Comprador criado com sucesso',
      data: { comprador }
    });
  });

  static findAll = asyncHandler(async (req: Request, res: Response) => {
    const compradores = await CompradorModel.findAll();

    res.json({
      message: 'Compradores obtidos com sucesso',
      data: { compradores }
    });
  });

  static findById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const compradorId = parseInt(id);

    if (isNaN(compradorId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const comprador = await CompradorModel.findById(compradorId);
    if (!comprador) {
      res.status(404).json({ error: 'Comprador não encontrado' });
      return;
    }

    res.json({
      message: 'Comprador obtido com sucesso',
      data: { comprador }
    });
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const compradorId = parseInt(id);

    if (isNaN(compradorId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const { error, value } = updateCompradorSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const updated = await CompradorModel.update(compradorId, value);

    res.json({
      message: 'Comprador atualizado com sucesso',
      data: { comprador: updated }
    });
  });

  static delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const compradorId = parseInt(id);

    if (isNaN(compradorId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    await CompradorModel.delete(compradorId);

    res.json({
      message: 'Comprador excluído com sucesso'
    });
  });
}

