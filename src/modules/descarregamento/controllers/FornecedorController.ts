import { Request, Response } from 'express';
import { FornecedorModel } from '../models/Fornecedor';
import { asyncHandler } from '../../../shared/middleware/errorHandler';
import { createFornecedorSchema, updateFornecedorSchema, fornecedorQuerySchema } from '../schemas/fornecedor';

export class FornecedorController {
  static create = asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = createFornecedorSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const fornecedor = await FornecedorModel.create(value);

    res.status(201).json({
      message: 'Fornecedor criado com sucesso',
      data: { fornecedor }
    });
  });

  static findAll = asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = fornecedorQuerySchema.validate(req.query);
    if (error) {
      res.status(400).json({ error: 'Parâmetros inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const result = await FornecedorModel.findAll(value);

    res.json({
      message: 'Fornecedores obtidos com sucesso',
      data: result
    });
  });

  static findById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const fornecedorId = parseInt(id);

    if (isNaN(fornecedorId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const fornecedor = await FornecedorModel.findById(fornecedorId);
    if (!fornecedor) {
      res.status(404).json({ error: 'Fornecedor não encontrado' });
      return;
    }

    res.json({
      message: 'Fornecedor obtido com sucesso',
      data: { fornecedor }
    });
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const fornecedorId = parseInt(id);

    if (isNaN(fornecedorId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const { error, value } = updateFornecedorSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const fornecedor = await FornecedorModel.update(fornecedorId, value);
    if (!fornecedor) {
      res.status(404).json({ error: 'Fornecedor não encontrado' });
      return;
    }

    res.json({
      message: 'Fornecedor atualizado com sucesso',
      data: { fornecedor }
    });
  });

  static delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const fornecedorId = parseInt(id);

    if (isNaN(fornecedorId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const fornecedor = await FornecedorModel.findById(fornecedorId);
    if (!fornecedor) {
      res.status(404).json({ error: 'Fornecedor não encontrado' });
      return;
    }

    await FornecedorModel.delete(fornecedorId);

    res.json({
      message: 'Fornecedor excluído com sucesso'
    });
  });

  static getCategories = asyncHandler(async (req: Request, res: Response) => {
    const categories = await FornecedorModel.getCategories();

    res.json({
      message: 'Categorias obtidas com sucesso',
      data: { categories }
    });
  });
}
