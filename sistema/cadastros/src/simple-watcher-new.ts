import { SPCBot } from './services/spcBot';
import { TessService } from './services/tessService';
import { DatabaseServiceNew } from './services/databaseServiceNew';
import { TessDataParserNew } from './services/tessDataParserNew';
import { Logger } from './utils/logger';
import { DatabaseConfig } from './services/databaseServiceNew';

export class SimpleWatcherNew {
  private bot: SPCBot;
  private tessService: TessService;
  private databaseService: DatabaseServiceNew | null = null;

  constructor(
    spcConfig: any,
    tessConfig: any,
    databaseConfig: DatabaseConfig
  ) {
    this.bot = new SPCBot(spcConfig);
    this.tessService = new TessService(tessConfig);
    this.databaseService = new DatabaseServiceNew(databaseConfig);
  }

  /**
   * Inicia o processo de monitoramento e processamento
   */
  async start(): Promise<void> {
    try {
      console.log('🚀 Iniciando Simple Watcher (Novo Schema)...');
      
      // Conecta ao banco de dados
      if (this.databaseService) {
        await this.databaseService.connect();
      }

      // Inicia o bot SPC
      await this.bot.start();
      
      console.log('✅ Simple Watcher iniciado com sucesso!');
      Logger.success('Simple Watcher iniciado');
    } catch (error) {
      console.error('❌ Erro ao iniciar Simple Watcher:', error);
      Logger.error('Erro ao iniciar Simple Watcher', { error: error instanceof Error ? error.message : 'Erro desconhecido' });
      throw error;
    }
  }

  /**
   * Para o processo de monitoramento
   */
  async stop(): Promise<void> {
    try {
      console.log('🛑 Parando Simple Watcher...');
      
      // Para o bot SPC
      await this.bot.stop();
      
      // Desconecta do banco de dados
      if (this.databaseService) {
        await this.databaseService.disconnect();
      }
      
      console.log('✅ Simple Watcher parado com sucesso!');
      Logger.success('Simple Watcher parado');
    } catch (error) {
      console.error('❌ Erro ao parar Simple Watcher:', error);
      Logger.error('Erro ao parar Simple Watcher', { error: error instanceof Error ? error.message : 'Erro desconhecido' });
    }
  }

  /**
   * Processa um CNPJ específico
   */
  async processarCNPJ(cnpj: string): Promise<void> {
    try {
      console.log(`🔍 Processando CNPJ: ${cnpj}`);
      
      // 1. Baixa o PDF do SPC
      const pdfResult = await this.bot.queryCNPJ(cnpj);
      
      if (!pdfResult.success || !pdfResult.filePath) {
        throw new Error(pdfResult.error || 'Erro ao baixar PDF do SPC');
      }

      console.log(`✅ PDF baixado: ${pdfResult.fileName}`);

      // 2. Processa com TESS
      const tessResult = await this.tessService.processFile(pdfResult.filePath, pdfResult.fileName!);
      
      if (!tessResult.success || !tessResult.response) {
        throw new Error(tessResult.error || 'Erro ao processar com TESS');
      }

      console.log(`✅ TESS processado: ${tessResult.fileName}`);

      // 3. Insere dados no banco usando o novo schema
      await this.inserirDadosNoBanco(cnpj, pdfResult.fileName!, tessResult.response, tessResult.credits || 0);

      console.log(`✅ CNPJ ${cnpj} processado com sucesso!`);

    } catch (error) {
      console.error(`❌ Erro ao processar CNPJ ${cnpj}:`, error);
      Logger.error('Erro ao processar CNPJ', { 
        cnpj, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
      throw error;
    }
  }

  /**
   * Insere dados no banco de dados usando o novo schema
   */
  private async inserirDadosNoBanco(cnpj: string, fileName: string, respostaTESS: string, creditosUtilizados: number): Promise<void> {
    try {
      console.log('💾 Inserindo dados no banco de dados (Novo Schema)...');
      
      // Conecta ao banco se necessário
      if (!this.databaseService?.isConnected()) {
        await this.databaseService?.connect();
      }

      // Extrai dados estruturados da resposta TESS usando o novo parser
      const dadosExtraidos = TessDataParserNew.extrairDadosTESSCompletos(respostaTESS, cnpj);

      // Insere dados completos no banco usando o novo schema
      const resultado = await this.databaseService!.inserirDadosTESSCompletos(dadosExtraidos);

      console.log(`✅ Dados inseridos no banco com sucesso! (Novo Schema)`);
      console.log(`   - Consulta ID: ${resultado.consultaId}`);
      console.log(`   - Empresa ID: ${resultado.empresaId}`);
      console.log(`   - Sócios: ${resultado.sociosIds.length}`);
      console.log(`   - Quadro Administrativo: ${resultado.quadroIds.length}`);
      console.log(`   - Consultas Realizadas: ${resultado.consultasRealizadasIds.length}`);
      console.log(`   - Tipos de Garantias: ${resultado.tiposGarantiasIds.length}`);

      Logger.success('Dados TESS inseridos no banco (Novo Schema)', {
        consultaId: resultado.consultaId,
        empresaId: resultado.empresaId,
        sociosCount: resultado.sociosIds.length,
        quadroCount: resultado.quadroIds.length,
        consultasCount: resultado.consultasRealizadasIds.length
      });

    } catch (error) {
      console.error('❌ Erro ao inserir dados no banco:', error);
      Logger.error('Erro ao inserir dados no banco (Novo Schema)', { 
        cnpj, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
      throw error;
    }
  }

  /**
   * Processa múltiplos CNPJs
   */
  async processarCNPJs(cnpjs: string[]): Promise<void> {
    console.log(`🔄 Processando ${cnpjs.length} CNPJs...`);
    
    let sucessos = 0;
    let falhas = 0;

    for (let i = 0; i < cnpjs.length; i++) {
      const cnpj = cnpjs[i];
      try {
        console.log(`\n📋 Processando ${i + 1}/${cnpjs.length}: ${cnpj}`);
        await this.processarCNPJ(cnpj);
        sucessos++;
        console.log(`✅ CNPJ ${cnpj} processado com sucesso!`);
      } catch (error) {
        falhas++;
        console.error(`❌ Falha ao processar CNPJ ${cnpj}:`, error);
      }
    }

    console.log(`\n📊 Resumo do processamento:`);
    console.log(`   - Total: ${cnpjs.length}`);
    console.log(`   - Sucessos: ${sucessos}`);
    console.log(`   - Falhas: ${falhas}`);

    Logger.info('Processamento em lote concluído', {
      total: cnpjs.length,
      sucessos,
      falhas
    });
  }
}
