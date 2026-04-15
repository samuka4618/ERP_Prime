import { Request, Response } from 'express';
import { FornecedorModel } from '../models/Fornecedor';
import { asyncHandler } from '../../../shared/middleware/errorHandler';
import { log as auditLog } from '../../../core/audit/AuditService';
import { createFornecedorSchema, updateFornecedorSchema, fornecedorQuerySchema } from '../schemas/fornecedor';
import { SatelliteSyncService } from '../services/SatelliteSyncService';

function syncSatelliteFornecedoresCatalog(): void {
  SatelliteSyncService.pushAllPublishedSnapshots().catch((err: any) =>
    console.error(
      'SatelliteSyncService.pushAllPublishedSnapshots (fornecedor):',
      err?.response?.status,
      err?.response?.data ?? err?.message
    )
  );
}

export class FornecedorController {
  static create = asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = createFornecedorSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const fornecedor = await FornecedorModel.create(value);

    syncSatelliteFornecedoresCatalog();

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

    syncSatelliteFornecedoresCatalog();

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
    syncSatelliteFornecedoresCatalog();
    auditLog({
      userId: req.user?.id,
      userName: req.user?.name,
      action: 'fornecedor.delete',
      resource: 'descarregamento',
      resourceId: String(fornecedorId),
      details: fornecedor ? `Fornecedor ${(fornecedor as any).nome || fornecedorId}` : undefined,
      ip: req.ip || (req.headers['x-forwarded-for'] as string) || undefined
    });
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
