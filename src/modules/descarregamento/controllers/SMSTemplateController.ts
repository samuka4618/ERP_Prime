import { Request, Response } from 'express';
import { SMSTemplateModel, SMSTemplateType } from '../models/SMSTemplate';
import { asyncHandler } from '../../../shared/middleware/errorHandler';
import { createSMSTemplateSchema, updateSMSTemplateSchema } from '../schemas/smsTemplate';
import { SMSService } from '../services/SMSService';
import Joi from 'joi';

export class SMSTemplateController {
  static create = asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = createSMSTemplateSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const template = await SMSTemplateModel.create(value);

    res.status(201).json({
      message: 'Template SMS criado com sucesso',
      data: { template }
    });
  });

  static findAll = asyncHandler(async (req: Request, res: Response) => {
    const { template_type } = req.query;
    
    const templates = await SMSTemplateModel.findAll(
      template_type ? (template_type as SMSTemplateType) : undefined
    );

    res.json({
      message: 'Templates SMS obtidos com sucesso',
      data: { templates }
    });
  });

  static findById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const templateId = parseInt(id);

    if (isNaN(templateId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const template = await SMSTemplateModel.findById(templateId);
    if (!template) {
      res.status(404).json({ error: 'Template não encontrado' });
      return;
    }

    res.json({
      message: 'Template SMS obtido com sucesso',
      data: { template }
    });
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const templateId = parseInt(id);

    if (isNaN(templateId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const { error, value } = updateSMSTemplateSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const template = await SMSTemplateModel.update(templateId, value);
    if (!template) {
      res.status(404).json({ error: 'Template não encontrado' });
      return;
    }

    res.json({
      message: 'Template SMS atualizado com sucesso',
      data: { template }
    });
  });

  static delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const templateId = parseInt(id);

    if (isNaN(templateId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const deleted = await SMSTemplateModel.delete(templateId);
    if (!deleted) {
      res.status(404).json({ error: 'Template não encontrado' });
      return;
    }

    res.json({
      message: 'Template SMS excluído com sucesso'
    });
  });

  static test = asyncHandler(async (req: Request, res: Response) => {
    const { template_id, phone_number } = req.body;

    if (!template_id || !phone_number) {
      res.status(400).json({ error: 'template_id e phone_number são obrigatórios' });
      return;
    }

    const template = await SMSTemplateModel.findById(template_id);
    if (!template) {
      res.status(404).json({ error: 'Template não encontrado' });
      return;
    }

    // Preparar variáveis de exemplo para o teste
    const variables: Record<string, string | number> = {
      driver_name: 'Motorista Teste',
      fornecedor_name: 'Fornecedor Teste',
      scheduled_date: new Date().toLocaleDateString('pt-BR'),
      scheduled_time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      dock: 'Doca 01',
      tracking_code: 'TEST-12345'
    };

    // Substituir variáveis no template
    const message = await SMSTemplateModel.replaceVariables(template.message, variables);

    // Enviar SMS de teste
    const sent = await SMSService.sendSMS({
      to: phone_number,
      message
    });

    if (sent) {
      res.json({
        message: 'SMS de teste enviado com sucesso',
        data: {
          phone_number,
          message_sent: message
        }
      });
    } else {
      res.status(500).json({
        error: 'Erro ao enviar SMS de teste. Verifique as configurações da API Vonage.'
      });
    }
  });
}
