import { Request, Response } from 'express';
import { ClientRegistrationModel, CreateClientRegistrationRequest, UpdateClientRegistrationStatusRequest, ClientRegistrationFilters } from '../models/ClientRegistration';
import { ClientRegistrationHistoryModel } from '../models/ClientRegistrationHistory';
import { validateClientRegistration, validateUpdateStatus, validateFilters } from '../schemas/clientRegistration';
import { validateCNPJ, cleanCNPJ } from '../../../shared/utils/cnpjValidator';
import { CNPJConsultationService } from '../services/cnpj-consultation-service';
import { CnpjQueryStatusModel } from '../models/CnpjQueryStatus';
import { NotificationService } from '../../chamados/services/NotificationService';

export class ClientRegistrationController {
  async create(req: Request, res: Response): Promise<void> {
    try {
      // 1. Validar dados com Joi
      const validatedData = validateClientRegistration(req.body);
      
      // 2. Validar CNPJ
      if (!validateCNPJ(validatedData.cnpj)) {
        res.status(400).json({
          success: false,
          message: 'CNPJ inválido'
        });
        return;
      }
      
      // 2.1. Normalizar CNPJ (apenas números) e verificar se já existe cadastro
      const cleanCnpj = cleanCNPJ(validatedData.cnpj);
      const existingRegistration = await ClientRegistrationModel.findByCNPJ(cleanCnpj);
      
      if (existingRegistration) {
        res.status(409).json({
          success: false,
          message: 'Já existe um cadastro com este CNPJ',
          data: {
            existing_id: existingRegistration.id,
            existing_nome: existingRegistration.nome_cliente,
            existing_email: existingRegistration.email,
            existing_status: existingRegistration.status
          }
        });
        return;
      }
      
      // 3. Verificar se imagens foram enviadas
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      if (!files || !files['imagem_externa'] || !files['imagem_interna']) {
        res.status(400).json({
          success: false,
          message: 'Imagens externa e interna são obrigatórias'
        });
        return;
      }
      
      const imagemExterna = files['imagem_externa'][0];
      const imagemInterna = files['imagem_interna'][0];
      const anexos = files['anexos'] || [];
      
      // 4. Preparar dados para inserção (usar CNPJ normalizado)
      const registrationData: CreateClientRegistrationRequest = {
        user_id: req.user!.id,
        nome_cliente: validatedData.nome_cliente,
        nome_fantasia: validatedData.nome_fantasia,
        cnpj: cleanCnpj, // Usar CNPJ normalizado (apenas números) para consistência
        email: validatedData.email,
        ramo_atividade_id: validatedData.ramo_atividade_id,
        vendedor_id: validatedData.vendedor_id,
        gestor_id: validatedData.gestor_id,
        codigo_carteira_id: validatedData.codigo_carteira_id,
        lista_preco_id: validatedData.lista_preco_id,
        forma_pagamento_desejada_id: validatedData.forma_pagamento_desejada_id,
        prazo_desejado: validatedData.prazo_desejado,
        periodicidade_pedido: validatedData.periodicidade_pedido,
        valor_estimado_pedido: validatedData.valor_estimado_pedido,
        forma_contato: validatedData.forma_contato,
        imagem_externa_path: imagemExterna.path,
        imagem_interna_path: imagemInterna.path,
        anexos_path: anexos.length > 0 ? anexos.map(file => file.path).join(',') : undefined,
        whatsapp_cliente: validatedData.whatsapp_cliente,
        rede_social: validatedData.rede_social,
        link_google_maps: validatedData.link_google_maps
      };
      
      // 5. Criar registro no SQL Server
      const registration = await ClientRegistrationModel.create(registrationData);
      
      // 6. Criar entrada inicial no histórico
      await ClientRegistrationHistoryModel.create({
        registration_id: registration.id,
        user_id: req.user!.id,
        status_novo: 'cadastro_enviado',
        observacoes: 'Cadastro enviado pelo usuário'
      });
      
      // 7. Criar registro de status de consulta (se tabela existe)
      console.log(`📊 [CLIENT-REGISTRATION] Criando registro de status de consulta para CNPJ: ${validatedData.cnpj}`);
      try {
        await CnpjQueryStatusModel.create({
          registration_id: registration.id,
          cnpj: validatedData.cnpj,
          status: 'pending',
          current_step: 'Iniciando consulta de CNPJ...'
        });
        console.log(`✅ [CLIENT-REGISTRATION] Registro de status criado`);
      } catch (statusError) {
        console.log(`⚠️ [CLIENT-REGISTRATION] Tabela cnpj_query_status não existe. Execute: npm run migrate:cnpj-status`);
        console.log(`   Continuando sem rastreamento de status...`);
      }

      // 8. Iniciar consulta de CNPJ em background (não bloqueia a resposta)
      console.log(`🚀 [CLIENT-REGISTRATION] Iniciando consulta automática para CNPJ: ${validatedData.cnpj}`);
      CNPJConsultationService.executeFullConsultation(registration.id, validatedData.cnpj).then((result) => {
        if (result.success) {
          console.log(`✅ [CLIENT-REGISTRATION] Consulta iniciada com sucesso para CNPJ: ${validatedData.cnpj}`);
        } else {
          console.error(`❌ [CLIENT-REGISTRATION] Falha ao iniciar consulta: ${result.message}`);
        }
      }).catch((error) => {
        console.error(`❌ [CLIENT-REGISTRATION] Erro ao iniciar consulta:`, error);
      });
      
      // 9. Notificar sobre novo cadastro
      await NotificationService.notifyClientRegistrationCreated(registration.id, req.user!.id);
      
      res.status(201).json({
        success: true,
        message: 'Cadastro de cliente criado com sucesso',
        data: registration
      });
      
    } catch (error) {
      console.error('Erro ao criar cadastro de cliente:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }
  
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      // 1. Extrair filtros (status, search, page, limit)
      const filters = validateFilters(req.query);
      
      // 2. Buscar com paginação
      const result = await ClientRegistrationModel.findAll(filters);
      
      // 3. Retornar { data, total, page, limit, total_pages }
      res.json({
        success: true,
        data: result
      });
      
    } catch (error) {
      console.error('Erro ao buscar cadastros:', error);
      
      // Se for qualquer erro, retornar dados vazios por enquanto
      res.json({
        success: true,
        data: {
          data: [],
          total: 0,
          page: 1,
          limit: 10,
          total_pages: 0
        }
      });
    }
  }
  
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: 'ID inválido'
        });
        return;
      }
      
      // 1. Buscar cadastro
      const registration = await ClientRegistrationModel.findById(id);
      
      if (!registration) {
        res.status(404).json({
          success: false,
          message: 'Cadastro não encontrado'
        });
        return;
      }
      
      // 2. Buscar histórico
      const history = await ClientRegistrationHistoryModel.findByRegistrationId(id);
      
      // 3. Retornar { registration, history }
      res.json({
        success: true,
        data: {
          registration,
          history
        }
      });
      
    } catch (error) {
      console.error('Erro ao buscar cadastro:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }
  
  async getUserRegistrations(req: Request, res: Response): Promise<void> {
    try {
      const filters = validateFilters(req.query);
      const registrations = await ClientRegistrationModel.findByUser(req.user!.id, filters);
      
      res.json({
        success: true,
        data: registrations
      });
      
    } catch (error) {
      console.error('Erro ao buscar cadastros do usuário:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }
  
  async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: 'ID inválido'
        });
        return;
      }
      
      // 1. Buscar registro atual para pegar status anterior
      const currentRegistration = await ClientRegistrationModel.findById(id);
      if (!currentRegistration) {
        res.status(404).json({
          success: false,
          message: 'Cadastro não encontrado'
        });
        return;
      }
      
      // 2. Validar novo status
      const validatedData = validateUpdateStatus(req.body);
      
      // 3. Atualizar em transação (registration + history)
      const updatedRegistration = await ClientRegistrationModel.updateStatus(
        id,
        validatedData.status,
        req.user!.id,
        validatedData.observacoes,
        validatedData.prazo_aprovado,
        validatedData.limite_aprovado
      );
      
      // 4. Notificar sobre mudança de status (se mudou)
      if (currentRegistration.status !== validatedData.status) {
        const statusDescriptions: Record<string, string> = {
          'cadastro_enviado': 'Cadastro Enviado',
          'aguardando_analise_credito': 'Aguardando Análise de Crédito',
          'cadastro_finalizado': 'Cadastro Finalizado'
        };
        
        await NotificationService.notifyClientRegistrationStatusChange(
          id,
          currentRegistration.user_id,
          currentRegistration.status,
          validatedData.status,
          statusDescriptions[currentRegistration.status] || currentRegistration.status
        );
      }
      
      // 5. Retornar registro atualizado
      res.json({
        success: true,
        message: 'Status atualizado com sucesso',
        data: updatedRegistration
      });
      
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }
  
  async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      const stats = await ClientRegistrationHistoryModel.getStatusStatistics();
      
      res.json({
        success: true,
        data: stats
      });
      
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }
  
  async getRecentHistory(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const history = await ClientRegistrationHistoryModel.getRecentHistory(limit);
      
      res.json({
        success: true,
        data: history
      });
      
    } catch (error) {
      console.error('Erro ao buscar histórico recente:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  async getQueryStatus(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: 'ID inválido'
        });
        return;
      }
      
      // Buscar status da consulta
      const status = await CnpjQueryStatusModel.findByRegistrationId(id);
      
      if (!status) {
        res.status(404).json({
          success: false,
          message: 'Status de consulta não encontrado'
        });
        return;
      }
      
      res.json({
        success: true,
        data: status
      });
      
    } catch (error) {
      console.error('Erro ao buscar status da consulta:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }
}
