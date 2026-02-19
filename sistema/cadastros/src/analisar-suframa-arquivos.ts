import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

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

function extrairDadosTESS(conteudo: string): { estado?: string; cidade?: string; cnpj?: string; razaoSocial?: string } {
  const dados: { estado?: string; cidade?: string; cnpj?: string; razaoSocial?: string } = {};
  
  try {
    // Procurar pelo bloco JSON no conteúdo
    const jsonMatch = conteudo.match(/```json\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      const jsonStr = jsonMatch[1];
      const parsed = JSON.parse(jsonStr);
      
      // Extrair dados da empresa
      if (parsed.empresa) {
        dados.cnpj = parsed.empresa.cnpj;
        dados.razaoSocial = parsed.empresa.razao_social;
        
        if (parsed.empresa.endereco) {
          dados.estado = parsed.empresa.endereco.estado;
          dados.cidade = parsed.empresa.endereco.cidade;
        }
      }
    } else {
      // Fallback para extração por regex (formato antigo)
      const cnpjMatch = conteudo.match(/CNPJ[:\s]*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i);
      if (cnpjMatch) {
        dados.cnpj = cnpjMatch[1];
      }
      
      const razaoMatch = conteudo.match(/Razão Social[:\s]*([^\n\r]+)/i);
      if (razaoMatch) {
        dados.razaoSocial = razaoMatch[1].trim();
      }
      
      const estadoMatch = conteudo.match(/UF[:\s]*([A-Z]{2})/i);
      if (estadoMatch) {
        dados.estado = estadoMatch[1];
      }
      
      const cidadeMatch = conteudo.match(/Município[:\s]*([^\n\r]+)/i) || 
                         conteudo.match(/Cidade[:\s]*([^\n\r]+)/i);
      if (cidadeMatch) {
        dados.cidade = cidadeMatch[1].trim();
      }
    }
  } catch (error) {
    console.error('Erro ao extrair dados do arquivo:', error);
  }
  
  return dados;
}

async function analisarArquivosSuframa() {
  try {
    console.log('🔍 ANALISANDO ARQUIVOS TESS PARA SUFRAMA');
    console.log('='.repeat(80));

    const tessDir = path.join(process.cwd(), 'tess_responses');
    const downloadsDir = path.join(process.cwd(), 'downloads');

    // Verificar se os diretórios existem
    if (!fs.existsSync(tessDir)) {
      console.log('❌ Diretório tess_responses não encontrado');
      return;
    }

    if (!fs.existsSync(downloadsDir)) {
      console.log('❌ Diretório downloads não encontrado');
      return;
    }

    // Listar arquivos TESS
    const arquivosTess = fs.readdirSync(tessDir)
      .filter(arquivo => arquivo.endsWith('_tess_response.txt'))
      .sort();

    console.log(`📁 Arquivos TESS encontrados: ${arquivosTess.length}\n`);

    if (arquivosTess.length === 0) {
      console.log('❌ Nenhum arquivo TESS encontrado');
      return;
    }

    // Analisar cada arquivo
    let totalAnalisadas = 0;
    let precisamSuframa = 0;
    let naoPrecisamSuframa = 0;
    let semDadosEndereco = 0;

    console.log('📋 ANÁLISE DETALHADA:\n');
    console.log('Arquivo | CNPJ | Razão Social | Estado | Cidade | Precisa SUFRAMA | Status');
    console.log('-'.repeat(100));

    for (const arquivo of arquivosTess) {
      try {
        const caminhoArquivo = path.join(tessDir, arquivo);
        const conteudo = fs.readFileSync(caminhoArquivo, 'utf-8');
        
        const dados = extrairDadosTESS(conteudo);
        totalAnalisadas++;

        if (!dados.estado) {
          semDadosEndereco++;
          console.log(
            `${arquivo.substring(0, 30).padEnd(30)} | ` +
            `${dados.cnpj || 'N/A'.padEnd(18)} | ` +
            `${(dados.razaoSocial || 'N/A').substring(0, 15).padEnd(15)} | ` +
            `N/A`.padEnd(6) + ' | ' +
            `N/A`.padEnd(15) + ' | ' +
            `N/A`.padEnd(15) + ' | ' +
            `❌ SEM DADOS`
          );
          continue;
        }

        const precisaSuframa = shouldQuerySuframa(dados.estado, dados.cidade);
        
        if (precisaSuframa) {
          precisamSuframa++;
        } else {
          naoPrecisamSuframa++;
        }

        const status = precisaSuframa ? '⚠️ PRECISA' : '➖ N/A';

        console.log(
          `${arquivo.substring(0, 30).padEnd(30)} | ` +
          `${dados.cnpj || 'N/A'.padEnd(18)} | ` +
          `${(dados.razaoSocial || 'N/A').substring(0, 15).padEnd(15)} | ` +
          `${dados.estado.padEnd(6)} | ` +
          `${(dados.cidade || 'N/A').substring(0, 15).padEnd(15)} | ` +
          `${precisaSuframa ? 'Sim' : 'Não'.padEnd(15)} | ` +
          `${status}`
        );

      } catch (error) {
        console.log(
          `${arquivo.substring(0, 30).padEnd(30)} | ` +
          `ERRO`.padEnd(18) + ' | ' +
          `ERRO`.padEnd(15) + ' | ' +
          `ERRO`.padEnd(6) + ' | ' +
          `ERRO`.padEnd(15) + ' | ' +
          `ERRO`.padEnd(15) + ' | ' +
          `❌ ERRO`
        );
      }
    }

    // Resumo estatístico
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMO ESTATÍSTICO:');
    console.log('='.repeat(80));
    console.log(`Total de arquivos analisados: ${totalAnalisadas}`);
    console.log(`Precisam de SUFRAMA: ${precisamSuframa}`);
    console.log(`Não precisam de SUFRAMA: ${naoPrecisamSuframa}`);
    console.log(`Sem dados de endereço: ${semDadosEndereco}`);

    // Detalhamento por estado
    console.log('\n📈 DISTRIBUIÇÃO POR ESTADO:');
    console.log('-'.repeat(50));
    
    const estadosCount: { [key: string]: { total: number; precisaSuframa: number } } = {};
    
    for (const arquivo of arquivosTess) {
      try {
        const caminhoArquivo = path.join(tessDir, arquivo);
        const conteudo = fs.readFileSync(caminhoArquivo, 'utf-8');
        const dados = extrairDadosTESS(conteudo);
        
        if (dados.estado) {
          const estado = dados.estado;
          const precisaSuframa = shouldQuerySuframa(estado, dados.cidade);
          
          if (!estadosCount[estado]) {
            estadosCount[estado] = { total: 0, precisaSuframa: 0 };
          }
          
          estadosCount[estado].total++;
          if (precisaSuframa) {
            estadosCount[estado].precisaSuframa++;
          }
        }
      } catch (error) {
        // Ignorar erros de leitura
      }
    }

    for (const [estado, dados] of Object.entries(estadosCount)) {
      const status = dados.precisaSuframa > 0 ? '⚠️' : '➖';
      
      console.log(
        `${estado.padEnd(6)} | ` +
        `Total: ${dados.total.toString().padEnd(3)} | ` +
        `Precisa SUFRAMA: ${dados.precisaSuframa.toString().padEnd(3)} | ` +
        `${status}`
      );
    }

    // Listar CNPJs que precisam de SUFRAMA
    if (precisamSuframa > 0) {
      console.log('\n⚠️  CNPJs QUE PRECISAM DE CONSULTA SUFRAMA:');
      console.log('-'.repeat(50));
      
      for (const arquivo of arquivosTess) {
        try {
          const caminhoArquivo = path.join(tessDir, arquivo);
          const conteudo = fs.readFileSync(caminhoArquivo, 'utf-8');
          const dados = extrairDadosTESS(conteudo);
          
          if (dados.estado && shouldQuerySuframa(dados.estado, dados.cidade)) {
            const cnpjLimpo = dados.cnpj?.replace(/[^\d]/g, '') || 'N/A';
            console.log(`- ${cnpjLimpo} (${dados.estado}/${dados.cidade})`);
          }
        } catch (error) {
          // Ignorar erros
        }
      }
    }

    // Recomendações
    console.log('\n💡 RECOMENDAÇÕES:');
    console.log('-'.repeat(50));
    
    if (precisamSuframa > 0) {
      console.log(`⚠️  ${precisamSuframa} empresas precisam de consulta SUFRAMA`);
      console.log('   Execute: npm run sistema-completo <CNPJ1> <CNPJ2> ...');
    } else {
      console.log('✅ Nenhuma empresa precisa de SUFRAMA');
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
  analisarArquivosSuframa().catch(console.error);
}

export { analisarArquivosSuframa };
