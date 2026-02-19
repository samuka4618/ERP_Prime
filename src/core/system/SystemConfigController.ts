import { Request, Response } from 'express';
import { SystemConfigService } from './SystemConfigService';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import Joi from 'joi';

const updateConfigSchema = Joi.object({
  key: Joi.string().required(),
  value: Joi.string().required(),
  description: Joi.string().optional()
});

export class SystemConfigController {
  /**
   * Lista todas as configurações
   */
  static getAll = asyncHandler(async (req: Request, res: Response) => {
    const configs = await SystemConfigService.getAll();

    res.json({
      message: 'Configurações obtidas com sucesso',
      data: { configs }
    });
  });

  /**
   * Busca uma configuração específica
   */
  static get = asyncHandler(async (req: Request, res: Response) => {
    const { key } = req.params;
    
    if (!key) {
      res.status(400).json({ error: 'Chave da configuração é obrigatória' });
      return;
    }

    const value = await SystemConfigService.get(key);
    
    if (value === null) {
      res.status(404).json({ error: 'Configuração não encontrada' });
      return;
    }

    res.json({
      message: 'Configuração obtida com sucesso',
      data: { key, value }
    });
  });

  /**
   * Atualiza uma configuração
   */
  static update = asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = updateConfigSchema.validate(req.body);
    
    if (error) {
      res.status(400).json({ 
        error: 'Dados inválidos', 
        details: error.details.map(d => d.message) 
      });
      return;
    }

    const { key, value: configValue, description } = value;
    
    const success = await SystemConfigService.set(key, configValue, description);
    
    if (!success) {
      res.status(500).json({ error: 'Erro ao atualizar configuração' });
      return;
    }

    res.json({
      message: 'Configuração atualizada com sucesso',
      data: { key, value: configValue, description }
    });
  });

  /**
   * Atualiza múltiplas configurações
   */
  static updateMultiple = asyncHandler(async (req: Request, res: Response) => {
    const { configs } = req.body;
    
    if (!Array.isArray(configs)) {
      res.status(400).json({ error: 'Configurações devem ser um array' });
      return;
    }

    const results = [];
    
    for (const config of configs) {
      const { error, value } = updateConfigSchema.validate(config);
      
      if (error) {
        results.push({
          key: config.key,
          success: false,
          error: error.details.map(d => d.message).join(', ')
        });
        continue;
      }

      const success = await SystemConfigService.set(
        value.key, 
        value.value, 
        value.description
      );
      
      results.push({
        key: value.key,
        success,
        error: success ? null : 'Erro interno'
      });
    }

    res.json({
      message: 'Configurações atualizadas',
      data: { results }
    });
  });

  /**
   * Obtém configurações específicas de timezone
   */
  static getTimezoneConfig = asyncHandler(async (req: Request, res: Response) => {
    const timezone = await SystemConfigService.getTimezone();
    const dateFormat = await SystemConfigService.getDateFormat();

    res.json({
      message: 'Configurações de timezone obtidas com sucesso',
      data: { 
        timezone,
        dateFormat,
        availableTimezones: [
          'America/Sao_Paulo',
          'America/New_York',
          'America/Los_Angeles',
          'Europe/London',
          'Europe/Paris',
          'Asia/Tokyo',
          'UTC'
        ]
      }
    });
  });
}