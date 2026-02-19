import { SistemaIntegradoSPCTESS, SistemaIntegradoConfig } from './services/sistemaIntegrado';
import { config, tessConfig } from './config';
import { ExcelUtils } from './utils/excelUtils';
import * as readline from 'readline';

// Configuração do sistema integrado
const sistemaConfig: SistemaIntegradoConfig = {
  spc: {
    url: config.url,
    operador: config.operador,
    senha: config.senha,
    palavraSecreta: config.palavraSecreta,
    downloadPath: config.downloadPath,
    headless: config.headless,
    browserTimeout: config.browserTimeout,
    debug: config.debug,
    cnpjCacheExpirationHours: config.cnpjCacheExpirationHours
  },
  tess: {
    apiKey: tessConfig.apiKey,
    baseUrl: tessConfig.baseUrl,
    agentId: tessConfig.agentId,
    model: tessConfig.model,
    temperature: tessConfig.temperature,
    outputPath: tessConfig.outputPath
  },
  database: {
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_DATABASE || 'TessDataConsolidation',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'your_password',
    port: parseInt(process.env.DB_PORT || '1433'),
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_CERT === 'true'
    }
  },
  general: {
    excelFile: config.excelFile,
    excelSheet: config.excelSheet,
    excelCnpjColumn: config.excelCnpjColumn,
    delayBetweenQueries: parseInt(process.env.DELAY_BETWEEN_QUERIES || '3')
  }
};

async function main() {
  const sistema = new SistemaIntegradoSPCTESS(sistemaConfig);
  
  try {
    console.log('🚀 Sistema Integrado SPC + TESS + Banco de Dados');
    console.log('================================================');
    console.log('Este sistema automatiza:');
    console.log('1. 🔍 Detecção de novos CNPJs no Excel');
    console.log('2. 🤖 Consulta automática no SPC');
    console.log('3. 📄 Geração e salvamento do PDF');
    console.log('4. 🧠 Processamento com TESS AI');
    console.log('5. 💾 Inserção estruturada no banco de dados');
    console.log('6. 📊 Consolidação para análise manual');
    console.log('================================================\n');

    // Inicializa o sistema
    await sistema.inicializar();

    // Menu interativo
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    while (true) {
      console.log('\n📋 MENU PRINCIPAL');
      console.log('==================');
      console.log('1. 🔄 Processar CNPJ único');
      console.log('2. 📊 Processar arquivo Excel');
      console.log('3. 🔍 Buscar dados consolidados');
      console.log('4. 📋 Listar empresas para análise');
      console.log('5. 📈 Ver estatísticas');
      console.log('6. ❌ Sair');
      console.log('==================');

      const opcao = await perguntar(rl, 'Escolha uma opção (1-6): ');

      switch (opcao) {
        case '1':
          await processarCNPJUnico(sistema, rl);
          break;
        case '2':
          await processarArquivoExcel(sistema, rl);
          break;
        case '3':
          await buscarDadosConsolidados(sistema, rl);
          break;
        case '4':
          await listarEmpresasParaAnalise(sistema);
          break;
        case '5':
          await verEstatisticas(sistema);
          break;
        case '6':
          console.log('👋 Encerrando sistema...');
          await sistema.fechar();
          rl.close();
          process.exit(0);
          break;
        default:
          console.log('❌ Opção inválida. Tente novamente.');
      }
    }

  } catch (error) {
    console.error('❌ Erro fatal:', error);
    await sistema.fechar();
    process.exit(1);
  }
}

/**
 * Processa um CNPJ único
 */
async function processarCNPJUnico(sistema: SistemaIntegradoSPCTESS, rl: readline.Interface): Promise<void> {
  try {
    console.log('\n🔄 PROCESSAR CNPJ ÚNICO');
    console.log('=======================');
    
    const cnpj = await perguntar(rl, 'Digite o CNPJ (apenas números): ');
    const razaoSocial = await perguntar(rl, 'Digite a Razão Social (opcional): ');

    if (!cnpj || cnpj.length < 11) {
      console.log('❌ CNPJ inválido');
      return;
    }

    console.log(`\n🔄 Processando CNPJ: ${cnpj}${razaoSocial ? ` - ${razaoSocial}` : ''}`);
    
    const resultado = await sistema.processarCNPJCompleto(cnpj, razaoSocial || undefined);
    
    if (resultado.success) {
      console.log(`\n✅ CNPJ processado com sucesso!`);
      console.log(`   - Consulta TESS ID: ${resultado.consultaTESSId}`);
      console.log(`   - Empresa ID: ${resultado.empresaId}`);
    } else {
      console.log(`\n❌ Falha no processamento: ${resultado.error}`);
    }

  } catch (error) {
    console.error('❌ Erro ao processar CNPJ:', error);
  }
}

/**
 * Processa arquivo Excel
 */
