import { SPCBot } from './services/spcBot';
import { TessService } from './services/tessService';
import { config, tessConfig, validateConfig, validateTessConfig } from './config';
import { Logger } from './utils/logger';
import { QueryResult, TessProcessResult } from './types';
import * as path from 'path';

async function main() {
  try {
    console.log('=== Integração SPC + TESS ===');
    console.log('Processando CNPJ e enviando PDF para TESS...\n');

    // Valida as configurações
    validateConfig();
    validateTessConfig();

    // Inicializa o sistema de log
    Logger.initialize();

    // Cria instâncias dos serviços
    const spcBot = new SPCBot({
      url: config.url,
      operador: config.operador,
      senha: config.senha,
      palavraSecreta: config.palavraSecreta,
      downloadPath: config.downloadPath,
      cnpjToQuery: config.cnpjToQuery,
      headless: config.headless,
      browserTimeout: config.browserTimeout,
      debug: config.debug,
      cnpjCacheExpirationHours: config.cnpjCacheExpirationHours
    });

    const tessService = new TessService(tessConfig);

    // Executa a consulta SPC
    console.log('=== Etapa 1: Consulta SPC ===');
    const spcResult: QueryResult = await spcBot.executeQuery(config.cnpjToQuery);

    if (!spcResult.success) {
      console.error('❌ Falha na consulta SPC:', spcResult.error);
      Logger.error('Falha na consulta SPC', { error: spcResult.error });
      process.exit(1);
    }

    console.log('✅ Consulta SPC realizada com sucesso!');
    console.log(`📄 Arquivo gerado: ${spcResult.fileName}`);
    console.log(`📂 Caminho: ${spcResult.filePath}`);

    // Aguarda um pouco para garantir que o arquivo foi salvo
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Processa o PDF com a TESS
    console.log('\n=== Etapa 2: Processamento TESS ===');
    const tessResult: TessProcessResult = await tessService.processPDF(
      spcResult.filePath!, 
      tessConfig.prompt
    );

    if (!tessResult.success) {
      console.error('❌ Falha no processamento TESS:', tessResult.error);
      Logger.error('Falha no processamento TESS', { error: tessResult.error });
      process.exit(1);
    }

    console.log('✅ Processamento TESS realizado com sucesso!');
    console.log(`📄 Arquivo processado: ${tessResult.fileName}`);
    console.log(`💰 Créditos utilizados: ${tessResult.credits}`);

    // Salva a resposta da TESS
    console.log('\n=== Etapa 3: Salvando Resposta ===');
    await tessService.saveResponses([tessResult], tessConfig.outputPath);

    console.log(`📁 Resposta salva em: ${tessConfig.outputPath}`);

    // Exibe a resposta processada
    if (tessResult.response) {
      console.log('\n=== Resposta Processada pela TESS ===');
      console.log(tessResult.response);
      console.log('=== Fim da Resposta ===');
    }

    console.log('\n🎉 Processo completo finalizado com sucesso!');

  } catch (error) {
    console.error('❌ Erro fatal:', error);
    Logger.error('Erro fatal na integração SPC+TESS', { error: error instanceof Error ? error.message : 'Erro desconhecido' });
    process.exit(1);
  }
}

// Executa o programa
if (require.main === module) {
  main();
}
