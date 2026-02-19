import dotenv from 'dotenv';
import { SistemaIntegradoCompleto, SistemaIntegradoConfig } from './services/sistemaIntegradoCompleto';
import { config } from './config';

// Carregar variáveis de ambiente
dotenv.config();

async function main() {
  try {
    console.log('🚀 SISTEMA INTEGRADO SPC + TESS + CNPJÁ');
    console.log('='.repeat(80));

    // Validar configurações
    console.log('🔧 Validando configurações...');
    
    if (!config.spcConfig.headless) {
      console.log('⚠️  Modo headless desabilitado - o navegador será exibido');
    }

    if (!config.tessConfig.apiKey) {
      throw new Error('TESS_API_KEY não configurada');
    }

    if (!config.cnpjaConfig.apiKey) {
      throw new Error('CNPJA_API_KEY não configurada');
    }

    if (!config.databaseConfig.server) {
      throw new Error('Configurações do banco de dados não encontradas');
    }

    console.log('✅ Configurações validadas');

    // Configurar sistema integrado
    const sistemaConfig: SistemaIntegradoConfig = {
      spc: {
        headless: config.spcConfig.headless,
        timeout: config.spcConfig.timeout
      },
      tess: {
        apiKey: config.tessConfig.apiKey,
        baseUrl: config.tessConfig.baseUrl
      },
      cnpja: {
        apiKey: config.cnpjaConfig.apiKey,
        baseUrl: config.cnpjaConfig.baseUrl
      },
      database: {
        server: config.databaseConfig.server,
        database: config.databaseConfig.database,
        user: config.databaseConfig.user,
        password: config.databaseConfig.password,
        port: config.databaseConfig.port,
        options: config.databaseConfig.options
      }
    };

    const sistema = new SistemaIntegradoCompleto(sistemaConfig);

    // Obter CNPJ(s) para consulta
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
      console.log('\n📋 Uso: npm run sistema-completo <CNPJ1> [CNPJ2] [CNPJ3] ...');
      console.log('Exemplo: npm run sistema-completo 12345678000195');
      console.log('Exemplo: npm run sistema-completo 12345678000195 98765432000123');
      process.exit(1);
    }

    const cnpjs = args;
    console.log(`\n📋 CNPJs para consulta: ${cnpjs.join(', ')}`);

    // Executar consultas
    if (cnpjs.length === 1) {
      // Consulta única
      console.log('\n🔍 Executando consulta única...');
      const resultado = await sistema.consultarCNPJCompleto(cnpjs[0]);
      
      if (resultado.success) {
        console.log('\n🎉 Consulta concluída com sucesso!');
        console.log(`💰 Custo total: ${resultado.custoTotal} ₪`);
        console.log(`📊 Empresa ID: ${resultado.database.empresaId}`);
      } else {
        console.log('\n❌ Consulta falhou');
        console.log(`SPC: ${resultado.spc.sucesso ? '✅' : '❌'} ${resultado.spc.erro || ''}`);
        console.log(`TESS: ${resultado.tess.sucesso ? '✅' : '❌'} ${resultado.tess.erro || ''}`);
        console.log(`CNPJÁ: ${resultado.cnpja.sucesso ? '✅' : '❌'} ${resultado.cnpja.erro || ''}`);
        console.log(`Database: ${resultado.database.sucesso ? '✅' : '❌'} ${resultado.database.erro || ''}`);
        process.exit(1);
      }
    } else {
      // Consulta múltipla
      console.log('\n🔍 Executando consultas múltiplas...');
      const resultados = await sistema.consultarMultiplosCNPJs(cnpjs);
      
      const sucessos = resultados.filter(r => r.success).length;
      const falhas = resultados.filter(r => !r.success).length;
      const custoTotal = resultados.reduce((total, r) => total + r.custoTotal, 0);
      
      console.log('\n📊 RESUMO FINAL:');
      console.log(`Total: ${resultados.length} CNPJs`);
      console.log(`Sucessos: ${sucessos}`);
      console.log(`Falhas: ${falhas}`);
      console.log(`Custo total: ${custoTotal} ₪`);
      
      if (falhas > 0) {
        console.log('\n❌ CNPJs com falha:');
        resultados
          .filter(r => !r.success)
          .forEach(r => console.log(`  - ${r.cnpj}: ${r.spc.erro || r.tess.erro || r.cnpja.erro || r.database.erro}`));
      }
    }

  } catch (error) {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  }
}

// Executar se for chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

export { main };
