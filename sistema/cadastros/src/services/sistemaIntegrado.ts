import { SPCBot } from './services/spcBot';
import { TessService } from './services/tessService';
import { DatabaseService } from './services/databaseService';
import { TessDataParser } from './services/tessDataParser';
import { config, tessConfig, validateConfig, validateTessConfig } from '../config';
import { CNPJCache } from '../utils/cnpjCache';
import { Logger } from '../utils/logger';
import { FileUtils } from '../utils/fileUtils';
import * as path from 'path';

export interface SistemaIntegradoConfig {
  // Configurações SPC
  spc: {
    url: string;
    operador: string;
    senha: string;
    palavraSecreta: string;
    downloadPath: string;
    headless: boolean;
    browserTimeout: number;
    debug: boolean;
    cnpjCacheExpirationHours: number;
  };
  
  // Configurações TESS
  tess: {
    apiKey: string;
    baseUrl: string;
    agentId: string;
    model: string;
    temperature: number;
    outputPath: string;
  };
  
  // Configurações Banco de Dados
  database: {
    server: string;
    database: string;
    user: string;
    password: string;
    port?: number;
    options?: {
      encrypt?: boolean;
      trustServerCertificate?: boolean;
    };
  };
  
  // Configurações Gerais
  general: {
    excelFile?: string;
    excelSheet?: string;
    excelCnpjColumn?: string;
    delayBetweenQueries: number; // segundos
  };
}

export class SistemaIntegradoSPCTESS {
  private bot: SPCBot;
  private tessService: TessService;
  private databaseService: DatabaseService;
  private isProcessing: boolean = false;
  private processedCNPJs: Set<string> = new Set();

  constructor(config: SistemaIntegradoConfig) {
    // Inicializa SPC Bot
    this.bot = new SPCBot({
      url: config.spc.url,
      operador: config.spc.operador,
      senha: config.spc.senha,
      palavraSecreta: config.spc.palavraSecreta,
      downloadPath: config.spc.downloadPath,
      cnpjToQuery: '', // Será definido dinamicamente
      headless: config.spc.headless,
      browserTimeout: config.spc.browserTimeout,
      debug: config.spc.debug,
      cnpjCacheExpirationHours: config.spc.cnpjCacheExpirationHours
    });

    // Inicializa TESS Service
    this.tessService = new TessService({
      apiKey: config.tess.apiKey,
      baseUrl: config.tess.baseUrl,
      agentId: config.tess.agentId,
      model: config.tess.model,
      temperature: config.tess.temperature
    });

    // Inicializa Database Service
    this.databaseService = new DatabaseService(config.database);

    // Inicializa sistemas
    Logger.initialize();
    CNPJCache.initialize();
    FileUtils.ensureDownloadDirectory(config.spc.downloadPath);
    FileUtils.ensureDownloadDirectory(config.tess.outputPath);
  }

  /**
   * Inicializa o sistema integrado
   */
  async inicializar(): Promise<void> {
    try {
      console.log('🚀 Sistema Integrado SPC + TESS + Banco de Dados');
      console.log('================================================');
      
      // Valida configurações
      console.log('📋 Validando configurações...');
      validateConfig();
      validateTessConfig();
      console.log('✅ Configurações validadas');

      // Testa conexão com banco de dados
      console.log('🔌 Testando conexão com banco de dados...');
      const dbConnected = await this.databaseService.testConnection();
      if (!dbConnected) {
        throw new Error('Falha na conexão com banco de dados');
      }
      console.log('✅ Banco de dados conectado');

      console.log('🎯 Sistema inicializado com sucesso!\n');

    } catch (error) {
      console.error('❌ Erro ao inicializar sistema:', error);
      Logger.error('Erro na inicialização do sistema', { error: error instanceof Error ? error.message : 'Erro desconhecido' });
      throw error;
    }
  }