async function processarArquivoExcel(sistema: SistemaIntegradoSPCTESS, rl: readline.Interface): Promise<void> {
  try {
    console.log('\n📊 PROCESSAR ARQUIVO EXCEL');
    console.log('============================');
    
    const excelFile = await perguntar(rl, `Digite o caminho do arquivo Excel (ou Enter para usar: ${sistemaConfig.general.excelFile}): `);
    const arquivo = excelFile || sistemaConfig.general.excelFile || './cnpjs.xlsx';

    console.log(`\n📖 Lendo arquivo: ${arquivo}`);
    
    const cnpjs = ExcelUtils.readCNPJsFromExcel(
      arquivo,
      sistemaConfig.general.excelSheet,
      sistemaConfig.general.excelCnpjColumn
    );

    if (cnpjs.length === 0) {
      console.log('❌ Nenhum CNPJ válido encontrado no arquivo');
      return;
    }

    console.log(`✅ Encontrados ${cnpjs.length} CNPJs no arquivo`);
    
    const confirmar = await perguntar(rl, `Deseja processar todos os ${cnpjs.length} CNPJs? (s/n): `);
    
    if (confirmar.toLowerCase() !== 's' && confirmar.toLowerCase() !== 'sim') {
      console.log('❌ Processamento cancelado');
      return;
    }

    console.log(`\n🔄 Iniciando processamento de ${cnpjs.length} CNPJs...`);
    
    const resultado = await sistema.processarCNPJs(cnpjs);
    
    console.log(`\n📈 PROCESSAMENTO CONCLUÍDO:`);
    console.log(`   - Total: ${resultado.total}`);
    console.log(`   - Sucessos: ${resultado.sucessos}`);
    console.log(`   - Falhas: ${resultado.falhas}`);
    console.log(`   - Taxa de sucesso: ${((resultado.sucessos / resultado.total) * 100).toFixed(1)}%`);

    // Mostra falhas se houver
    if (resultado.falhas > 0) {
      console.log(`\n❌ FALHAS:`);
      resultado.resultados
        .filter(r => !r.success)
        .forEach((r, index) => {
          console.log(`   ${index + 1}. ${r.cnpj}: ${r.error}`);
        });
    }

  } catch (error) {
    console.error('❌ Erro ao processar arquivo Excel:', error);
  }
}

/**
 * Busca dados consolidados
 */
async function buscarDadosConsolidados(sistema: SistemaIntegradoSPCTESS, rl: readline.Interface): Promise<void> {
  try {
    console.log('\n🔍 BUSCAR DADOS CONSOLIDADOS');
    console.log('=============================');
    
    const cnpj = await perguntar(rl, 'Digite o CNPJ para buscar: ');

    if (!cnpj || cnpj.length < 11) {
      console.log('❌ CNPJ inválido');
      return;
    }

    console.log(`\n🔍 Buscando dados: ${cnpj}`);
    
    const dados = await sistema.buscarDadosConsolidados(cnpj);
    
    if (dados.length === 0) {
      console.log('❌ Nenhum dado encontrado para este CNPJ');
      return;
    }

    console.log(`\n✅ Dados encontrados:`);
    console.log(JSON.stringify(dados, null, 2));

  } catch (error) {
    console.error('❌ Erro ao buscar dados:', error);
  }
}

/**
 * Lista empresas para análise
 */
async function listarEmpresasParaAnalise(sistema: SistemaIntegradoSPCTESS): Promise<void> {
  try {
    console.log('\n📋 EMPRESAS PARA ANÁLISE');
    console.log('=========================');
    
    const empresas = await sistema.listarEmpresasParaAnalise();
    
    if (empresas.length === 0) {
      console.log('❌ Nenhuma empresa encontrada');
      return;
    }

    console.log(`\n✅ Encontradas ${empresas.length} empresas:`);
    empresas.forEach((empresa, index) => {
      console.log(`   ${index + 1}. ${empresa.CNPJ} - ${empresa.RazaoSocial || 'Nome não informado'}`);
    });

  } catch (error) {
    console.error('❌ Erro ao listar empresas:', error);
  }
}

/**
 * Ver estatísticas
 */
async function verEstatisticas(sistema: SistemaIntegradoSPCTESS): Promise<void> {
  try {
    console.log('\n📈 ESTATÍSTICAS DO SISTEMA');
    console.log('============================');
    
    const stats = sistema.getStats();
    
    console.log(`   - Total processados: ${stats.totalProcessed}`);
    console.log(`   - Processando agora: ${stats.isProcessing ? 'Sim' : 'Não'}`);
    console.log(`   - CNPJs processados:`);
    
    if (stats.processedCNPJs.length === 0) {
      console.log('     Nenhum CNPJ processado ainda');
    } else {
      stats.processedCNPJs.forEach((cnpj, index) => {
        console.log(`     ${index + 1}. ${cnpj}`);
      });
    }

  } catch (error) {
    console.error('❌ Erro ao obter estatísticas:', error);
  }
}

/**
 * Função auxiliar para perguntas
 */
function perguntar(rl: readline.Interface, pergunta: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(pergunta, (resposta) => {
      resolve(resposta.trim());
    });
  });
}

// Executa o programa
if (require.main === module) {
  main().catch(console.error);
}
