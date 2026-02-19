import { TessService } from './services/tessService';
import { tessConfig, validateTessConfig } from './config';
import { Logger } from './utils/logger';
import * as path from 'path';

async function main() {
  try {
    console.log('=== Processador TESS para PDFs ===');
    console.log('Iniciando processamento...\n');

    // Valida as configurações da TESS
    validateTessConfig();

    // Inicializa o sistema de log
    Logger.initialize();

    // Cria instância do serviço TESS
    const tessService = new TessService(tessConfig);

    // Define o caminho da pasta downloads
    const downloadsPath = path.join(__dirname, '..', 'downloads');
    console.log(`Pasta de downloads: ${downloadsPath}`);

    // Processa todos os PDFs
    console.log('Iniciando processamento dos PDFs...');
    const results = await tessService.processAllPDFs(downloadsPath, tessConfig.prompt);

    if (results.length === 0) {
      console.log('Nenhum arquivo PDF encontrado para processar.');
      return;
    }

    // Salva as respostas
    console.log('\nSalvando respostas...');
    await tessService.saveResponses(results, tessConfig.outputPath);

    // Exibe resumo final
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalCredits = results.reduce((sum, r) => sum + (r.credits || 0), 0);

    console.log('\n=== Resumo Final ===');
    console.log(`Total de arquivos processados: ${results.length}`);
    console.log(`Sucessos: ${successful}`);
    console.log(`Falhas: ${failed}`);
    console.log(`Total de créditos utilizados: ${totalCredits.toFixed(6)}`);
    console.log(`Respostas salvas em: ${tessConfig.outputPath}`);

    if (failed > 0) {
      console.log('\nArquivos com falha:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`- ${r.fileName}: ${r.error}`);
      });
    }

    console.log('\nProcessamento concluído!');

  } catch (error) {
    console.error('❌ Erro fatal:', error);
    Logger.error('Erro fatal no processamento TESS', { error: error instanceof Error ? error.message : 'Erro desconhecido' });
    process.exit(1);
  }
}

// Executa o programa
if (require.main === module) {
  main();
}