  /**
   * Processa um CNPJ completo (SPC + TESS + Banco)
   */
  async processarCNPJCompleto(cnpj: string, razaoSocial?: string): Promise<{
    success: boolean;
    cnpj: string;
    consultaTESSId?: number;
    empresaId?: number;
    error?: string;
  }> {
    if (this.isProcessing) {
      return {
        success: false,
        cnpj,
        error: 'Sistema já está processando outro CNPJ'
      };
    }

    this.isProcessing = true;

    try {
      console.log(`\n🔄 Processando CNPJ completo: ${cnpj}${razaoSocial ? ` - ${razaoSocial}` : ''}`);
      console.log('================================================');

      // 1. Verifica cache
      console.log('💾 Verificando cache...');
      const cached = CNPJCache.isCached(cnpj, config.cnpjCacheExpirationHours);
      if (cached) {
        console.log('✅ CNPJ encontrado no cache - pulando consulta SPC');
        return {
          success: true,
          cnpj,
          error: 'CNPJ já processado (encontrado no cache)'
        };
      }

      // 2. Consulta SPC
      console.log('🔍 Consultando SPC...');
      const spcResult = await this.bot.executeQuery(cnpj);
      
      if (!spcResult.success || !spcResult.filePath) {
        console.log(`❌ Falha na consulta SPC: ${spcResult.error}`);
        
        // Adiciona falha ao cache
        CNPJCache.addToCache(cnpj, '', '', false, config.cnpjCacheExpirationHours, spcResult.error);
        
        return {
          success: false,
          cnpj,
          error: `Falha na consulta SPC: ${spcResult.error}`
        };
      }

      console.log(`✅ Consulta SPC realizada com sucesso`);
      console.log(`📄 Arquivo PDF: ${spcResult.fileName}`);

      // 3. Processa com TESS
      console.log('🤖 Processando PDF com TESS AI...');
      const tessResult = await this.tessService.processPDF(
        spcResult.filePath, 
        `Extraia todos os dados estruturados da consulta CNPJ: ${cnpj}. Inclua dados da empresa, sócios, participações societárias e quadro administrativo.`
      );

      if (!tessResult.success || !tessResult.response) {
        console.log(`❌ Falha no processamento TESS: ${tessResult.error}`);
        
        // Adiciona falha ao cache
        CNPJCache.addToCache(cnpj, spcResult.fileName || '', spcResult.filePath, false, config.cnpjCacheExpirationHours, `TESS: ${tessResult.error}`);
        
        return {
          success: false,
          cnpj,
          error: `Falha no processamento TESS: ${tessResult.error}`
        };
      }

      console.log(`✅ TESS AI processou com sucesso`);
      console.log(`💳 Créditos utilizados: ${tessResult.credits}`);
      console.log(`📄 Resposta: ${tessResult.response.substring(0, 200)}...`);

      // 4. Salva resposta TESS
      console.log('💾 Salvando resposta TESS...');
      await this.tessService.saveResponses([tessResult], tessConfig.outputPath);

      // 5. Extrai dados estruturados
      console.log('🔍 Extraindo dados estruturados...');
      const dadosExtraidos = TessDataParser.extrairDadosEmpresa(tessResult.response, cnpj);

      // 6. Insere no banco de dados
      console.log('💾 Inserindo dados no banco...');
      const dbResult = await this.databaseService.inserirDadosTESSCompletos({
        consulta: {
          cnpj: cnpj,
          razaoSocial: razaoSocial || dadosExtraidos.empresa.razaoSocial,
          nomeFantasia: dadosExtraidos.empresa.nomeFantasia,
          situacaoCadastral: dadosExtraidos.empresa.situacaoCadastral,
          dataConsulta: new Date(),
          arquivoPDF: spcResult.fileName || '',
          respostaTESS: tessResult.response,
          creditosUtilizados: tessResult.credits
        },
        empresa: dadosExtraidos.empresa,
        socios: dadosExtraidos.socios,
        participacoes: dadosExtraidos.participacoes,
        quadroAdministrativo: dadosExtraidos.quadroAdministrativo
      });

      // 7. Adiciona ao cache
      CNPJCache.addToCache(
        cnpj,
        spcResult.fileName || '',
        spcResult.filePath,
        true,
        config.cnpjCacheExpirationHours
      );

      this.processedCNPJs.add(cnpj);

      console.log(`\n✅ CNPJ processado com sucesso!`);
      console.log(`   - Consulta TESS ID: ${dbResult.consultaTESSId}`);
      console.log(`   - Empresa ID: ${dbResult.empresaId}`);
      console.log(`   - Consulta Empresa ID: ${dbResult.consultaEmpresaId}`);
      console.log(`   - Sócios inseridos: ${dbResult.sociosIds.length}`);
      console.log(`   - Participações inseridas: ${dbResult.participacoesIds.length}`);
      console.log(`   - Quadro administrativo inserido: ${dbResult.quadroIds.length}`);

      Logger.success('CNPJ processado completamente', {
        cnpj,
        consultaTESSId: dbResult.consultaTESSId,
        empresaId: dbResult.empresaId,
        sociosCount: dbResult.sociosIds.length,
        participacoesCount: dbResult.participacoesIds.length,
        quadroCount: dbResult.quadroIds.length
      });

      return {
        success: true,
        cnpj,
        consultaTESSId: dbResult.consultaTESSId,
        empresaId: dbResult.empresaId
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error(`❌ Erro ao processar CNPJ ${cnpj}:`, errorMessage);
      
      Logger.error('Erro no processamento completo do CNPJ', { 
        cnpj, 
        error: errorMessage 
      });

      return {
        success: false,
        cnpj,
        error: errorMessage
      };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Processa múltiplos CNPJs
   */
  async processarCNPJs(cnpjs: Array<{cnpj: string, razaoSocial?: string}>): Promise<{
    total: number;
    sucessos: number;
    falhas: number;
    resultados: Array<{
      cnpj: string;
      success: boolean;
      consultaTESSId?: number;
      empresaId?: number;
      error?: string;
    }>;
  }> {
    console.log(`\n📊 Processando ${cnpjs.length} CNPJs...`);
    console.log('================================================');

    const resultados: Array<{
      cnpj: string;
      success: boolean;
      consultaTESSId?: number;
      empresaId?: number;
      error?: string;
    }> = [];

    let sucessos = 0;
    let falhas = 0;

    for (let i = 0; i < cnpjs.length; i++) {
      const cnpjData = cnpjs[i];
      
      console.log(`\n🔄 Processando ${i + 1}/${cnpjs.length}: ${cnpjData.cnpj}${cnpjData.razaoSocial ? ` - ${cnpjData.razaoSocial}` : ''}`);
      
      const resultado = await this.processarCNPJCompleto(cnpjData.cnpj, cnpjData.razaoSocial);
      resultados.push(resultado);

      if (resultado.success) {
        sucessos++;
        console.log(`✅ Sucesso: ${cnpjData.cnpj}`);
      } else {
        falhas++;
        console.log(`❌ Falha: ${cnpjData.cnpj} - ${resultado.error}`);
      }

      // Aguarda entre consultas
      if (i < cnpjs.length - 1) {
        console.log(`⏳ Aguardando ${config.delayBetweenQueries || 3} segundos...`);
        await new Promise(resolve => setTimeout(resolve, (config.delayBetweenQueries || 3) * 1000));
      }
    }

    console.log(`\n📈 Resumo do Processamento:`);
    console.log(`   - Total: ${cnpjs.length}`);
    console.log(`   - Sucessos: ${sucessos}`);
    console.log(`   - Falhas: ${falhas}`);
    console.log(`   - Taxa de sucesso: ${((sucessos / cnpjs.length) * 100).toFixed(1)}%`);

    Logger.success('Processamento em lote concluído', {
      total: cnpjs.length,
      sucessos,
      falhas,
      taxaSucesso: ((sucessos / cnpjs.length) * 100).toFixed(1) + '%'
    });

    return {
      total: cnpjs.length,
      sucessos,
      falhas,
      resultados
    };
  }

  /**
   * Busca dados consolidados de uma empresa
   */
  async buscarDadosConsolidados(cnpj: string): Promise<any> {
    try {
      console.log(`🔍 Buscando dados consolidados: ${cnpj}`);
      const dados = await this.databaseService.buscarDadosConsolidados(cnpj);
      console.log(`✅ Dados encontrados: ${dados.length} registros`);
      return dados;
    } catch (error) {
      console.error(`❌ Erro ao buscar dados: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      throw error;
    }
  }

  /**
   * Lista empresas para análise
   */
  async listarEmpresasParaAnalise(): Promise<any[]> {
    try {
      console.log('📋 Listando empresas para análise...');
      const empresas = await this.databaseService.listarEmpresasParaAnalise();
      console.log(`✅ Encontradas ${empresas.length} empresas`);
      return empresas;
    } catch (error) {
      console.error(`❌ Erro ao listar empresas: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      throw error;
    }
  }

  /**
   * Fecha conexões
   */
  async fechar(): Promise<void> {
    try {
      console.log('🔌 Fechando conexões...');
      await this.databaseService.disconnect();
      console.log('✅ Sistema fechado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao fechar sistema:', error);
    }
  }

  /**
   * Obtém estatísticas do processamento
   */
  getStats(): {
    totalProcessed: number;
    processedCNPJs: string[];
    isProcessing: boolean;
  } {
    return {
      totalProcessed: this.processedCNPJs.size,
      processedCNPJs: Array.from(this.processedCNPJs),
      isProcessing: this.isProcessing
    };
  }
}
