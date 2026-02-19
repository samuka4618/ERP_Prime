import { config, tessConfig, cnpjaConfig, validateConfig, validateTessConfig, validateCNPJAConfig } from './config';
import { IntegratedService } from './services/integratedService';
import { DatabaseService } from './services/databaseService';
import { Logger } from './utils/logger';
import { ExcelUtils } from './utils/excelUtils';
import * as dotenv from 'dotenv';

// Carrega as variáveis de ambiente
dotenv.config();

// Configuração do banco de dados
const databaseConfig = {
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

async function main() {
  try {
    console.log('🚀 Iniciando Sistema Integrado SPC + TESS + CNPJÁ + Banco de Dados');
    console.log('=' .repeat(80));

    // Valida configurações
    console.log('🔧 Validando configurações...');
    validateConfig();
    validateTessConfig();
    validateCNPJAConfig();
    console.log('✅ Configurações válidas');

    // Inicializa o sistema de log
    Logger.initialize();

    // Cria instâncias dos serviços
    const integratedService = new IntegratedService(
      config,
      tessConfig,
      cnpjaConfig,
      databaseConfig
    );

    const databaseService = new DatabaseService(databaseConfig);

    // Testa conexão com o banco
    console.log('🔌 Testando conexão com o banco de dados...');
    try {
      await databaseService.testConnection();
      console.log('✅ Conexão com banco de dados estabelecida');
    } catch (error) {
      console.error('❌ Erro na conexão com banco de dados:', error);
      throw error;
    }

    // Determina CNPJs para processar
    let cnpjsToProcess: string[] = [];

    if (config.cnpjToQuery) {
      // Processa CNPJ único
      console.log(`📋 Processando CNPJ único: ${config.cnpjToQuery}`);
      cnpjsToProcess = [config.cnpjToQuery];
    } else if (config.excelFile) {
      // Processa CNPJs do Excel
      console.log(`📊 Lendo CNPJs do arquivo Excel: ${config.excelFile}`);
      cnpjsToProcess = ExcelUtils.readCNPJsFromExcel(
        config.excelFile,
        config.excelSheet || 'Sheet1',
        config.excelCnpjColumn || 'A'
      );
      console.log(`📋 Encontrados ${cnpjsToProcess.length} CNPJs para processar`);
    } else {
      throw new Error('Nenhuma fonte de CNPJ fornecida (CNPJ_TO_QUERY ou EXCEL_FILE)');
    }

    if (cnpjsToProcess.length === 0) {
      throw new Error('Nenhum CNPJ encontrado para processar');
    }

    // Processa os CNPJs
    console.log(`\n🔄 Iniciando processamento de ${cnpjsToProcess.length} CNPJ(s)...`);
    const results = await integratedService.processMultipleCNPJs(cnpjsToProcess);

    // Salva relatório de processamento
    console.log('\n📄 Salvando relatório de processamento...');
    await integratedService.saveProcessingReport(results, './relatorios');

    // Exibe resumo final
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const avgDuration = results.reduce((sum, r) => sum + r.totalDuration, 0) / results.length;

    console.log('\n' + '='.repeat(80));
    console.log('📈 RESUMO FINAL DO PROCESSAMENTO');
    console.log('='.repeat(80));
    console.log(`Total de CNPJs processados: ${results.length}`);
    console.log(`✅ Sucessos: ${successful}`);
    console.log(`❌ Falhas: ${failed}`);
    console.log(`⏱️  Duração média por CNPJ: ${Math.round(avgDuration)}ms`);
    console.log(`⏱️  Duração total: ${Math.round(results.reduce((sum, r) => sum + r.totalDuration, 0))}ms`);

    // Detalhes por etapa
    const spcSuccess = results.filter(r => r.spcResult?.success).length;
    const tessSuccess = results.filter(r => r.tessResult?.success).length;
    const cnpjaSuccess = results.filter(r => r.cnpjaResult?.success).length;
    const databaseSuccess = results.filter(r => r.databaseResult?.success).length;

    console.log('\n📊 DETALHES POR ETAPA:');
    console.log(`SPC: ${spcSuccess}/${results.length} (${Math.round(spcSuccess/results.length*100)}%)`);
    console.log(`TESS: ${tessSuccess}/${results.length} (${Math.round(tessSuccess/results.length*100)}%)`);
    console.log(`CNPJÁ: ${cnpjaSuccess}/${results.length} (${Math.round(cnpjaSuccess/results.length*100)}%)`);
    console.log(`Banco de Dados: ${databaseSuccess}/${results.length} (${Math.round(databaseSuccess/results.length*100)}%)`);

    // Lista falhas se houver
    if (failed > 0) {
      console.log('\n❌ FALHAS DETALHADAS:');
      results.filter(r => !r.success).forEach((result, index) => {
        console.log(`\n${index + 1}. CNPJ: ${result.cnpj}`);
        if (result.spcResult?.error) console.log(`   SPC: ${result.spcResult.error}`);
        if (result.tessResult?.error) console.log(`   TESS: ${result.tessResult.error}`);
        if (result.cnpjaResult?.error) console.log(`   CNPJÁ: ${result.cnpjaResult.error}`);
        if (result.databaseResult?.error) console.log(`   Banco: ${result.databaseResult.error}`);
      });
    }

    console.log('\n🎉 Processamento concluído!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ ERRO CRÍTICO:', error);
    Logger.error('Erro crítico no sistema integrado', { 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    });
    process.exit(1);
  }
}

// Executa o programa principal
if (require.main === module) {
  main().catch(error => {
    console.error('Erro não tratado:', error);
    process.exit(1);
  });
}

export { main };
