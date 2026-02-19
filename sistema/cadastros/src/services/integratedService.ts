import { SPCBot } from './spcBot';
import { TessService } from './tessService';
import { CNPJAService } from './cnpjaService';
import { DatabaseService } from './databaseService';
import { SPCConfig, TessConfig, CNPJAConfig } from '../types';
import { Logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

export interface IntegratedProcessResult {
  success: boolean;
  cnpj: string;
  spcResult?: {
    success: boolean;
    filePath?: string;
    error?: string;
  };
  tessResult?: {
    success: boolean;
    response?: string;
    error?: string;
  };
  cnpjaResult?: {
    success: boolean;
    data?: any;
    error?: string;
  };
  databaseResult?: {
    success: boolean;
    error?: string;
  };
  timestamp: Date;
  totalDuration: number;
}

export class IntegratedService {
  private spcBot: SPCBot;
  private tessService: TessService;
  private cnpjaService: CNPJAService;
  private databaseService: DatabaseService;

  constructor(
    spcConfig: SPCConfig,
    tessConfig: TessConfig,
    cnpjaConfig: CNPJAConfig,
    databaseConfig: any
  ) {
    this.spcBot = new SPCBot(spcConfig);
    this.tessService = new TessService(tessConfig);
    this.cnpjaService = new CNPJAService(cnpjaConfig);
    this.databaseService = new DatabaseService(databaseConfig);
  }

  /**
   * Executa o processo completo: SPC -> TESS -> CNPJÁ -> Banco de Dados
   */
  async processCNPJ(cnpj: string): Promise<IntegratedProcessResult> {
    const startTime = Date.now();
    const result: IntegratedProcessResult = {
      success: false,
      cnpj,
      timestamp: new Date(),
      totalDuration: 0
    };

    try {
      console.log(`\n🚀 Iniciando processamento completo para CNPJ: ${cnpj}`);
      Logger.initialize();

      // ETAPA 1: Consulta no SPC
      console.log('\n📋 ETAPA 1: Consulta no SPC...');
      const spcStartTime = Date.now();
      
      try {
        const spcQueryResult = await this.spcBot.executeQuery(cnpj);
        result.spcResult = {
          success: spcQueryResult.success,
          filePath: spcQueryResult.filePath,
          error: spcQueryResult.error
        };

        if (!spcQueryResult.success) {
          throw new Error(`Falha na consulta SPC: ${spcQueryResult.error}`);
        }

        console.log(`✅ SPC: PDF gerado em ${Date.now() - spcStartTime}ms`);
        Logger.success(`Consulta SPC ${cnpj} concluída`, { filePath: spcQueryResult.filePath });

      } catch (error) {
        result.spcResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        };
        throw error;
      }

      // ETAPA 2: Processamento na TESS
      console.log('\n🤖 ETAPA 2: Processamento na TESS...');
      const tessStartTime = Date.now();

      try {
        if (!result.spcResult.filePath) {
          throw new Error('Arquivo PDF do SPC não encontrado');
        }

        const tessProcessResult = await this.tessService.processPDF(result.spcResult.filePath);
        result.tessResult = {
          success: tessProcessResult.success,
          response: tessProcessResult.response,
          error: tessProcessResult.error
        };

        if (!tessProcessResult.success) {
          throw new Error(`Falha no processamento TESS: ${tessProcessResult.error}`);
        }

        console.log(`✅ TESS: Processamento concluído em ${Date.now() - tessStartTime}ms`);
        Logger.success(`Processamento TESS ${cnpj} concluído`, { 
          credits: tessProcessResult.credits,
          responseLength: tessProcessResult.response?.length || 0
        });

      } catch (error) {
        result.tessResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        };
        throw error;
      }

      // ETAPA 3: Consulta no CNPJÁ
      console.log('\n🏢 ETAPA 3: Consulta no CNPJÁ...');
      const cnpjaStartTime = Date.now();

      try {
        const cnpjaQueryResult = await this.cnpjaService.queryCompany(cnpj);
        result.cnpjaResult = {
          success: cnpjaQueryResult.success,
          data: cnpjaQueryResult.data,
          error: cnpjaQueryResult.error
        };

        if (!cnpjaQueryResult.success) {
          console.log(`⚠️ CNPJÁ: ${cnpjaQueryResult.error} - Continuando sem dados do CNPJÁ`);
          // Não falha o processo se CNPJÁ falhar, apenas registra o erro
        } else {
          console.log(`✅ CNPJÁ: Dados obtidos em ${Date.now() - cnpjaStartTime}ms`);
          Logger.success(`Consulta CNPJÁ ${cnpj} concluída`, {
            companyName: cnpjaQueryResult.data?.name,
            registrations: cnpjaQueryResult.data?.registrations?.length || 0
          });
        }

      } catch (error) {
        result.cnpjaResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        };
        console.log(`⚠️ CNPJÁ: Erro - ${result.cnpjaResult.error} - Continuando sem dados do CNPJÁ`);
      }

      // ETAPA 4: Inserção no Banco de Dados
      console.log('\n💾 ETAPA 4: Inserção no Banco de Dados...');
      const databaseStartTime = Date.now();

      try {
        // Prepara os dados para inserção
        const databaseData = this.prepareDatabaseData(cnpj, result);
        
        const databaseInsertResult = await this.databaseService.insertCompanyData(databaseData);
        result.databaseResult = {
          success: databaseInsertResult.success,
          error: databaseInsertResult.error
        };

        if (!databaseInsertResult.success) {
          throw new Error(`Falha na inserção no banco: ${databaseInsertResult.error}`);
        }

        console.log(`✅ BANCO: Dados inseridos em ${Date.now() - databaseStartTime}ms`);
        Logger.success(`Inserção banco ${cnpj} concluída`, { 
          hasSPCData: !!result.spcResult.success,
          hasTessData: !!result.tessResult.success,
          hasCNPJAData: !!result.cnpjaResult.success
        });

      } catch (error) {
        result.databaseResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        };
        throw error;
      }

      // Processo concluído com sucesso
      result.success = true;
      result.totalDuration = Date.now() - startTime;

      console.log(`\n🎉 PROCESSO COMPLETO CONCLUÍDO para ${cnpj} em ${result.totalDuration}ms`);
      Logger.success(`Processo completo ${cnpj} concluído`, {
        duration: result.totalDuration,
        spcSuccess: result.spcResult?.success,
        tessSuccess: result.tessResult?.success,
        cnpjaSuccess: result.cnpjaResult?.success,
        databaseSuccess: result.databaseResult?.success
      });

      return result;

    } catch (error) {
      result.success = false;
      result.totalDuration = Date.now() - startTime;
      
      console.error(`\n❌ ERRO no processamento de ${cnpj}:`, error);
      Logger.error(`Erro no processo completo ${cnpj}`, { 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        duration: result.totalDuration
      });
      
      return result;
    }
  }

  /**
   * Processa múltiplos CNPJs
   */
  async processMultipleCNPJs(cnpjs: string[]): Promise<IntegratedProcessResult[]> {
    console.log(`\n🚀 Iniciando processamento em lote de ${cnpjs.length} CNPJs`);
    
    const results: IntegratedProcessResult[] = [];
    
    for (let i = 0; i < cnpjs.length; i++) {
      const cnpj = cnpjs[i];
      
      try {
        console.log(`\n📊 Processando ${i + 1}/${cnpjs.length}: ${cnpj}`);
        const result = await this.processCNPJ(cnpj);
        results.push(result);
        
        // Aguarda 2 segundos entre processamentos para respeitar rate limits
        if (i < cnpjs.length - 1) {
          console.log('⏳ Aguardando 2 segundos antes do próximo CNPJ...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        console.error(`Erro ao processar CNPJ ${cnpj}:`, error);
        results.push({
          success: false,
          cnpj,
          timestamp: new Date(),
          totalDuration: 0,
          spcResult: { success: false, error: 'Erro no processamento' },
          tessResult: { success: false, error: 'Erro no processamento' },
          cnpjaResult: { success: false, error: 'Erro no processamento' },
          databaseResult: { success: false, error: 'Erro no processamento' }
        });
      }
    }

    // Log do resumo
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const avgDuration = results.reduce((sum, r) => sum + r.totalDuration, 0) / results.length;

    console.log(`\n📈 RESUMO DO PROCESSAMENTO EM LOTE:`);
    console.log(`Total de CNPJs: ${results.length}`);
    console.log(`Sucessos: ${successful}`);
    console.log(`Falhas: ${failed}`);
    console.log(`Duração média: ${Math.round(avgDuration)}ms`);

    Logger.success(`Processamento em lote concluído`, { 
      total: results.length, 
      successful, 
      failed,
      avgDuration: Math.round(avgDuration)
    });

    return results;
  }

  /**
   * Prepara os dados para inserção no banco de dados
   */
  private prepareDatabaseData(cnpj: string, result: IntegratedProcessResult): any {
    const data: any = {
      cnpj: cnpj,
      data_consulta: new Date(),
      // Dados do SPC (se disponível)
      spc_sucesso: result.spcResult?.success || false,
      spc_arquivo: result.spcResult?.filePath || null,
      spc_erro: result.spcResult?.error || null,
      // Dados da TESS (se disponível)
      tess_sucesso: result.tessResult?.success || false,
      tess_resposta: result.tessResult?.response || null,
      tess_erro: result.tessResult?.error || null,
      // Dados do CNPJÁ (se disponível)
      cnpja_sucesso: result.cnpjaResult?.success || false,
      cnpja_erro: result.cnpjaResult?.error || null
    };

    // Adiciona dados específicos do CNPJÁ se disponíveis
    if (result.cnpjaResult?.success && result.cnpjaResult.data) {
      const cnpjaData = this.cnpjaService.extractDatabaseData(result.cnpjaResult.data);
      
      data.inscricao_estadual = cnpjaData.inscricaoEstadual;
      data.latitude = cnpjaData.latitude;
      data.longitude = cnpjaData.longitude;
      data.endereco_completo = cnpjaData.enderecoCompleto;
      data.atividade_principal = cnpjaData.atividadePrincipal;
      data.porte = cnpjaData.porte;
      data.telefone = cnpjaData.telefone;
      data.email = cnpjaData.email;
      data.website = cnpjaData.website;
      
      // Dados básicos da empresa
      data.razao_social = result.cnpjaResult.data.name;
      data.nome_fantasia = result.cnpjaResult.data.fantasyName;
      data.situacao = result.cnpjaResult.data.status;
      data.data_abertura = result.cnpjaResult.data.openingDate;
      data.natureza_juridica = result.cnpjaResult.data.legalNature;
      data.capital_social = result.cnpjaResult.data.shareCapital;
    }

    return data;
  }

  /**
   * Salva relatório detalhado do processamento
   */
  async saveProcessingReport(results: IntegratedProcessResult[], outputPath: string): Promise<void> {
    try {
      console.log(`Salvando relatório de processamento em: ${outputPath}`);

      // Cria o diretório se não existir
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportPath = path.join(outputPath, `relatorio_processamento_${timestamp}.json`);

      const report = {
        timestamp: new Date().toISOString(),
        totalProcessed: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        averageDuration: results.reduce((sum, r) => sum + r.totalDuration, 0) / results.length,
        results: results
      };

      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
      console.log(`Relatório salvo: ${reportPath}`);

    } catch (error) {
      console.error('Erro ao salvar relatório:', error);
      throw error;
    }
  }
}
