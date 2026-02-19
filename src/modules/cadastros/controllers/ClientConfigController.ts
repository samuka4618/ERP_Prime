import { Request, Response } from 'express';
import { ClientConfigModel, CreateClientConfigRequest, UpdateClientConfigRequest, ConfigType } from '../models/ClientConfig';
import { validateClientConfig } from '../schemas/clientRegistration';
import { clientConfigCache } from '../services/ClientConfigCache';

export class ClientConfigController {
  async getConfigOptions(req: Request, res: Response): Promise<void> {
    try {
      // Buscar todas as configurações ativas do banco de dados
      const [ramoAtividade, vendedor, gestor, codigoCarteira, listaPreco, formaPagamento] = await Promise.all([
        ClientConfigModel.getConfigsByType('ramo_atividade', false),
        ClientConfigModel.getConfigsByType('vendedor', false),
        ClientConfigModel.getConfigsByType('gestor', false),
        ClientConfigModel.getConfigsByType('codigo_carteira', false),
        ClientConfigModel.getConfigsByType('lista_preco', false),
        ClientConfigModel.getConfigsByType('forma_pagamento_desejada', false)
      ]);
      
      res.json({
        success: true,
        data: {
          ramo_atividade: ramoAtividade,
          vendedor: vendedor,
          gestor: gestor,
          codigo_carteira: codigoCarteira,
          lista_preco: listaPreco,
          forma_pagamento_desejada: formaPagamento
        }
      });
      
    } catch (error) {
      console.error('Erro ao buscar opções de configuração:', error);
      
      // Retornar dados vazios se houver erro
      res.json({
        success: true,
        data: {
          ramo_atividade: [],
          vendedor: [],
          gestor: [],
          codigo_carteira: [],
          lista_preco: [],
          forma_pagamento_desejada: []
        }
      });
    }
  }
  
  async getConfigs(req: Request, res: Response): Promise<void> {
    try {
      const type = req.params.type as ConfigType;
      const includeInactive = req.query.includeInactive === 'true';
      
      // Validar tipo
      const validTypes: ConfigType[] = ['ramo_atividade', 'vendedor', 'gestor', 'codigo_carteira', 'lista_preco', 'forma_pagamento_desejada'];
      if (!validTypes.includes(type)) {
        res.status(400).json({
          success: false,
          message: 'Tipo de configuração inválido'
        });
        return;
      }
      
      try {
        // Tentar buscar do banco de dados
        const configs = await ClientConfigModel.getConfigsByType(type, includeInactive);
        res.json({
          success: true,
          data: configs
        });
      } catch (dbError) {
        console.error('Erro ao conectar com banco de dados, usando dados em memória:', dbError);
        
        // Fallback para dados em memória
        const configs = clientConfigCache.getConfigsByType(type);
        res.json({
          success: true,
          data: configs
        });
      }
      
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }
  
  async getConfigById(req: Request, res: Response): Promise<void> {
    try {
      const type = req.params.type as ConfigType;
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: 'ID inválido'
        });
        return;
      }
      
      const config = await ClientConfigModel.getConfigById(type, id);
      
      if (!config) {
        res.status(404).json({
          success: false,
          message: 'Configuração não encontrada'
        });
        return;
      }
      
