import chokidar from 'chokidar';
import { ExcelUtils, CNPJData } from './utils/excelUtils';
import { SPCBot } from './services/spcBot';
import { TessService } from './services/tessService';
import { CNPJAService } from './services/cnpjaService';
import { DatabaseServiceRobust } from './services/databaseServiceRobust';
import { TessDataParserNew } from './services/tessDataParserNew';
import { CNPJAFileUtils } from './utils/cnpjaFileUtils';
import { config, tessConfig, cnpjaConfig, validateTessConfig, validateCNPJAConfig } from './config';
import { CNPJCache } from './utils/cnpjCache';
import { Logger } from './utils/logger';
import * as path from 'path';

export class SimpleWatcher {
  private bot: SPCBot;
  private tessService: TessService;
  private cnpjaService: CNPJAService | null = null;
  private cnpjaFileUtils: CNPJAFileUtils;
  private databaseService: DatabaseServiceRobust | null = null;
  private isProcessing: boolean = false;
  private processedCNPJs: Set<string> = new Set();

  constructor() {
    this.bot = new SPCBot({
      url: config.url,
      operador: config.operador,
      senha: config.senha,
      palavraSecreta: config.palavraSecreta,
      downloadPath: config.downloadPath,
      cnpjToQuery: '', // Será definido dinamicamente
      headless: config.headless,
      browserTimeout: config.browserTimeout,
      debug: config.debug,
      cnpjCacheExpirationHours: config.cnpjCacheExpirationHours
    });

    // Inicializa serviço TESS
    this.tessService = new TessService(tessConfig);
    
    // Inicializa serviço CNPJÁ (opcional)
    this.initializeCNPJA();
    
    // Inicializa utilitário de arquivos CNPJÁ
    this.cnpjaFileUtils = new CNPJAFileUtils('./cnpja_responses');
    
    // Inicializa serviço de banco de dados (opcional)
    this.initializeDatabase();
    
    // Inicializa sistemas
    Logger.initialize();
    CNPJCache.initialize();
  }

  /**
   * Inicializa o serviço CNPJÁ (opcional)
   */
  private initializeCNPJA(): void {
    try {
      // Verifica se as configurações do CNPJÁ estão disponíveis
      if (cnpjaConfig.apiKey && cnpjaConfig.baseUrl) {
        this.cnpjaService = new CNPJAService(cnpjaConfig);
        console.log('✅ Serviço CNPJÁ configurado');
      } else {
        console.log('⚠️  CNPJÁ não configurado - pulando integração');
      }
    } catch (error) {
      console.log('⚠️  Erro ao configurar CNPJÁ:', error);
    }
  }

  /**
   * Inicializa o serviço de banco de dados (opcional)
   */
  private initializeDatabase(): void {
    try {
      // Verifica se as configurações do banco estão disponíveis
      const dbConfig = {
        server: process.env.DB_SERVER || 'localhost',
        database: process.env.DB_DATABASE || 'consultas_tess',
        user: process.env.DB_USER || 'sa',
        password: process.env.DB_PASSWORD || '',
        port: parseInt(process.env.DB_PORT || '1433'),
        options: {
          encrypt: process.env.DB_ENCRYPT === 'true',
          trustServerCertificate: process.env.DB_TRUST_CERT === 'true'
        }
      };

      // Só inicializa se pelo menos o servidor estiver configurado
      if (dbConfig.server && dbConfig.database && dbConfig.user && dbConfig.password) {
        this.databaseService = new DatabaseServiceRobust(dbConfig);
        console.log('✅ Serviço de banco de dados configurado');
      } else {
        console.log('⚠️  Banco de dados não configurado - dados não serão salvos no banco');
        console.log('💡 Configure as variáveis DB_* no arquivo .env para habilitar');
      }
    } catch (error) {
      console.log('⚠️  Erro ao configurar banco de dados:', error);
      this.databaseService = null;
    }
  }

