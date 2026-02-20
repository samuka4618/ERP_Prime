import { Request, Response } from 'express';
import { FormularioModel } from '../models/Formulario';
import { asyncHandler } from '../../../shared/middleware/errorHandler';
import { QRCodeService } from '../services/QRCodeService';
import { NgrokService } from '../services/NgrokService';
import Joi from 'joi';

const formFieldSchema = Joi.object({
  id: Joi.string().required(),
  type: Joi.string().valid('text', 'textarea', 'number', 'date', 'time', 'select', 'radio', 'checkbox').required(),
  label: Joi.string().required(),
  name: Joi.string().required(),
  required: Joi.boolean().optional(),
  placeholder: Joi.string().optional().allow(''),
  options: Joi.array().items(Joi.string()).optional(),
  min: Joi.number().optional(),
  max: Joi.number().optional(),
  default: Joi.any().optional()
});

const createFormularioSchema = Joi.object({
  title: Joi.string().required().min(1).max(255),
  description: Joi.string().optional().allow(null, ''),
  fields: Joi.array().items(formFieldSchema).required(), // Campos dinâmicos são opcionais - o formulário já tem os campos principais
  is_published: Joi.boolean().optional(),
  is_default: Joi.boolean().optional()
});

const updateFormularioSchema = Joi.object({
  title: Joi.string().optional().min(1).max(255),
  description: Joi.string().optional().allow(null, ''),
  fields: Joi.array().items(formFieldSchema).optional(),
  is_published: Joi.boolean().optional(),
  is_default: Joi.boolean().optional()
});

export class FormularioController {
  static create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }

    const { error, value } = createFormularioSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const formulario = await FormularioModel.create(userId, value);

    // Se estiver publicado, incluir URL pública
    const publicUrl = formulario.is_published ? await QRCodeService.getPublicFormUrl(formulario.id) : null;

    res.status(201).json({
      message: 'Formulário criado com sucesso',
      data: { 
        formulario,
        public_url: publicUrl
      }
    });
  });

  static findAll = asyncHandler(async (req: Request, res: Response) => {
    const formularios = await FormularioModel.findAll();

    // Adicionar URLs públicas para formulários publicados
    const formulariosComUrls = await Promise.all(
      formularios.map(async (form) => ({
        ...form,
        public_url: form.is_published ? await QRCodeService.getPublicFormUrl(form.id) : null
      }))
    );

    res.json({
      message: 'Formulários obtidos com sucesso',
      data: { formularios: formulariosComUrls }
    });
  });

  static findPublished = asyncHandler(async (req: Request, res: Response) => {
    const formularios = await FormularioModel.findPublished();

    res.json({
      message: 'Formulários públicos obtidos com sucesso',
      data: { formularios }
    });
  });

  static findDefault = asyncHandler(async (req: Request, res: Response) => {
    const formulario = await FormularioModel.findDefault();

    if (!formulario) {
      res.status(404).json({ error: 'Nenhum formulário padrão encontrado' });
      return;
    }

    res.json({
      message: 'Formulário padrão obtido com sucesso',
      data: { formulario }
    });
  });

  static findPublicById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const formularioId = parseInt(id);

    if (isNaN(formularioId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const formulario = await FormularioModel.findById(formularioId);
    if (!formulario) {
      res.status(404).json({ error: 'Formulário não encontrado' });
      return;
    }

    // Só retornar se estiver publicado
    if (!formulario.is_published) {
      res.status(404).json({ error: 'Formulário não encontrado' });
      return;
    }

    res.json({
      message: 'Formulário obtido com sucesso',
      data: { formulario }
    });
  });

  static findById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const formularioId = parseInt(id);

    if (isNaN(formularioId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const formulario = await FormularioModel.findById(formularioId);
    if (!formulario) {
      res.status(404).json({ error: 'Formulário não encontrado' });
      return;
    }

    res.json({
      message: 'Formulário obtido com sucesso',
      data: { formulario }
    });
  });

  /** Regenera o link público (limpa cache do ngrok e obtém a URL atual). Útil quando o ngrok reinicia e a URL muda. */
  static regeneratePublicUrl = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const formularioId = parseInt(id);

    if (isNaN(formularioId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const formulario = await FormularioModel.findById(formularioId);
    if (!formulario) {
      res.status(404).json({ error: 'Formulário não encontrado' });
      return;
    }

    if (!formulario.is_published) {
      res.status(400).json({ error: 'Só é possível regenerar o link de formulários publicados' });
      return;
    }

    NgrokService.clearCache();
    const publicUrl = await QRCodeService.getPublicFormUrl(formularioId);

    res.json({
      message: 'Link regenerado com sucesso',
      data: { public_url: publicUrl }
    });
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const formularioId = parseInt(id);

    if (isNaN(formularioId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const { error, value } = updateFormularioSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const formulario = await FormularioModel.update(formularioId, value);
    if (!formulario) {
      res.status(404).json({ error: 'Formulário não encontrado' });
      return;
    }

    // Se estiver publicado, incluir URL pública
    const publicUrl = formulario.is_published ? await QRCodeService.getPublicFormUrl(formulario.id) : null;

    res.json({
      message: 'Formulário atualizado com sucesso',
      data: { 
        formulario,
        public_url: publicUrl
      }
    });
  });

  static delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const formularioId = parseInt(id);

    if (isNaN(formularioId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const formulario = await FormularioModel.findById(formularioId);
    if (!formulario) {
      res.status(404).json({ error: 'Formulário não encontrado' });
      return;
    }

    await FormularioModel.delete(formularioId);

    res.json({
      message: 'Formulário excluído com sucesso'
    });
  });
}
