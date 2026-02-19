import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { ClientRegistrationModel } from '../models/ClientRegistration';
import { CnpjQueryStatusModel } from '../models/CnpjQueryStatus';
import { cnpjQueueService } from '../services/cnpj-queue-service';
import { UserRole } from '../types';
import { uploadClientImages, uploadClientImagesOptional } from '../middleware/uploadClientImages';
import { DatabaseService } from '../../cadastros/src/services/databaseService';
import { AtakService } from '../../cadastros/src/services/atakService';
import { isAtakConfigured } from '../../cadastros/src/services/atakAuth';
import * as dotenv from 'dotenv';

dotenv.config();

const router = Router();

// Middleware de autenticação para todas as rotas
router.use(authenticate);

// GET /api/client-registrations - Listar cadastros (filtros por status)
router.get('/', async (req, res) => {
  try {
    const filters = {
      status: req.query.status as string,
      search: req.query.search as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 10
    };

    console.log('🔍 [CLIENT-REGISTRATIONS] Buscando cadastros com filtros:', filters);
    
    const result = await ClientRegistrationModel.findAll(filters);
    
    console.log('✅ [CLIENT-REGISTRATIONS] Cadastros encontrados:', result.data?.length || 0);
    console.log('📊 [CLIENT-REGISTRATIONS] Total de registros:', result.total || 0);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('❌ [CLIENT-REGISTRATIONS] Erro ao buscar cadastros:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// GET /api/client-registrations/my - Cadastros do usuário logado
router.get('/my', async (req, res) => {
  try {
    const userId = (req as any).user?.id || 699;
    
    console.log('🔍 [CLIENT-REGISTRATIONS] Buscando cadastros do usuário:', userId);
    
    const userRegistrations = await ClientRegistrationModel.findByUser(userId);
    
    console.log('✅ [CLIENT-REGISTRATIONS] Cadastros do usuário encontrados:', userRegistrations.length);
    
    res.json({
      success: true,
      data: userRegistrations
    });
  } catch (error) {
    console.error('❌ [CLIENT-REGISTRATIONS] Erro ao buscar cadastros do usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// POST /api/client-registrations - Criar novo cadastro
router.post('/', uploadClientImages, async (req, res): Promise<void> => {
  try {
    // Obter dados do formulário (multipart/form-data)
    const files = req.uploadedFiles;
    
    if (!files || !files.imagem_externa || !files.imagem_interna) {
      res.status(400).json({
        success: false,
        message: 'Imagens externa e interna são obrigatórias'
      });
      return;
    }

    // Adicionar user_id do usuário logado
    const registrationData = {
      ...req.body,
      user_id: (req as any).user?.id || 699, // ID do usuário logado
      imagem_externa_path: files.imagem_externa.path,
      imagem_interna_path: files.imagem_interna.path,
      anexos_path: files.anexos && files.anexos.length > 0 ? files.anexos.map(f => f.path).join(',') : undefined
    };

    console.log('📁 [CLIENT-REGISTRATIONS] Caminhos das imagens:', {
      imagem_externa: registrationData.imagem_externa_path,
      imagem_interna: registrationData.imagem_interna_path
    });

    console.log('📝 [CLIENT-REGISTRATIONS] Dados recebidos para criação:', {
      nome_cliente: registrationData.nome_cliente,
      cnpj: registrationData.cnpj,
      email: registrationData.email,
      user_id: registrationData.user_id
    });

    console.log('💾 [CLIENT-REGISTRATIONS] Salvando no SQL Server...');
    
    // Normalizar CNPJ antes de salvar para evitar duplicidade por formatação
    if (registrationData.cnpj) {
      registrationData.cnpj = (registrationData.cnpj as string).replace(/\D/g, '');
    }

    const newRegistration = await ClientRegistrationModel.create(registrationData);
    
    console.log('✅ [CLIENT-REGISTRATIONS] Cadastro criado com sucesso no SQL Server:', {
      id: newRegistration.id,
      nome_cliente: newRegistration.nome_cliente,
      status: newRegistration.status
    });
    
    // Criar registro de status de consulta (se tabela existe)
    try {
      await CnpjQueryStatusModel.create({
        registration_id: newRegistration.id,
        cnpj: registrationData.cnpj,
        status: 'pending',
        current_step: 'Iniciando consulta de CNPJ...'
      });
      console.log(`✅ [CLIENT-REGISTRATIONS] Registro de status criado para CNPJ: ${registrationData.cnpj}`);
    } catch (statusError) {
      console.log(`⚠️ [CLIENT-REGISTRATIONS] Não foi possível criar registro de status para CNPJ: ${registrationData.cnpj}`);
      console.log(`   (Tabela pode não existir - Execute: npm run migrate:cnpj-status)`);
    }
    
    // Adicionar consulta à fila (processamento sequencial)
    console.log(`🚀 [CLIENT-REGISTRATIONS] Adicionando consulta à fila para CNPJ: ${registrationData.cnpj}`);
    cnpjQueueService.enqueue(newRegistration.id, registrationData.cnpj);
    console.log(`📋 [CLIENT-REGISTRATIONS] Consulta adicionada à fila - será processada em ordem`);
    
    res.status(201).json({
      success: true,
      message: 'Cadastro criado com sucesso',
      data: newRegistration
    });
  } catch (error) {
    console.error('❌ [CLIENT-REGISTRATIONS] Erro ao criar cadastro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// PUT /api/client-registrations/:id - Atualizar cadastro (imagens opcionais)
router.put('/:id', uploadClientImagesOptional, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, message: 'ID inválido' });
      return;
    }

    const files = (req as any).uploadedFiles || {};
    const payload: any = { ...req.body };
    if (files.imagem_externa?.path) payload.imagem_externa_path = files.imagem_externa.path;
    if (files.imagem_interna?.path) payload.imagem_interna_path = files.imagem_interna.path;
    if (files.anexos && files.anexos.length > 0) payload.anexos_path = files.anexos.map((f: any) => f.path).join(',');

    const updated = await ClientRegistrationModel.update(id, payload);
    if (!updated) {
      res.status(404).json({ success: false, message: 'Cadastro não encontrado' });
      return;
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('❌ [CLIENT-REGISTRATIONS] Erro ao atualizar cadastro:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

// GET /api/client-registrations/statistics - Estatísticas (admin)
router.get('/statistics', authorize(UserRole.ADMIN), async (req, res) => {
  try {
    console.log('📊 [CLIENT-REGISTRATIONS] Buscando estatísticas...');
    
    // Obter parâmetros de data da query string
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    
    const statistics = await ClientRegistrationModel.getStatistics(startDate, endDate);
    
    console.log('✅ [CLIENT-REGISTRATIONS] Estatísticas obtidas:', statistics);
    
    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('❌ [CLIENT-REGISTRATIONS] Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// GET /api/client-registrations/recent-history - Histórico recente (admin)
router.get('/recent-history', authorize(UserRole.ADMIN), async (req, res) => {
  try {
    console.log('📜 [CLIENT-REGISTRATIONS] Buscando histórico recente...');
    
    const recentHistory = await ClientRegistrationModel.getRecentHistory();
    
    console.log('✅ [CLIENT-REGISTRATIONS] Histórico obtido:', recentHistory.length, 'registros');
    
    res.json({
      success: true,
      data: recentHistory
    });
  } catch (error) {
    console.error('❌ [CLIENT-REGISTRATIONS] Erro ao buscar histórico recente:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// GET /api/client-registrations/queue-status - Status da fila de consultas
router.get('/queue-status', async (req, res) => {
  try {
    const queueStatus = cnpjQueueService.getStatus();
    
    res.json({
      success: true,
      data: {
        queueLength: queueStatus.queueLength,
        isProcessing: queueStatus.isProcessing,
        message: queueStatus.isProcessing 
          ? `Processando... ${queueStatus.queueLength} item(s) na fila`
          : `Fila vazia ou em espera (${queueStatus.queueLength} item(s) aguardando)`
      }
    });
  } catch (error) {
    console.error('❌ [CLIENT-REGISTRATIONS] Erro ao buscar status da fila:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// GET /api/client-registrations/:id/query-status - Status da consulta de CNPJ
router.get('/:id/query-status', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        message: 'ID inválido'
      });
      return;
    }
    
    console.log('🔍 [CLIENT-REGISTRATIONS] Buscando status da consulta para ID:', id);
    
    const status = await CnpjQueryStatusModel.findByRegistrationId(id);
    
    if (!status) {
      console.log('⚠️ [CLIENT-REGISTRATIONS] Status não encontrado para ID:', id);
      res.json({
        success: true,
        data: null
      });
      return;
    }

    console.log('✅ [CLIENT-REGISTRATIONS] Status encontrado:', {
      registration_id: status.registration_id,
      status: status.status,
      current_step: status.current_step
    });

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('❌ [CLIENT-REGISTRATIONS] Erro ao buscar status da consulta:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// GET /api/client-registrations/condicoes-pagamento - Buscar condições de pagamento do Atak
// IMPORTANTE: Esta rota deve estar ANTES de /:id para evitar conflito de rotas
router.get('/condicoes-pagamento', authorize(UserRole.ADMIN, UserRole.ATTENDANT), async (req, res) => {
  try {
    console.log('🔍 [CLIENT-REGISTRATIONS] Iniciando busca de condições de pagamento do banco de dados (tbCondPgto)...');
    
    const dbConfig = {
      server: process.env.DB_SERVER || '',
      database: process.env.DB_DATABASE || '',
      user: process.env.DB_USER || '',
      password: process.env.DB_PASSWORD || '',
      options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
        enableArithAbort: true
      }
    };

    console.log('📋 [CLIENT-REGISTRATIONS] Configuração do banco:', {
      server: dbConfig.server,
      database: dbConfig.database,
      user: dbConfig.user,
      hasPassword: !!dbConfig.password
    });

    let dbService: DatabaseService;
    try {
      dbService = new DatabaseService(dbConfig);
      console.log('✅ [CLIENT-REGISTRATIONS] DatabaseService criado com sucesso');
    } catch (dbError) {
      console.error('❌ [CLIENT-REGISTRATIONS] Erro ao criar DatabaseService:', dbError);
      throw new Error(`Erro ao criar DatabaseService: ${dbError instanceof Error ? dbError.message : 'Erro desconhecido'}`);
    }

    let atakService: AtakService;
    try {
      atakService = new AtakService(dbService);
      console.log('✅ [CLIENT-REGISTRATIONS] AtakService criado com sucesso');
    } catch (atakError) {
      console.error('❌ [CLIENT-REGISTRATIONS] Erro ao criar AtakService:', atakError);
      throw new Error(`Erro ao criar AtakService: ${atakError instanceof Error ? atakError.message : 'Erro desconhecido'}`);
    }

    console.log('🔄 [CLIENT-REGISTRATIONS] Chamando getCondicoesPagamento...');
    const result = await atakService.getCondicoesPagamento();
    console.log('📥 [CLIENT-REGISTRATIONS] Resultado recebido:', {
      success: result.success,
      hasData: !!result.data,
      dataLength: result.data?.length || 0,
      error: result.error
    });

    if (result.success && result.data) {
      console.log(`✅ [CLIENT-REGISTRATIONS] ${result.data.length} condições de pagamento encontradas`);
      res.json({
        success: true,
        data: result.data
      });
    } else {
      console.error('❌ [CLIENT-REGISTRATIONS] Falha ao buscar condições:', result.error);
      res.status(500).json({
        success: false,
        message: result.error || 'Erro ao buscar condições de pagamento',
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ [CLIENT-REGISTRATIONS] Erro ao buscar condições de pagamento:', error);
    console.error('   Stack:', error instanceof Error ? error.stack : 'N/A');
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
});

// GET /api/client-registrations/:id - Detalhes + histórico
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    console.log('🔍 [CLIENT-REGISTRATIONS] Buscando cadastro por ID:', id);
    
    const registration = await ClientRegistrationModel.findById(id);
    
    if (!registration) {
      console.log('❌ [CLIENT-REGISTRATIONS] Cadastro não encontrado:', id);
      res.status(404).json({
        success: false,
        message: 'Cadastro não encontrado'
      });
      return;
    }

    console.log('✅ [CLIENT-REGISTRATIONS] Cadastro encontrado:', {
      id: registration.id,
      nome_cliente: registration.nome_cliente,
      status: registration.status
    });

    console.log('📁 [CLIENT-REGISTRATIONS] Caminhos das imagens no registro:', {
      imagem_externa: registration.imagem_externa_path,
      imagem_interna: registration.imagem_interna_path
    });

    res.json({
      success: true,
      data: registration
    });
  } catch (error) {
    console.error('❌ [CLIENT-REGISTRATIONS] Erro ao buscar cadastro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// PUT /api/client-registrations/:id/status - Atualizar status (admin/financeiro)
router.put('/:id/status', authorize(UserRole.ADMIN), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, feedback } = req.body;
    
    console.log('🔄 [CLIENT-REGISTRATIONS] Atualizando status:', { id, status, feedback });
    
    const updatedRegistration = await ClientRegistrationModel.updateStatus(id, status, (req as any).user?.id || 699, feedback);
    
    if (!updatedRegistration) {
      console.log('❌ [CLIENT-REGISTRATIONS] Cadastro não encontrado para atualização:', id);
      res.status(404).json({
        success: false,
        message: 'Cadastro não encontrado'
      });
      return;
    }

    console.log('✅ [CLIENT-REGISTRATIONS] Status atualizado com sucesso:', {
      id: updatedRegistration.id,
      status: updatedRegistration.status
    });

    res.json({
      success: true,
      message: 'Status atualizado com sucesso',
      data: updatedRegistration
    });
  } catch (error) {
    console.error('❌ [CLIENT-REGISTRATIONS] Erro ao atualizar status:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// PUT /api/client-registrations/:id/financial - Definir condição de pagamento e limite de crédito (atendentes)
router.put('/:id/financial', authorize(UserRole.ADMIN, UserRole.ATTENDANT), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { condicao_pagamento_id, limite_credito, codigo_carteira, codigo_forma_cobranca } = req.body;

    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        message: 'ID inválido'
      });
      return;
    }

    console.log('💰 [CLIENT-REGISTRATIONS] Atualizando dados financeiros:', {
      id,
      condicao_pagamento_id,
      limite_credito,
      codigo_carteira,
      codigo_forma_cobranca
    });

    // Buscar o cadastro para verificar se tem atak_cliente_id
    const registration = await ClientRegistrationModel.findById(id);
    
    if (!registration) {
      console.log('❌ [CLIENT-REGISTRATIONS] Cadastro não encontrado:', id);
      res.status(404).json({
        success: false,
        message: 'Cadastro não encontrado'
      });
      return;
    }

    // Validar se tem atak_cliente_id (necessário para atualizar no Atak)
    if (!registration.atak_cliente_id) {
      res.status(400).json({
        success: false,
        message: 'Cliente ainda não foi cadastrado no Atak. Complete o cadastro antes de definir condições financeiras.'
      });
      return;
    }

    // Atualizar no banco de dados
    const updateData: any = {};
    if (condicao_pagamento_id !== undefined) {
      updateData.condicao_pagamento_id = condicao_pagamento_id;
    }
    if (limite_credito !== undefined && limite_credito !== null) {
      updateData.limite_credito = parseFloat(limite_credito);
    }

    const updated = await ClientRegistrationModel.update(id, updateData);

    if (!updated) {
      res.status(404).json({
        success: false,
        message: 'Erro ao atualizar cadastro'
      });
      return;
    }

    console.log('✅ [CLIENT-REGISTRATIONS] Dados financeiros atualizados no banco');

    // Verificar se o Atak está configurado antes de tentar atualizar
    if (!isAtakConfigured()) {
      console.warn('⚠️ [CLIENT-REGISTRATIONS] Configurações do Atak não encontradas. A atualização será apenas no banco de dados.');
      console.warn('   💡 Configure ATAK_USERNAME, ATAK_PASSWORD e ATAK_BASE_URL no .env para habilitar atualização no Atak');
      
      res.json({
        success: true,
        message: 'Dados financeiros salvos no sistema',
        warning: 'Configurações do Atak não encontradas. Configure ATAK_USERNAME, ATAK_PASSWORD e ATAK_BASE_URL no .env para habilitar atualização no Atak.',
        data: updated
      });
      return;
    }

    // Enviar atualização para o Atak
    try {
      const dbConfig = {
        server: process.env.DB_SERVER || '',
        database: process.env.DB_DATABASE || '',
        user: process.env.DB_USER || '',
        password: process.env.DB_PASSWORD || '',
        options: {
          encrypt: process.env.DB_ENCRYPT === 'true',
          trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
          enableArithAbort: true
        }
      };

      const dbService = new DatabaseService(dbConfig);
      const atakService = new AtakService(dbService);

      const atakResult = await atakService.updateFinancialData(
        registration.atak_cliente_id,
        condicao_pagamento_id,
        limite_credito,
        codigo_carteira ? parseInt(codigo_carteira) : undefined,
        codigo_forma_cobranca ? parseInt(codigo_forma_cobranca) : undefined,
        registration.cnpj
      );

      if (atakResult.success) {
        // Marcar como enviado ao Atak
        await ClientRegistrationModel.update(id, { dados_financeiros_enviados_atak: true });
        console.log('✅ [CLIENT-REGISTRATIONS] Dados financeiros atualizados no Atak');
        
        res.json({
          success: true,
          message: 'Dados financeiros atualizados com sucesso no sistema e no Atak',
          data: updated
        });
      } else {
        console.error('❌ [CLIENT-REGISTRATIONS] Erro ao atualizar no Atak:', atakResult.error);
        // Mesmo com erro no Atak, os dados foram salvos no banco
        res.json({
          success: true,
          message: 'Dados financeiros salvos no sistema, mas houve erro ao atualizar no Atak',
          warning: atakResult.error,
          data: updated
        });
      }
    } catch (atakError) {
      console.error('❌ [CLIENT-REGISTRATIONS] Erro ao conectar com Atak:', atakError);
      // Mesmo com erro no Atak, os dados foram salvos no banco
      res.json({
        success: true,
        message: 'Dados financeiros salvos no sistema, mas houve erro ao atualizar no Atak',
        warning: atakError instanceof Error ? atakError.message : 'Erro desconhecido',
        data: updated
      });
    }

  } catch (error) {
    console.error('❌ [CLIENT-REGISTRATIONS] Erro ao atualizar dados financeiros:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// GET /api/client-registrations/:id/atak - Buscar dados completos do cliente no Atak
router.get('/:id/atak', authorize(UserRole.ADMIN, UserRole.ATTENDANT), async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        message: 'ID inválido'
      });
      return;
    }

    console.log('🔍 [CLIENT-REGISTRATIONS] Buscando dados do cliente no Atak:', id);

    // Buscar o cadastro para obter o atak_cliente_id
    const registration = await ClientRegistrationModel.findById(id);
    
    if (!registration) {
      console.log('❌ [CLIENT-REGISTRATIONS] Cadastro não encontrado:', id);
      res.status(404).json({
        success: false,
        message: 'Cadastro não encontrado'
      });
      return;
    }

    // Verificar se tem atak_cliente_id
    if (!registration.atak_cliente_id) {
      res.status(400).json({
        success: false,
        message: 'Cliente ainda não foi cadastrado no Atak'
      });
      return;
    }

    // Verificar se o Atak está configurado
    if (!isAtakConfigured()) {
      res.status(400).json({
        success: false,
        message: 'Configurações do Atak não encontradas. Configure ATAK_USERNAME, ATAK_PASSWORD e ATAK_BASE_URL no .env.'
      });
      return;
    }

    // Buscar dados do cliente no Atak
    try {
      const dbConfig = {
        server: process.env.DB_SERVER || '',
        database: process.env.DB_DATABASE || '',
        user: process.env.DB_USER || '',
        password: process.env.DB_PASSWORD || '',
        options: {
          encrypt: process.env.DB_ENCRYPT === 'true',
          trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
          enableArithAbort: true
        }
      };

      const dbService = new DatabaseService(dbConfig);
      const atakService = new AtakService(dbService);

      const atakResult = await atakService.getCustomerById(registration.atak_cliente_id);

      if (atakResult.success) {
        console.log('✅ [CLIENT-REGISTRATIONS] Dados do Atak obtidos com sucesso');
        res.json({
          success: true,
          message: 'Dados do Atak obtidos com sucesso',
          data: atakResult.data
        });
      } else {
        console.error('❌ [CLIENT-REGISTRATIONS] Erro ao buscar dados no Atak:', atakResult.error);
        res.status(500).json({
          success: false,
          message: 'Erro ao buscar dados no Atak',
          error: atakResult.error
        });
      }
    } catch (atakError) {
      console.error('❌ [CLIENT-REGISTRATIONS] Erro ao conectar com Atak:', atakError);
      res.status(500).json({
        success: false,
        message: 'Erro ao conectar com Atak',
        error: atakError instanceof Error ? atakError.message : 'Erro desconhecido'
      });
    }

  } catch (error) {
    console.error('❌ [CLIENT-REGISTRATIONS] Erro ao buscar dados do Atak:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// POST /api/client-registrations/:id/reprocess - Reprocessar cadastro com erro
router.post('/:id/reprocess', authorize(UserRole.ADMIN), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        message: 'ID inválido'
      });
      return;
    }

    console.log('🔄 [CLIENT-REGISTRATIONS] Iniciando reprocessamento para ID:', id);
    
    // Buscar o cadastro
    const registration = await ClientRegistrationModel.findById(id);
    
    if (!registration) {
      console.log('❌ [CLIENT-REGISTRATIONS] Cadastro não encontrado:', id);
      res.status(404).json({
        success: false,
        message: 'Cadastro não encontrado'
      });
      return;
    }

    if (!registration.cnpj) {
      console.log('❌ [CLIENT-REGISTRATIONS] CNPJ não encontrado no cadastro:', id);
      res.status(400).json({
        success: false,
        message: 'CNPJ não encontrado no cadastro'
      });
      return;
    }

    // Normalizar CNPJ
    const cleanCNPJ = registration.cnpj.replace(/\D/g, '');

    console.log('🔄 [CLIENT-REGISTRATIONS] Reprocessando CNPJ:', cleanCNPJ);

    // Resetar status da consulta para 'pending'
    try {
      const existingStatus = await CnpjQueryStatusModel.findByRegistrationId(id);
      
      if (existingStatus) {
        // Atualizar status existente (limpar erro)
        await CnpjQueryStatusModel.update(id, {
          status: 'pending',
          current_step: 'Aguardando reprocessamento...',
          error_message: undefined // undefined remove o erro
        });
        console.log('✅ [CLIENT-REGISTRATIONS] Status da consulta resetado para pending');
      } else {
        // Criar novo registro de status
        await CnpjQueryStatusModel.create({
          registration_id: id,
          cnpj: cleanCNPJ,
          status: 'pending',
          current_step: 'Aguardando reprocessamento...'
        });
        console.log('✅ [CLIENT-REGISTRATIONS] Novo registro de status criado');
      }
    } catch (statusError) {
      console.warn('⚠️ [CLIENT-REGISTRATIONS] Erro ao atualizar/criar status:', statusError);
      // Continua mesmo se falhar - não é crítico
    }

    // Adicionar à fila de processamento
    console.log('🚀 [CLIENT-REGISTRATIONS] Adicionando à fila para reprocessamento...');
    cnpjQueueService.enqueue(id, cleanCNPJ);
    console.log('✅ [CLIENT-REGISTRATIONS] Cadastro adicionado à fila de reprocessamento');

    res.json({
      success: true,
      message: 'Cadastro adicionado à fila de reprocessamento com sucesso',
      data: {
        registration_id: id,
        cnpj: cleanCNPJ,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('❌ [CLIENT-REGISTRATIONS] Erro ao reprocessar cadastro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

export default router;