  public start(): void {
    console.log('🚀 SPC CNPJ Bot - Modo Simples + TESS AI + Banco de Dados');
    console.log('📁 Aguardando arquivo Excel com CNPJs...');
    console.log('💡 Adicione CNPJs no arquivo Excel e salve para processar');
    console.log('🤖 PDFs serão processados automaticamente pela TESS AI');
    console.log('💾 Dados serão salvos no banco de dados (se configurado)');
    console.log('⏹️  Pressione Ctrl+C para parar\n');

    // Valida configurações TESS
    try {
      validateTessConfig();
      console.log('✅ Configurações TESS validadas');
    } catch (error) {
      console.log('⚠️  Configurações TESS não encontradas - processamento TESS desabilitado');
      console.log('💡 Configure as variáveis TESS_* no arquivo .env para habilitar');
    }

    // Watch do arquivo Excel
    const excelFile = config.excelFile || './cnpjs.xlsx';
    
    chokidar.watch(excelFile, {
      persistent: true,
      ignoreInitial: false
    }).on('change', (filePath) => {
      console.log(`📝 Arquivo alterado: ${filePath}`);
      this.processExcelFile(filePath);
    }).on('add', (filePath) => {
      console.log(`📄 Arquivo adicionado: ${filePath}`);
      this.processExcelFile(filePath);
    });

    // Processa arquivo inicial se existir
    if (require('fs').existsSync(excelFile)) {
      this.processExcelFile(excelFile);
    }
  }