      res.json({
        success: true,
        data: config
      });
      
    } catch (error) {
      console.error('Erro ao buscar configuração:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }
  
  async createConfig(req: Request, res: Response): Promise<void> {
    try {
      const type = req.params.type as ConfigType;
      
      // Validar tipo
      const validTypes: ConfigType[] = ['ramo_atividade', 'vendedor', 'gestor', 'codigo_carteira', 'lista_preco', 'forma_pagamento_desejada'];
      if (!validTypes.includes(type)) {
        res.status(400).json({
          success: false,
          message: 'Tipo de configuração inválido'
        });
        return;
      }
      
      // Criar nova configuração (apenas admin)
      const validatedData = validateClientConfig(req.body);
      
      try {
        // Tentar salvar no banco de dados
        const config = await ClientConfigModel.createConfig(type, validatedData);
        res.status(201).json({
          success: true,
          message: 'Configuração criada com sucesso',
          data: config
        });
      } catch (dbError) {
        console.error('Erro ao conectar com banco de dados, salvando em memória:', dbError);
        
        // Fallback para cache em memória
        const config = clientConfigCache.addConfig(type, validatedData.nome);
        res.status(201).json({
          success: true,
          message: 'Configuração criada com sucesso (salva em memória)',
          data: config
        });
      }
      
    } catch (error) {
      console.error('Erro ao criar configuração:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }
  
  async updateConfig(req: Request, res: Response): Promise<void> {
    try {
      const type = req.params.type as ConfigType;
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: 'ID inválido'
        });
        return;
      }
      
      // Validar tipo
      const validTypes: ConfigType[] = ['ramo_atividade', 'vendedor', 'gestor', 'codigo_carteira', 'lista_preco', 'forma_pagamento_desejada'];
      if (!validTypes.includes(type)) {
        res.status(400).json({
          success: false,
          message: 'Tipo de configuração inválido'
        });
        return;
      }
      
      // Atualizar configuração (apenas admin)
      const updateData: UpdateClientConfigRequest = {};
      
      if (req.body.nome !== undefined) {
        updateData.nome = req.body.nome;
      }
      if (req.body.descricao !== undefined) {
        updateData.descricao = req.body.descricao;
      }
      if (req.body.is_active !== undefined) {
        updateData.is_active = req.body.is_active;
      }
      
      const config = await ClientConfigModel.updateConfig(type, id, updateData);
      
      res.json({
        success: true,
        message: 'Configuração atualizada com sucesso',
        data: config
      });
      
    } catch (error) {
      console.error('Erro ao atualizar configuração:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }
  
  async deleteConfig(req: Request, res: Response): Promise<void> {
    try {
      const type = req.params.type as ConfigType;
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: 'ID inválido'
        });
        return;
      }
      
      // Validar tipo
      const validTypes: ConfigType[] = ['ramo_atividade', 'vendedor', 'gestor', 'codigo_carteira', 'lista_preco', 'forma_pagamento_desejada'];
      if (!validTypes.includes(type)) {
        res.status(400).json({
          success: false,
          message: 'Tipo de configuração inválido'
        });
        return;
      }
      
      try {
        // Tentar deletar do banco de dados
        await ClientConfigModel.deleteConfig(type, id);
        res.json({
          success: true,
          message: 'Configuração excluída com sucesso'
        });
      } catch (dbError) {
        console.error('Erro ao conectar com banco de dados, deletando da memória:', dbError);
        
        // Fallback para cache em memória
        const deleted = clientConfigCache.deleteConfig(type, id);
        if (deleted) {
          res.json({
            success: true,
            message: 'Configuração excluída com sucesso (da memória)'
          });
        } else {
          res.status(404).json({
            success: false,
            message: 'Configuração não encontrada'
          });
        }
      }
      
    } catch (error) {
      console.error('Erro ao excluir configuração:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }
  
  async hardDeleteConfig(req: Request, res: Response): Promise<void> {
    try {
      const type = req.params.type as ConfigType;
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: 'ID inválido'
        });
        return;
      }
      
      // Validar tipo
      const validTypes: ConfigType[] = ['ramo_atividade', 'vendedor', 'gestor', 'codigo_carteira', 'lista_preco', 'forma_pagamento_desejada'];
      if (!validTypes.includes(type)) {
        res.status(400).json({
          success: false,
          message: 'Tipo de configuração inválido'
        });
        return;
      }
      
      // Hard delete (apenas admin)
      await ClientConfigModel.hardDeleteConfig(type, id);
      
      res.json({
        success: true,
        message: 'Configuração excluída permanentemente'
      });
      
    } catch (error) {
      console.error('Erro ao excluir configuração permanentemente:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }
  
  async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      const stats = await ClientConfigModel.getConfigStatistics();
      
      res.json({
        success: true,
        data: stats
      });
      
    } catch (error) {
      console.error('Erro ao buscar estatísticas de configuração:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }
  
  async searchConfigs(req: Request, res: Response): Promise<void> {
    try {
      const type = req.params.type as ConfigType;
      const searchTerm = req.query.q as string;
      
      if (!searchTerm) {
        res.status(400).json({
          success: false,
          message: 'Termo de busca é obrigatório'
        });
        return;
      }
      
      // Validar tipo
      const validTypes: ConfigType[] = ['ramo_atividade', 'vendedor', 'gestor', 'codigo_carteira', 'lista_preco', 'forma_pagamento_desejada'];
      if (!validTypes.includes(type)) {
        res.status(400).json({
          success: false,
          message: 'Tipo de configuração inválido'
        });
        return;
      }
      
      const configs = await ClientConfigModel.searchConfigs(type, searchTerm);
      
      res.json({
        success: true,
        data: configs
      });
      
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }
}
