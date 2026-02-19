import dotenv from 'dotenv';
import { SPCBot } from './services/spcBot';
import { TessService } from './services/tessService';
import { CNPJAService } from './services/cnpjaService';
import { DatabaseServiceRobust } from './services/databaseServiceRobust';
import { DatabaseService } from './services/databaseService';
import { AtakService } from './services/atakService';
import { TessDataParserNew } from './services/tessDataParserNew';
import { CNPJAFileUtils } from './utils/cnpjaFileUtils';
import { config, tessConfig, cnpjaConfig, databaseConfig, validateTessConfig, validateCNPJAConfig } from './config';
import { Logger } from './utils/logger';
import * as sql from 'mssql';
import * as path from 'path';

// Carregar variáveis de ambiente
dotenv.config();

async function updateStatus(registration_id: number, status: string, current_step: string, error_message?: string): Promise<void> {
  try {
    const pool = await sql.connect(databaseConfig);

    const request = new sql.Request(pool);
    request.input('registration_id', sql.Int, registration_id);
    request.input('status', sql.VarChar(50), status);
    // current_step pode conter mensagens longas/HTML. Use NVARCHAR(MAX) para evitar erro TDS 0xE7.
    request.input('current_step', sql.NVarChar(sql.MAX), current_step);
    if (error_message) {
      request.input('error_message', sql.NVarChar(sql.MAX), error_message);
    }

    if (error_message) {
      await request.query(`
        UPDATE cnpj_query_status
        SET status = @status, current_step = @current_step, error_message = @error_message, updated_at = GETDATE()
        WHERE registration_id = @registration_id
      `);
    } else {
      await request.query(`
        UPDATE cnpj_query_status
        SET status = @status, current_step = @current_step, updated_at = GETDATE()
        WHERE registration_id = @registration_id
      `);
    }

    pool.close();
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
  }
}