  private async processExcelFile(filePath: string): Promise<void> {
    if (this.isProcessing) {
      console.log('⏳ Já processando, aguarde...');
      return;
    }

    this.isProcessing = true;

    try {
      console.log('\n📊 Lendo arquivo Excel...');
      const cnpjs = ExcelUtils.readCNPJsFromExcel(
        filePath,
        config.excelSheet,
        config.excelCnpjColumn
      );

      if (cnpjs.length === 0) {
        console.log('❌ Nenhum CNPJ válido encontrado');
        return;
      }

      console.log(`✅ Encontrados ${cnpjs.length} CNPJs`);
      
      // Verifica cache e filtra CNPJs não processados
      const newCNPJs: CNPJData[] = [];
      const cachedCNPJs: CNPJData[] = [];
      
      for (const cnpjData of cnpjs) {
        // Verifica se já foi processado nesta sessão
        if (this.processedCNPJs.has(cnpjData.cnpj)) {
          continue;
        }
        
        // Verifica se está no cache
        const cached = CNPJCache.isCached(cnpjData.cnpj, config.cnpjCacheExpirationHours);
        if (cached) {
          cachedCNPJs.push(cnpjData);
          this.processedCNPJs.add(cnpjData.cnpj);
        } else {
          newCNPJs.push(cnpjData);
        }
      }
      
      if (cachedCNPJs.length > 0) {
        console.log(`💾 ${cachedCNPJs.length} CNPJs encontrados no cache (não serão consultados):`);
        cachedCNPJs.forEach((cnpjData, index) => {
          console.log(`  ${index + 1}. ${cnpjData.cnpj}${cnpjData.razaoSocial ? ` - ${cnpjData.razaoSocial}` : ''}`);
        });
      }
      
      if (newCNPJs.length === 0) {
        console.log('ℹ️  Nenhum CNPJ novo para processar (todos estão em cache)');
        return;
      }

      console.log(`🆕 ${newCNPJs.length} CNPJs novos para processar:`);
      newCNPJs.forEach((cnpjData, index) => {
        console.log(`  ${index + 1}. ${cnpjData.cnpj}${cnpjData.razaoSocial ? ` - ${cnpjData.razaoSocial}` : ''}`);
      });

      // Processa cada CNPJ
      for (let i = 0; i < newCNPJs.length; i++) {
        const cnpjData = newCNPJs[i];
        
        console.log(`\n🔄 Processando ${i + 1}/${newCNPJs.length}: ${cnpjData.cnpj}${cnpjData.razaoSocial ? ` - ${cnpjData.razaoSocial}` : ''}`);
        
        try {
          const result = await this.bot.executeQuery(cnpjData.cnpj);
          
          if (result.success) {
            console.log(`✅ Sucesso: ${cnpjData.cnpj}`);
            console.log(`📁 Arquivo: ${result.fileName}`);
            
            // Processa o PDF com TESS AI
            if (result.filePath) {
              await this.processWithTESS(cnpjData.cnpj, result.filePath, result.fileName || '');
            }
            
            // Adiciona ao cache
            CNPJCache.addToCache(
              cnpjData.cnpj,
              result.fileName || '',
              result.filePath || '',
              true,
              config.cnpjCacheExpirationHours
            );
            
            this.processedCNPJs.add(cnpjData.cnpj);
          } else {
            console.log(`❌ Falha: ${cnpjData.cnpj} - ${result.error}`);
            
            // Adiciona falha ao cache também (para evitar tentar novamente imediatamente)
            CNPJCache.addToCache(
              cnpjData.cnpj,
              '',
              '',
              false,
              config.cnpjCacheExpirationHours,
              result.error
            );
            
            this.processedCNPJs.add(cnpjData.cnpj);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
          console.log(`❌ Erro: ${cnpjData.cnpj} - ${errorMessage}`);
          
          // Adiciona erro ao cache
          CNPJCache.addToCache(
            cnpjData.cnpj,
            '',
            '',
            false,
            config.cnpjCacheExpirationHours,
            errorMessage
          );
          
          this.processedCNPJs.add(cnpjData.cnpj);
        }

        // Aguarda entre consultas
        if (i < newCNPJs.length - 1) {
          console.log('⏳ Aguardando 3 segundos...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      console.log(`\n✅ Processamento concluído! Total processados: ${this.processedCNPJs.size}`);
      console.log('📁 Aguardando novos CNPJs...\n');

    } catch (error) {
      console.error('❌ Erro ao processar arquivo:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Processa o PDF com TESS AI e insere no banco de dados
   */
  private async processWithTESS(cnpj: string, filePath: string, fileName: string): Promise<void> {
    try {
      // Verifica se TESS está configurado
      if (!tessConfig.apiKey || !tessConfig.agentId) {
        console.log('⚠️  TESS AI não configurado - pulando processamento');
        return;
      }

      console.log(`🤖 Processando PDF com TESS AI: ${fileName}`);
      
      // Processa o PDF com TESS
      const tessResult = await this.tessService.processPDF(filePath, `Extraia todos os dados estruturados da consulta CNPJ: ${cnpj}. Inclua dados da empresa, sócios, participações societárias e quadro administrativo.`);
      
      if (tessResult.success) {
        console.log(`✅ TESS AI processou com sucesso: ${fileName}`);
        console.log(`💳 Créditos utilizados: ${tessResult.credits}`);
        console.log(`📄 Resposta: ${tessResult.response?.substring(0, 100)}...`);
        
        // Salva a resposta da TESS
        console.log('💾 Salvando resposta da TESS...');
        await this.tessService.saveResponses([tessResult], tessConfig.outputPath);
        console.log(`📁 Resposta salva em: ${tessConfig.outputPath}`);

        // 2. CONSULTA CNPJÁ
        console.log(`\n🏢 Consultando CNPJÁ: ${cnpj}`);
        await this.processWithCNPJA(cnpj, tessResult.response || '');
        
        // 3. Insere dados no banco de dados (se configurado)
        if (this.databaseService) {
          await this.inserirDadosNoBanco(cnpj, fileName, tessResult.response || '', tessResult.credits || 0);
        }
      } else {
        console.log(`❌ Falha no processamento TESS: ${tessResult.error}`);
      }
      
    } catch (error) {
      console.log(`❌ Erro no processamento TESS: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Processa com CNPJÁ
   */
  private async processWithCNPJA(cnpj: string, tessResponse: string): Promise<void> {
    try {
      // Verifica se CNPJÁ está configurado
      if (!this.cnpjaService) {
        console.log('⚠️  CNPJÁ não configurado - pulando consulta');
        return;
      }

      // Consulta CNPJÁ (já salva o JSON automaticamente)
      const cnpjaResult = await this.cnpjaService.queryCompany(cnpj);
      
      if (cnpjaResult.success) {
        console.log(`✅ CNPJÁ consultado com sucesso`);
        console.log(`🏢 Empresa: ${cnpjaResult.data?.company.name || 'N/A'}`);
        console.log(`📍 Estado: ${cnpjaResult.data?.address.state || 'N/A'}`);
        console.log(`🏭 SUFRAMA: ${cnpjaResult.data?.suframa?.length || 0} inscrições`);
        console.log(`💰 Custo: ${cnpjaResult.data?.suframa?.length ? '4 ₪' : '3 ₪'}`);
        
        // Extrai dados do arquivo salvo para inserção no banco
        const latestFile = this.cnpjaFileUtils.readLatestCNPJAFile(cnpj);
        if (latestFile) {
          const dbData = this.cnpjaFileUtils.extractDatabaseData(latestFile);
          if (dbData) {
            console.log(`📊 Dados CNPJÁ extraídos para banco: ${dbData.razao_social}`);
            // Aqui você pode adicionar a lógica para inserir no banco se necessário
          }
        }
      } else {
        console.log(`❌ Falha na consulta CNPJÁ: ${cnpjaResult.error}`);
      }
      
    } catch (error) {
      console.log(`❌ Erro na consulta CNPJÁ: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Insere dados no banco de dados
   */
  private async inserirDadosNoBanco(cnpj: string, fileName: string, respostaTESS: string, creditosUtilizados: number): Promise<void> {
    try {
      console.log('💾 Inserindo dados no banco de dados (Versão Robusta)...');
      
      // Conecta ao banco se necessário
      if (!this.databaseService?.isConnected()) {
        await this.databaseService?.connect();
      }

      // Extrai dados estruturados da resposta TESS usando o novo parser
      const dadosExtraidos = TessDataParserNew.extrairDadosTESSCompletos(respostaTESS, cnpj);
      
      // Extrai dados do CNPJÁ se disponível
      let dadosCNPJA = null;
      const latestCNPJAFile = this.cnpjaFileUtils.readLatestCNPJAFile(cnpj);
      if (latestCNPJAFile) {
        dadosCNPJA = this.cnpjaFileUtils.extractDatabaseData(latestCNPJAFile);
        console.log('📊 Dados CNPJÁ encontrados e extraídos');
        
        // Mescla dados do CNPJÁ com dados da TESS
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
          
          // Atualiza coordenadas no endereço
          if (dadosCNPJA.latitude && dadosCNPJA.longitude) {
            dadosExtraidos.endereco.latitude = dadosCNPJA.latitude;
            dadosExtraidos.endereco.longitude = dadosCNPJA.longitude;
          }
          
          console.log('🔄 Dados CNPJÁ mesclados com dados TESS');
        }
      } else {
        console.log('⚠️  Dados CNPJÁ não encontrados');
      }

      // Insere dados completos no banco usando o novo schema
      const resultado = await this.databaseService!.inserirDadosTESSCompletos(dadosExtraidos);

      console.log(`✅ Dados inseridos no banco com sucesso! (Versão Robusta)`);
      console.log(`   - Consulta ID: ${resultado.consultaId}`);
      console.log(`   - Empresa ID: ${resultado.empresaId}`);
      console.log(`   - Sócios: ${resultado.sociosIds.length}`);
      console.log(`   - Quadro Administrativo: ${resultado.quadroIds.length}`);
      console.log(`   - Consultas Realizadas: ${resultado.consultasRealizadasIds.length}`);
      console.log(`   - Tipos de Garantias: ${resultado.tiposGarantiasIds.length}`);

    } catch (error) {
      console.log(`❌ Erro ao inserir dados no banco: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      // Não falha o processamento se houver erro no banco
    }
  }

  public getStats(): { totalProcessed: number; processedCNPJs: string[] } {
    return {
      totalProcessed: this.processedCNPJs.size,
      processedCNPJs: Array.from(this.processedCNPJs)
    };
  }
}
