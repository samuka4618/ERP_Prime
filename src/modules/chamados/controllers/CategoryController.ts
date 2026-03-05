import { Request, Response } from 'express';
import { CategoryModel } from '../models/Category';
import { CreateCategoryRequest, UpdateCategoryRequest } from '../types';
import { asyncHandler } from '../../../shared/middleware/errorHandler';
import { createCategorySchema, updateCategorySchema } from '../schemas/category';
import Joi from 'joi';
import {
  CATEGORY_IMPORT_EXPORT,
  toExportRow,
  validateCategoryRow,
  parseCategoriesJson,
  ValidatedCategoryRow,
  InvalidCategoryRow
} from '../categoryImportExport';
import { log as auditLog } from '../../../core/audit/AuditService';
import { dbRun } from '../../../core/database/connection';
import { config } from '../../../config/database';

const getIp = (req: Request) => req.ip || (req.headers['x-forwarded-for'] as string) || undefined;
const useTransaction = !config.database.usePostgres;

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

  /** Exportar categorias (JSON com SLA, perguntas personalizadas e configurações). */
  static exportCategories = asyncHandler(async (req: Request, res: Response) => {
    const categories = await CategoryModel.findAllForExport(CATEGORY_IMPORT_EXPORT.MAX_CATEGORIES);
    const rows = categories.map((c) => toExportRow(c));

    auditLog({
      userId: req.user?.id,
      userName: req.user?.name,
      action: 'categories.export',
      resource: 'categories',
      details: `Exportação de ${rows.length} categoria(s)`,
      ip: getIp(req)
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="categorias-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(rows);
  });

  /** Pré-visualizar importação de categorias (não altera o banco). */
  static importPreview = asyncHandler(async (req: Request, res: Response) => {
    const file = (req as any).file;
    if (!file || !file.buffer) {
      res.status(400).json({ error: 'Envie um arquivo JSON (campo: file)' });
      return;
    }
    if (file.size > CATEGORY_IMPORT_EXPORT.MAX_FILE_BYTES) {
      res.status(400).json({
        error: `Arquivo excede o limite de ${CATEGORY_IMPORT_EXPORT.MAX_FILE_BYTES / 1024 / 1024} MB`
      });
      return;
    }

    const content = file.buffer.toString('utf-8');
    let rawRows: Record<string, unknown>[];
    try {
      rawRows = parseCategoriesJson(content);
    } catch (_) {
      res.status(400).json({ error: 'Arquivo JSON inválido. Esperado: array de categorias ou objeto com propriedade "categories".' });
      return;
    }

    if (rawRows.length > CATEGORY_IMPORT_EXPORT.MAX_CATEGORIES) {
      res.status(400).json({
        error: `Arquivo tem ${rawRows.length} categorias. Máximo permitido: ${CATEGORY_IMPORT_EXPORT.MAX_CATEGORIES}`
      });
      return;
    }

    const valid: ValidatedCategoryRow[] = [];
    const invalid: InvalidCategoryRow[] = [];
    rawRows.forEach((row, i) => {
      const result = validateCategoryRow(row, i + 1);
      if ('valid' in result) valid.push(result.valid);
      else invalid.push(result.invalid);
    });

    res.json({
      message: 'Pré-visualização concluída',
      data: {
        total: rawRows.length,
        valid: valid.length,
        invalid: invalid.length,
        validRows: valid,
        invalidRows: invalid
      }
    });
  });

  /** Importar categorias. Atribuições ficam a cargo do usuário após a importação. Se updateExisting=true, atualiza categorias existentes (por nome). */
  static importCategories = asyncHandler(async (req: Request, res: Response) => {
    const file = (req as any).file;
    const updateExisting = String((req.body as any).updateExisting || '').toLowerCase() === 'true' || (req.body as any).updateExisting === true;

    if (!file || !file.buffer) {
      res.status(400).json({ error: 'Envie um arquivo JSON (campo: file)' });
      return;
    }
    if (file.size > CATEGORY_IMPORT_EXPORT.MAX_FILE_BYTES) {
      res.status(400).json({
        error: `Arquivo excede o limite de ${CATEGORY_IMPORT_EXPORT.MAX_FILE_BYTES / 1024 / 1024} MB`
      });
      return;
    }

    const content = file.buffer.toString('utf-8');
    let rawRows: Record<string, unknown>[];
    try {
      rawRows = parseCategoriesJson(content);
    } catch (_) {
      res.status(400).json({ error: 'Arquivo JSON inválido.' });
      return;
    }

    if (rawRows.length > CATEGORY_IMPORT_EXPORT.MAX_CATEGORIES) {
      res.status(400).json({
        error: `Arquivo tem ${rawRows.length} categorias. Máximo: ${CATEGORY_IMPORT_EXPORT.MAX_CATEGORIES}`
      });
      return;
    }

    const valid: ValidatedCategoryRow[] = [];
    const invalid: InvalidCategoryRow[] = [];
    rawRows.forEach((row, i) => {
      const result = validateCategoryRow(row, i + 1);
      if ('valid' in result) valid.push(result.valid);
      else invalid.push(result.invalid);
    });

    let created = 0;
    let updated = 0;
    let skipped = 0;

    if (useTransaction) await dbRun('BEGIN');
    try {
      for (const row of valid) {
        const existing = await CategoryModel.findByName(row.data.name);
        if (existing) {
          if (updateExisting) {
            await CategoryModel.update(existing.id, {
              description: row.data.description,
              sla_first_response_hours: row.data.sla_first_response_hours,
              sla_resolution_hours: row.data.sla_resolution_hours,
              is_active: row.data.is_active,
              custom_fields: row.data.custom_fields
            });
            updated++;
          } else {
            skipped++;
          }
        } else {
          const createData: CreateCategoryRequest = {
            name: row.data.name,
            description: row.data.description,
            sla_first_response_hours: row.data.sla_first_response_hours,
            sla_resolution_hours: row.data.sla_resolution_hours,
            is_active: row.data.is_active,
            custom_fields: row.data.custom_fields
          };
          await CategoryModel.create(createData);
          created++;
        }
      }
      if (useTransaction) await dbRun('COMMIT');
    } catch (err: any) {
      if (useTransaction) await dbRun('ROLLBACK').catch(() => {});
      throw err;
    }

    auditLog({
      userId: req.user?.id,
      userName: req.user?.name,
      action: 'categories.import',
      resource: 'categories',
      details: `Importação: ${created} criada(s), ${updated} atualizada(s), ${skipped} ignorada(s) (já existem), ${invalid.length} inválida(s). updateExisting=${updateExisting}`,
      ip: getIp(req)
    });

    res.status(201).json({
      message: 'Importação concluída',
      data: {
        created,
        updated,
        skipped,
        invalidCount: invalid.length,
        invalidRows: invalid
      }
    });
  });
}