async function processCNPJ(registration_id: number, cnpj: string): Promise<void> {
  try {
    console.log(`🚀 [TRIGGER] Processando CNPJ: ${cnpj} para Registration ID: ${registration_id}`);
    
    // Inicializa sistemas
    Logger.initialize();
    
    // Atualiza status para "consultando_spc"
    await updateStatus(registration_id, 'consulting_spc', 'Consultando SPC Brasil...');
    console.log(`📊 [TRIGGER] Status atualizado: consulting_spc`);

    // 1. CONSULTA SPC
    console.log(`📋 [TRIGGER] Consultando SPC para CNPJ: ${cnpj}`);
    const bot = new SPCBot({
      url: config.url,
      operador: config.operador,
      senha: config.senha,
      palavraSecreta: config.palavraSecreta,
      downloadPath: config.downloadPath,
      cnpjToQuery: cnpj,
      headless: config.headless,
      browserTimeout: config.browserTimeout,
      debug: config.debug,
      cnpjCacheExpirationHours: config.cnpjCacheExpirationHours
    });

    const spcResult = await bot.executeQuery(cnpj);
    
    if (!spcResult.success || !spcResult.filePath) {
      await updateStatus(registration_id, 'failed', 'Erro na consulta SPC', spcResult.error);
      throw new Error(`Falha na consulta SPC: ${spcResult.error}`);
    }

    console.log(`✅ [TRIGGER] SPC consultado com sucesso: ${spcResult.fileName}`);
    
    // Atualiza status: SPC concluído, iniciando TESS
    await updateStatus(registration_id, 'processing_tess', 'Processando com TESS AI...');
    console.log(`📊 [TRIGGER] Status atualizado: processing_tess`);

    // 2. PROCESSAMENTO TESS
    console.log(`🤖 [TRIGGER] Processando com TESS...`);
    const tessService = new TessService(tessConfig);
    
    const tessResult = await tessService.processPDF(
      spcResult.filePath,
      `Extraia todos os dados estruturados da consulta CNPJ: ${cnpj}. Inclua dados da empresa, sócios, participações societárias e quadro administrativo.`
    );
    
    if (!tessResult.success) {
      await updateStatus(registration_id, 'failed', 'Erro no processamento TESS', tessResult.error);
      throw new Error(`Falha no processamento TESS: ${tessResult.error}`);
    }

    console.log(`✅ [TRIGGER] TESS processado com sucesso (${tessResult.credits} créditos)`);
    
    // Atualiza status: TESS concluído, iniciando CNPJÁ
    await updateStatus(registration_id, 'consulting_cnpja', 'Consultando CNPJÁ...');
    console.log(`📊 [TRIGGER] Status atualizado: consulting_cnpja`);

    // 3. CONSULTA CNPJÁ
    console.log(`🏢 [TRIGGER] Consultando CNPJÁ...`);
    const cnpjaService = new CNPJAService(cnpjaConfig);
    const cnpjaResult = await cnpjaService.queryCompany(cnpj);
    
    console.log(`✅ [TRIGGER] CNPJÁ consultado com sucesso`);
    
    // Atualiza status: CNPJÁ concluído, iniciando salvamento
    await updateStatus(registration_id, 'saving_database', 'Salvando dados no banco de dados...');
    console.log(`📊 [TRIGGER] Status atualizado: saving_database`);

    // 4. INSERIR NO BANCO
    console.log(`💾 [TRIGGER] Inserindo dados no banco...`);
    
    const cnpjaFileUtils = new CNPJAFileUtils('./cnpja_responses');
    const latestCNPJAFile = cnpjaFileUtils.readLatestCNPJAFile(cnpj);
    
    const dadosExtraidos = TessDataParserNew.extrairDadosTESSCompletos(tessResult.response || '', cnpj);
    
    // Log dos dados extraídos do TESS
    console.log('📋 [TRIGGER] Dados extraídos do TESS:');
    console.log(`   - Empresa: ${dadosExtraidos.empresa?.razao_social || 'N/A'}`);
    console.log(`   - Ocorrências: ${dadosExtraidos.ocorrencias ? 'Sim' : 'Não'} (campos: ${dadosExtraidos.ocorrencias ? Object.keys(dadosExtraidos.ocorrencias).length : 0})`);
    console.log(`   - Score Crédito: ${dadosExtraidos.score_credito ? 'Sim' : 'Não'} (campos: ${dadosExtraidos.score_credito ? Object.keys(dadosExtraidos.score_credito).length : 0})`);
    console.log(`   - Histórico Pagamento: ${dadosExtraidos.historico_pagamento_positivo ? 'Sim' : 'Não'} (campos: ${dadosExtraidos.historico_pagamento_positivo ? Object.keys(dadosExtraidos.historico_pagamento_positivo).length : 0})`);
    console.log(`   - SCR: ${dadosExtraidos.scr ? 'Sim' : 'Não'} (campos: ${dadosExtraidos.scr ? Object.keys(dadosExtraidos.scr).length : 0})`);
    console.log(`   - Sócios: ${dadosExtraidos.socios?.length || 0}`);
    console.log(`   - Quadro Admin: ${dadosExtraidos.quadro_administrativo?.length || 0}`);
    console.log(`   - Consultas Realizadas: ${dadosExtraidos.consultas_realizadas?.length || 0}`);
    
    let dadosCNPJA = null;
    if (latestCNPJAFile) {
      dadosCNPJA = cnpjaFileUtils.extractDatabaseData(latestCNPJAFile);
      console.log('📊 [TRIGGER] Dados CNPJÁ encontrados e mesclados');
      
      if (dadosCNPJA) {
        dadosExtraidos.empresa.inscricao_estadual = dadosCNPJA.inscricao_estadual || dadosExtraidos.empresa.inscricao_estadual;
        dadosExtraidos.empresa.inscricao_suframa = dadosCNPJA.inscricao_suframa;
        dadosExtraidos.empresa.nome_fantasia = dadosCNPJA.nome_fantasia || dadosExtraidos.empresa.nome_fantasia;
        dadosExtraidos.empresa.natureza_juridica = dadosCNPJA.natureza_juridica;
        dadosExtraidos.empresa.porte = dadosCNPJA.porte;
        dadosExtraidos.empresa.capital_social = dadosCNPJA.capital_social;
        dadosExtraidos.empresa.atividade_principal = dadosCNPJA.atividade_principal;
        dadosExtraidos.empresa.telefone = dadosCNPJA.telefone;
        dadosExtraidos.empresa.email = dadosCNPJA.email;
        dadosExtraidos.empresa.website = dadosCNPJA.website;
        dadosExtraidos.empresa.cnpja_response = dadosCNPJA.cnpja_response;
        
        if (dadosCNPJA.latitude && dadosCNPJA.longitude) {
          dadosExtraidos.endereco.latitude = dadosCNPJA.latitude;
          dadosExtraidos.endereco.longitude = dadosCNPJA.longitude;
        }
      }
    } else {
      console.warn('⚠️ [TRIGGER] Arquivo CNPJÁ não encontrado, usando apenas dados TESS');
    }
    
    // Log detalhado antes de salvar
    console.log('📊 [TRIGGER] Resumo final dos dados antes de salvar:');
    console.log(`   - Ocorrências: ${JSON.stringify(dadosExtraidos.ocorrencias)}`);
    console.log(`   - Score: ${JSON.stringify(dadosExtraidos.score_credito)}`);
    console.log(`   - Histórico: ${JSON.stringify(dadosExtraidos.historico_pagamento_positivo)}`);
    console.log(`   - SCR: ${JSON.stringify(dadosExtraidos.scr)}`);

    // Conecta ao banco e insere
    // Tenta ler variáveis de ambiente do sistema principal
    console.log('🔌 [TRIGGER] Carregando configurações de banco...');
    
    const dbConfig = {
      server: process.env.DB_SERVER || databaseConfig.server || 'localhost',
      database: process.env.DB_DATABASE || databaseConfig.database || 'consultas_tess',
      user: process.env.DB_USER || databaseConfig.user || 'sa',
      password: process.env.DB_PASSWORD || databaseConfig.password || '',
      port: parseInt(process.env.DB_PORT || String(databaseConfig.port || 1433)),
      options: {
        encrypt: process.env.DB_ENCRYPT === 'true' || databaseConfig.options?.encrypt || false,
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true' || databaseConfig.options?.trustServerCertificate || true
      }
    };
    
    console.log('🔌 [TRIGGER] Configurações de banco final:', {
      server: dbConfig.server,
      database: dbConfig.database,
      port: dbConfig.port,
      user: dbConfig.user
    });

    const databaseService = new DatabaseServiceRobust(dbConfig);
    
    // Conecta ao banco antes de inserir
    console.log('🔌 [TRIGGER] Conectando ao banco de dados...');
    try {
      await databaseService.connect();
      console.log('✅ [TRIGGER] Conectado ao banco de dados');
    } catch (connectError) {
      console.error('❌ [TRIGGER] Erro ao conectar ao banco:', connectError);
      console.error('❌ [TRIGGER] Configurações tentadas:', dbConfig);
      throw new Error(`Não foi possível conectar ao banco de dados: ${connectError instanceof Error ? connectError.message : 'Erro desconhecido'}`);
    }
    
    const resultado = await databaseService.inserirDadosTESSCompletos(dadosExtraidos);

    console.log(`✅ [TRIGGER] Dados inseridos no banco com sucesso!`);
    console.log(`   - Consulta ID: ${resultado.consultaId}`);
    console.log(`   - Empresa ID: ${resultado.empresaId}`);
    console.log(`   - Sócios: ${resultado.sociosIds.length}`);
    console.log(`   - Quadro Administrativo: ${resultado.quadroIds.length}`);
    
    // Atualiza status: Banco concluído, iniciando cadastro Atak
    await updateStatus(registration_id, 'registering_atak', 'Cadastrando cliente no sistema Atak...');
    console.log(`📊 [TRIGGER] Status atualizado: registering_atak`);

    // 5. CADASTRO NO ATAK
    console.log(`🏢 [TRIGGER] Cadastrando cliente no Atak...`);
    let atakResult: { success: boolean; error?: string; customerId?: number; data?: any } = { success: false };
    
    try {
      // Buscar registration_id do client_registrations para atualizar os dados do Atak
      const pool = await sql.connect(dbConfig);
      const regRequest = new sql.Request(pool);
      regRequest.input('cnpj', sql.VarChar(18), cnpj.replace(/\D/g, ''));
      
      const registrationResult = await regRequest.query(`
        SELECT TOP 1 id, codigo_carteira_id, lista_preco_id, forma_pagamento_desejada_id
        FROM client_registrations
        WHERE cnpj = @cnpj
        ORDER BY updated_at DESC
      `);
      pool.close();

      let registrationRecordId = registration_id;
      let codigoCarteiraId: number | undefined;
      let listaPrecoId: number | undefined;
      let formaPagamentoId: number | undefined;

      if (registrationResult.recordset.length > 0) {
        registrationRecordId = registrationResult.recordset[0].id;
        codigoCarteiraId = registrationResult.recordset[0].codigo_carteira_id;
        listaPrecoId = registrationResult.recordset[0].lista_preco_id;
        formaPagamentoId = registrationResult.recordset[0].forma_pagamento_desejada_id;
      }

      // Criar serviços necessários para o Atak
      const atakDbService = new DatabaseService(dbConfig);
      const atakService = new AtakService(atakDbService);
      
      // Executar cadastro no Atak
      atakResult = await atakService.registerCompany(cnpj);
      
      if (atakResult.success) {
        // Salvar resposta do Atak no client_registrations
        await atakService.saveAtakResponse(cnpj, atakResult, registration_id);
        
        if (atakResult.customerId) {
          console.log(`✅ [TRIGGER] Cliente cadastrado no Atak com ID: ${atakResult.customerId}`);
          
          // Atualizar status com sucesso
          if (atakResult.error && atakResult.error.includes('já cadastrado')) {
            await updateStatus(
              registration_id, 
              'completed', 
              `Cliente já estava cadastrado no Atak (ID: ${atakResult.customerId})`
            );
            console.log(`📊 [TRIGGER] Status atualizado: completed (já cadastrado)`);
          } else {
            await updateStatus(
              registration_id, 
              'completed', 
              `Cliente cadastrado no Atak com sucesso (ID: ${atakResult.customerId})`
            );
            console.log(`📊 [TRIGGER] Status atualizado: completed (novo cadastro)`);
          }
        } else {
          await updateStatus(registration_id, 'completed', 'Cliente cadastrado no Atak com sucesso');
          console.log(`📊 [TRIGGER] Status atualizado: completed`);
        }
      } else {
        // Erro no cadastro Atak - mas não falha o processo completo
        console.error(`❌ [TRIGGER] Erro ao cadastrar no Atak: ${atakResult.error}`);
        
        // Salvar erro mesmo assim
        await atakService.saveAtakResponse(cnpj, atakResult, registration_id);
        
        // Atualizar status com erro do Atak
        await updateStatus(
          registration_id, 
          'completed', 
          `Consulta concluída, mas falha no cadastro Atak: ${atakResult.error || 'Erro desconhecido'}`
        );
        console.log(`📊 [TRIGGER] Status atualizado: completed (com erro no Atak)`);
      }
    } catch (atakError) {
      console.error(`❌ [TRIGGER] Erro ao processar cadastro Atak:`, atakError);
      
      // Salvar erro
      try {
        const atakDbService = new DatabaseService(dbConfig);
        const atakService = new AtakService(atakDbService);
        await atakService.saveAtakResponse(cnpj, {
          success: false,
          error: atakError instanceof Error ? atakError.message : 'Erro desconhecido no Atak'
        }, registration_id);
      } catch (saveError) {
        console.error(`❌ [TRIGGER] Erro ao salvar erro do Atak:`, saveError);
      }
      
      // Atualizar status com erro
      await updateStatus(
        registration_id, 
        'completed', 
        `Consulta concluída, mas falha no cadastro Atak: ${atakError instanceof Error ? atakError.message : 'Erro desconhecido'}`
      );
      console.log(`📊 [TRIGGER] Status atualizado: completed (com erro no Atak)`);
    }

    console.log(`🎉 [TRIGGER] Processamento completo finalizado para CNPJ: ${cnpj}`);
    
    // Log resumo do Atak
    if (atakResult.success && atakResult.customerId) {
      console.log(`   📋 [TRIGGER] Atak - Cliente ID: ${atakResult.customerId}`);
      if (atakResult.error && atakResult.error.includes('já cadastrado')) {
        console.log(`   ℹ️  [TRIGGER] Cliente já estava cadastrado no Atak`);
      } else {
        console.log(`   ✅ [TRIGGER] Cliente cadastrado com sucesso no Atak`);
      }
    } else if (!atakResult.success) {
      console.log(`   ⚠️  [TRIGGER] Atak - Erro: ${atakResult.error || 'Erro desconhecido'}`);
    }

  } catch (error) {
    console.error(`❌ [TRIGGER] Erro ao processar CNPJ ${cnpj}:`, error);
    
    // Tenta atualizar o status para falhou
    await updateStatus(
      registration_id, 
      'failed', 
      'Erro no processamento', 
      error instanceof Error ? error.message : 'Erro desconhecido'
    );
    
    process.exit(1);
  }
}

// Executar se for chamado diretamente
if (require.main === module) {
  const registration_id = parseInt(process.argv[2]);
  const cnpj = process.argv[3];
  
  if (!registration_id || !cnpj) {
    console.error('❌ Parâmetros não fornecidos');
    console.log('Uso: ts-node trigger-cnpj-query.ts <REGISTRATION_ID> <CNPJ>');
    process.exit(1);
  }

  processCNPJ(registration_id, cnpj);
}

export { processCNPJ };

