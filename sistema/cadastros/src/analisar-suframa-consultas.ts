import dotenv from 'dotenv';
import { DatabaseService } from './services/databaseService';
import { config } from './config';

// Carregar variáveis de ambiente
dotenv.config();

// Estados da Zona Franca onde SUFRAMA é aplicável
const SUFRAMA_STATES = ['AM', 'AC', 'RO', 'RR'];
const SUFRAMA_MUNICIPALITIES_AP = ['Macapá', 'Santana'];

function shouldQuerySuframa(state: string, city?: string): boolean {
  // Estados da Zona Franca
  if (SUFRAMA_STATES.includes(state)) {
    return true;
  }
  
  // Amapá - apenas Macapá e Santana
  if (state === 'AP' && city) {
    return SUFRAMA_MUNICIPALITIES_AP.some(municipality => 
      city.toLowerCase().includes(municipality.toLowerCase())
    );
  }
  
  return false;
}

async function analisarConsultasSuframa() {
  try {
    console.log('🔍 ANALISANDO CONSULTAS SALVAS PARA SUFRAMA');
    console.log('='.repeat(80));

    // Conectar ao banco
    const dbService = new DatabaseService({
      server: config.databaseConfig.server,
      database: config.databaseConfig.database,
      user: config.databaseConfig.user,
      password: config.databaseConfig.password,
      port: config.databaseConfig.port,
      options: config.databaseConfig.options
    });

    await dbService.connect();

    // Consultar empresas com endereços
    const query = `
      SELECT 
        e.id,
        e.cnpj,
        e.razao_social,
        e.inscricao_suframa,
        en.cidade,
        en.estado,
        en.latitude,
        en.longitude
      FROM empresa e
      LEFT JOIN endereco en ON e.id = en.id_empresa
      WHERE en.estado IS NOT NULL
      ORDER BY e.created_at DESC
    `;

    const result = await dbService.query(query);
    const empresas = result.recordset;

    console.log(`📊 Total de empresas encontradas: ${empresas.length}\n`);

    if (empresas.length === 0) {
      console.log('❌ Nenhuma empresa com endereço encontrada no banco');
      return;
    }

    // Analisar cada empresa
    let totalAnalisadas = 0;
    let precisamSuframa = 0;
    let jaTemSuframa = 0;
    let naoPrecisamSuframa = 0;

    console.log('📋 ANÁLISE DETALHADA:\n');
    console.log('ID | CNPJ | Razão Social | Estado | Cidade | Precisa SUFRAMA | Já tem SUFRAMA | Status');
    console.log('-'.repeat(120));

    for (const empresa of empresas) {
      totalAnalisadas++;
      const estado = empresa.estado || 'N/A';
      const cidade = empresa.cidade || 'N/A';
      const precisaSuframa = shouldQuerySuframa(estado, cidade);
      const jaTemSuframaInscricao = empresa.inscricao_suframa ? 'Sim' : 'Não';

      if (precisaSuframa) {
        precisamSuframa++;
        if (empresa.inscricao_suframa) {
          jaTemSuframa++;
        }
      } else {
        naoPrecisamSuframa++;
      }

      const status = precisaSuframa 
        ? (empresa.inscricao_suframa ? '✅ OK' : '⚠️ FALTANDO')
        : '➖ N/A';

      console.log(
        `${empresa.id.toString().padEnd(3)} | ` +
        `${empresa.cnpj} | ` +
        `${(empresa.razao_social || 'N/A').substring(0, 20).padEnd(20)} | ` +
        `${estado.padEnd(6)} | ` +
        `${cidade.substring(0, 15).padEnd(15)} | ` +
        `${precisaSuframa ? 'Sim' : 'Não'.padEnd(15)} | ` +
        `${jaTemSuframaInscricao.padEnd(12)} | ` +
        `${status}`
      );
    }

    // Resumo estatístico
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMO ESTATÍSTICO:');
    console.log('='.repeat(80));
    console.log(`Total de empresas analisadas: ${totalAnalisadas}`);
    console.log(`Precisam de SUFRAMA: ${precisamSuframa}`);
    console.log(`  - Já têm inscrição SUFRAMA: ${jaTemSuframa}`);
    console.log(`  - Faltando inscrição SUFRAMA: ${precisamSuframa - jaTemSuframa}`);
    console.log(`Não precisam de SUFRAMA: ${naoPrecisamSuframa}`);

    // Detalhamento por estado
    console.log('\n📈 DISTRIBUIÇÃO POR ESTADO:');
    console.log('-'.repeat(50));
    
    const estadosCount: { [key: string]: { total: number; precisaSuframa: number; jaTemSuframa: number } } = {};
    
    for (const empresa of empresas) {
      const estado = empresa.estado || 'N/A';
      const precisaSuframa = shouldQuerySuframa(estado, empresa.cidade);
      
      if (!estadosCount[estado]) {
        estadosCount[estado] = { total: 0, precisaSuframa: 0, jaTemSuframa: 0 };
      }
      
      estadosCount[estado].total++;
      if (precisaSuframa) {
        estadosCount[estado].precisaSuframa++;
        if (empresa.inscricao_suframa) {
          estadosCount[estado].jaTemSuframa++;
        }
      }
    }

    for (const [estado, dados] of Object.entries(estadosCount)) {
      const status = dados.precisaSuframa > 0 
        ? (dados.jaTemSuframa === dados.precisaSuframa ? '✅' : '⚠️')
        : '➖';
      
      console.log(
        `${estado.padEnd(6)} | ` +
        `Total: ${dados.total.toString().padEnd(3)} | ` +
        `Precisa: ${dados.precisaSuframa.toString().padEnd(3)} | ` +
        `Tem: ${dados.jaTemSuframa.toString().padEnd(3)} | ` +
        `${status}`
      );
    }

    // Recomendações
    console.log('\n💡 RECOMENDAÇÕES:');
    console.log('-'.repeat(50));
    
    if (precisamSuframa - jaTemSuframa > 0) {
      console.log(`⚠️  ${precisamSuframa - jaTemSuframa} empresas precisam de consulta SUFRAMA`);
      console.log('   Execute: npm run sistema-completo <CNPJ1> <CNPJ2> ...');
    } else {
      console.log('✅ Todas as empresas que precisam de SUFRAMA já foram consultadas');
    }

    if (naoPrecisamSuframa > 0) {
      console.log(`✅ ${naoPrecisamSuframa} empresas não precisam de SUFRAMA (economia de ${naoPrecisamSuframa} ₪)`);
    }

  } catch (error) {
    console.error('❌ Erro na análise:', error);
  }
}

// Executar se for chamado diretamente
if (require.main === module) {
  analisarConsultasSuframa().catch(console.error);
}

export { analisarConsultasSuframa };
