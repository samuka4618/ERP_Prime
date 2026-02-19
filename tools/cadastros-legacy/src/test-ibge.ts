import * as sql from 'mssql';
import * as dotenv from 'dotenv';
import { IBGEService } from './services/ibgeService';

dotenv.config();

/**
 * Script de teste para verificar busca de código IBGE
 * Não envia para o Atak, apenas testa a busca e exibe resultados
 */
async function testIBGESearch() {
  console.log('🧪 TESTE DE BUSCA DE CÓDIGO IBGE\n');
  console.log('=' .repeat(60));

  try {
    // Configuração do banco
    const dbConfig: sql.config = {
      server: process.env.DB_SERVER || '',
      database: process.env.DB_DATABASE || '',
      user: process.env.DB_USER || '',
      password: process.env.DB_PASSWORD || '',
      options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
      }
    };

    // Conecta ao banco
    console.log('🔌 Conectando ao banco de dados...');
    const pool = await sql.connect(dbConfig);
    console.log('✅ Conectado ao banco\n');

    // Busca empresas cadastradas com endereço
    const request = new sql.Request(pool);
    const result = await request.query(`
      SELECT TOP 5
        e.cnpj,
        e.razao_social,
        e.nome_fantasia,
        ed.cidade,
        ed.estado
      FROM empresa e
      INNER JOIN endereco ed ON ed.id_empresa = e.id
      WHERE ed.cidade IS NOT NULL 
        AND ed.cidade != ''
        AND ed.estado IS NOT NULL
        AND ed.estado != ''
      ORDER BY e.updated_at DESC
    `);

    if (result.recordset.length === 0) {
      console.log('⚠️ Nenhuma empresa com endereço encontrada no banco.');
      console.log('💡 Testando com cidades de exemplo...\n');
      
      // Testa com cidades de exemplo
      const cidadesTeste = [
        { cidade: 'SOROCABA', uf: 'SP' },
        { cidade: 'SAO PAULO', uf: 'SP' },
        { cidade: 'RIO DE JANEIRO', uf: 'RJ' },
        { cidade: 'BELO HORIZONTE', uf: 'MG' }
      ];

      for (const teste of cidadesTeste) {
        console.log(`\n🔍 Testando busca para: ${teste.cidade} - ${teste.uf}`);
        const codigo = IBGEService.buscarCodigoIBGE(teste.cidade, teste.uf);
        if (codigo) {
          console.log(`   ✅ Código encontrado: ${codigo}`);
        } else {
          console.log(`   ❌ Código não encontrado`);
        }
      }
    } else {
      console.log(`📋 Encontradas ${result.recordset.length} empresas com endereço:\n`);

      // Testa busca de código IBGE para cada empresa
      for (let i = 0; i < result.recordset.length; i++) {
        const empresa = result.recordset[i];
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📊 Empresa ${i + 1}/${result.recordset.length}:`);
        console.log(`   CNPJ: ${empresa.cnpj}`);
        console.log(`   Razão Social: ${empresa.razao_social || 'N/A'}`);
        console.log(`   Cidade: ${empresa.cidade} - ${empresa.estado}`);

        // Busca código IBGE
        console.log(`\n🔍 Buscando código IBGE...`);
        const codigoIBGE = IBGEService.buscarCodigoIBGE(empresa.cidade, empresa.estado);

        if (codigoIBGE) {
          console.log(`   ✅ Código IBGE encontrado: ${codigoIBGE}`);
          
          // Simula o que seria enviado no payload do Atak
          console.log(`\n📦 Payload do Atak (exemplo):`);
          console.log(`   CodigoIBGECidadeF: "${codigoIBGE}"`);
          console.log(`   CodigoIBGECidadeC: "${codigoIBGE}"`);
          console.log(`   CodigoIBGECidadeE: "${codigoIBGE}"`);
          console.log(`   CodigoIBGECidadeR: "${codigoIBGE}"`);
          console.log(`   CodigoIBGECidadeT: "${codigoIBGE}"`);
        } else {
          console.log(`   ❌ Código IBGE não encontrado`);
          console.log(`   ⚠️ Verifique se a planilha está na pasta codIBGE`);
        }
      }

      // Simula o que aconteceria no AtakService ao montar o payload
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🧪 Simulando integração com AtakService...\n`);
      
      // Pega a primeira empresa
      const primeiraEmpresa = result.recordset[0];
      
      console.log(`📋 Simulando payload para:`);
      console.log(`   Cidade: ${primeiraEmpresa.cidade}`);
      console.log(`   Estado: ${primeiraEmpresa.estado}`);
      
      // Busca código IBGE (como seria feito no AtakService)
      const codigoIBGE = IBGEService.buscarCodigoIBGE(
        primeiraEmpresa.cidade, 
        primeiraEmpresa.estado
      );
      
      console.log(`\n📦 Código IBGE que seria usado no payload do Atak:`);
      console.log(`   CodigoIBGECidadeF: ${codigoIBGE || 'undefined'}`);
      console.log(`   CodigoIBGECidadeC: ${codigoIBGE || 'undefined'}`);
      console.log(`   CodigoIBGECidadeE: ${codigoIBGE || 'undefined'}`);
      console.log(`   CodigoIBGECidadeR: ${codigoIBGE || 'undefined'}`);
      console.log(`   CodigoIBGECidadeT: ${codigoIBGE || 'undefined'}`);
      
      if (codigoIBGE) {
        console.log(`\n✅ Teste concluído com sucesso!`);
        console.log(`   O código IBGE será incluído automaticamente no payload do Atak.`);
      } else {
        console.log(`\n⚠️ Código IBGE não encontrado.`);
        console.log(`   O campo ficará undefined no payload (não será enviado).`);
        console.log(`   Verifique se a planilha está na pasta cadastros/codIBGE/`);
      }
    }

    // Estatísticas do cache
    console.log(`\n${'='.repeat(60)}`);
    const cacheStats = IBGEService.getCacheStats();
    console.log(`📊 Estatísticas do cache IBGE:`);
    console.log(`   Itens em cache: ${cacheStats.tamanho}`);
    if (cacheStats.chaves.length > 0) {
      console.log(`   Chaves: ${cacheStats.chaves.slice(0, 5).join(', ')}${cacheStats.chaves.length > 5 ? '...' : ''}`);
    }

    pool.close();
    console.log(`\n✅ Teste concluído!`);

  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
    if (error instanceof Error) {
      console.error('   Mensagem:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Executa o teste
testIBGESearch().then(() => {
  console.log('\n✨ Script finalizado.');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});

