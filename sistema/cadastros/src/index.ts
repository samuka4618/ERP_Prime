import { SPCBot } from './services/spcBot';
import { TessService } from './services/tessService';
import { CNPJAService } from './services/cnpjaService';
import { DatabaseService } from './services/databaseService';
import { config, tessConfig, cnpjaConfig, databaseConfig, validateConfig, validateTessConfig, validateCNPJAConfig } from './config';
import { SimpleWatcher } from './simple-watcher';
import { TessDataParserNew } from './services/tessDataParserNew';

async function main() {
  try {
    console.log('=== Bot de Consulta CNPJ SPC - Modo Simples ===');
    console.log('Iniciando sistema...\n');

    // Valida as configurações
    validateConfig();

    // Determina o modo de operação
    if (config.excelFile) {
      // Modo watch - fica aguardando mudanças no Excel
      console.log('📊 Modo Excel detectado - usando sistema integrado completo');
      const watcher = new SimpleWatcher();
      watcher.start();
    } else if (config.cnpjToQuery) {
      // Modo CNPJ único
      console.log('🔍 Modo CNPJ único - usando sistema integrado completo');
      await processSingleCNPJ();
    } else {
      console.log('❌ Configure CNPJ_TO_QUERY ou EXCEL_FILE no arquivo .env');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  }
}

/**
 * Processa um único CNPJ
 */
async function processSingleCNPJ() {
  console.log('Processando CNPJ único...');
  
  const cnpj = config.cnpjToQuery!;
  
  try {
    // Cria instância do bot
    const bot = new SPCBot({
      url: config.url,
      operador: config.operador,
      senha: config.senha,
      palavraSecreta: config.palavraSecreta,
      downloadPath: config.downloadPath,
      cnpjToQuery: cnpj,
      headless: config.headless,
      browserTimeout: config.browserTimeout,
      debug: config.debug,
      cnpjCacheExpirationHours: config.cnpjCacheExpirationHours
    });

    // Executa a consulta
    const result = await bot.executeQuery(cnpj);

    // Exibe o resultado
    console.log('\n=== Resultado ===');
    if (result.success) {
      console.log('✅ Consulta realizada com sucesso!');
      console.log(`📄 CNPJ: ${result.cnpj}`);
      console.log(`📁 Arquivo: ${result.fileName}`);
      console.log(`📂 Caminho: ${result.filePath}`);
      console.log(`⏰ Timestamp: ${result.timestamp.toISOString()}`);

      // Processa o PDF com TESS AI se configurado
      if (result.filePath) {
        await processWithTESS(cnpj, result.filePath, result.fileName || '');
      }
    } else {
      console.log('❌ Falha na consulta');
      console.log(`📄 CNPJ: ${result.cnpj}`);
      console.log(`❌ Erro: ${result.error}`);
      console.log(`⏰ Timestamp: ${result.timestamp.toISOString()}`);
    }

  } catch (error) {
    console.error('❌ Erro ao processar CNPJ:', error);
  }
}

/**
 * Processa o PDF com TESS AI, CNPJÁ e salva no banco
 */
async function processWithTESS(cnpj: string, filePath: string, fileName: string): Promise<void> {
  try {
    // Verifica se TESS está configurado
    if (!tessConfig.apiKey || !tessConfig.agentId) {
      console.log('⚠️  TESS AI não configurado - pulando processamento');
      return;
    }

    console.log(`\n🤖 Processando PDF com TESS AI: ${fileName}`);
    
    // Cria instância do serviço TESS
    const tessService = new TessService(tessConfig);
    
    // Processa o PDF com TESS
    const tessResult = await tessService.processPDF(filePath, `Processe o documento de consulta CNPJ: ${cnpj}`);
    
    if (tessResult.success) {
      console.log(`✅ TESS AI processou com sucesso: ${fileName}`);
      console.log(`💳 Créditos utilizados: ${tessResult.credits}`);
      console.log(`📄 Resposta salva em: ${tessResult.response?.substring(0, 100)}...`);
      
      // 2. CONSULTA CNPJÁ
      console.log(`\n🏢 Consultando CNPJÁ: ${cnpj}`);
      await processWithCNPJA(cnpj, tessResult.response || '');
      
    } else {
      console.log(`❌ Falha no processamento TESS: ${tessResult.error}`);
    }
    
  } catch (error) {
    console.log(`❌ Erro no processamento TESS: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

/**
 * Processa com CNPJÁ e salva no banco
 */
async function processWithCNPJA(cnpj: string, tessResponse: string): Promise<void> {
  try {
    // Verifica se CNPJÁ está configurado
    if (!cnpjaConfig.apiKey) {
      console.log('⚠️  CNPJÁ não configurado - pulando consulta');
      return;
    }

    // Cria instância do serviço CNPJÁ
    const cnpjaService = new CNPJAService(cnpjaConfig);
    
    // Consulta CNPJÁ
    const cnpjaResult = await cnpjaService.queryCompany(cnpj);
    
    if (cnpjaResult.success) {
      console.log(`✅ CNPJÁ consultado com sucesso`);
      console.log(`🏢 Empresa: ${cnpjaResult.data?.company.name || 'N/A'}`);
      console.log(`📍 Estado: ${cnpjaResult.data?.address.state || 'N/A'}`);
      console.log(`🏭 SUFRAMA: ${cnpjaResult.data?.suframa?.length || 0} inscrições`);
      
      // 3. MERGE TESS + CNPJÁ
      console.log(`\n🧩 Combinando dados TESS + CNPJÁ...`);
      let extraidosTess: any = null;
      try {
        extraidosTess = tessResponse ? TessDataParserNew.extrairDadosTESSCompletos(tessResponse, cnpj) : null;
      } catch {}

      // Preferir TESS, complementar com CNPJÁ
      const dadosCnpja = cnpjaService.extractDatabaseData(cnpjaResult.data!);
      const merged = {
        inscricao_estadual: extraidosTess?.empresa?.inscricao_estadual || dadosCnpja.inscricaoEstadual || undefined,
        inscricao_suframa: dadosCnpja.inscricaoSuframa || undefined,
        latitude: extraidosTess?.endereco?.latitude || dadosCnpja.latitude || undefined,
        longitude: extraidosTess?.endereco?.longitude || dadosCnpja.longitude || undefined,
        endereco_completo: extraidosTess?.endereco?.logradouro ? `${extraidosTess.endereco.logradouro || ''}, ${extraidosTess.endereco.numero || ''}, ${extraidosTess.endereco.complemento || ''}, ${extraidosTess.endereco.bairro || ''}, ${extraidosTess.endereco.cidade || ''}, ${extraidosTess.endereco.estado || ''}, ${extraidosTess.endereco.cep || ''}`.replace(/(^,\s*|,\s*,)/g,'').trim() : (dadosCnpja.enderecoCompleto || undefined),
        atividade_principal: extraidosTess?.empresa?.atividade_principal || dadosCnpja.atividadePrincipal || undefined,
        porte: extraidosTess?.empresa?.porte || dadosCnpja.porte || undefined,
        telefone: (Array.isArray(extraidosTess?.dados_contato?.telefones_fixos) && extraidosTess?.dados_contato?.telefones_fixos[0]) || dadosCnpja.telefone || undefined,
        email: (Array.isArray(extraidosTess?.dados_contato?.emails) && extraidosTess?.dados_contato?.emails[0]) || dadosCnpja.email || undefined,
        website: dadosCnpja.website || undefined,
        razao_social: extraidosTess?.empresa?.razao_social || dadosCnpja.razaoSocial || undefined,
        nome_fantasia: extraidosTess?.empresa?.nome_fantasia || dadosCnpja.nomeFantasia || undefined,
        situacao: extraidosTess?.empresa?.situacao_cnpj || dadosCnpja.situacao || undefined,
        data_abertura: (extraidosTess?.empresa?.fundacao instanceof Date ? extraidosTess.empresa.fundacao.toISOString() : extraidosTess?.empresa?.fundacao) || dadosCnpja.dataAbertura || undefined,
        natureza_juridica: extraidosTess?.empresa?.natureza_juridica || dadosCnpja.naturezaJuridica || undefined,
        capital_social: extraidosTess?.empresa?.capital_social || dadosCnpja.capitalSocial || undefined
      };

      // 4. SALVAR NO BANCO
      console.log(`\n💾 Salvando dados no banco...`);
      await saveToDatabase(cnpj, tessResponse, cnpjaResult, merged);
      
    } else {
      console.log(`❌ Falha na consulta CNPJÁ: ${cnpjaResult.error}`);
    }
    
  } catch (error) {
    console.log(`❌ Erro na consulta CNPJÁ: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

/**
 * Salva dados no banco de dados
 */
async function saveToDatabase(cnpj: string, tessResponse: string, cnpjaResult: any, mergedOverrides?: any): Promise<void> {
  try {
    // Verifica se banco está configurado
    if (!databaseConfig.server) {
      console.log('⚠️  Banco de dados não configurado - pulando salvamento');
      return;
    }

    // Cria instância do serviço de banco
    const dbService = new DatabaseService(databaseConfig);
    
    // Extrai dados do CNPJÁ
    const cnpjaService = new CNPJAService(cnpjaConfig);
    const dadosCnpja = cnpjaResult.data ? cnpjaService.extractDatabaseData(cnpjaResult.data) : null;
    
    // Prepara dados para inserção
    const dadosCompletos = {
      cnpj,
      data_consulta: new Date(),
      spc_sucesso: true,
      spc_arquivo: '', // Será preenchido pelo SPC
      tess_sucesso: true,
      tess_resposta: tessResponse,
      cnpja_sucesso: cnpjaResult.success,
      cnpja_erro: cnpjaResult.error,
      inscricao_estadual: mergedOverrides?.inscricao_estadual ?? dadosCnpja?.inscricaoEstadual ?? undefined,
      inscricao_suframa: mergedOverrides?.inscricao_suframa ?? dadosCnpja?.inscricaoSuframa ?? undefined,
      latitude: mergedOverrides?.latitude ?? dadosCnpja?.latitude ?? undefined,
      longitude: mergedOverrides?.longitude ?? dadosCnpja?.longitude ?? undefined,
      endereco_completo: mergedOverrides?.endereco_completo ?? dadosCnpja?.enderecoCompleto ?? undefined,
      atividade_principal: mergedOverrides?.atividade_principal ?? dadosCnpja?.atividadePrincipal ?? undefined,
      porte: mergedOverrides?.porte ?? dadosCnpja?.porte ?? undefined,
      telefone: mergedOverrides?.telefone ?? dadosCnpja?.telefone ?? undefined,
      email: mergedOverrides?.email ?? dadosCnpja?.email ?? undefined,
      website: mergedOverrides?.website ?? dadosCnpja?.website ?? undefined,
      razao_social: mergedOverrides?.razao_social ?? dadosCnpja?.razaoSocial ?? undefined,
      nome_fantasia: mergedOverrides?.nome_fantasia ?? dadosCnpja?.nomeFantasia ?? undefined,
      situacao: mergedOverrides?.situacao ?? dadosCnpja?.situacao ?? undefined,
      data_abertura: mergedOverrides?.data_abertura ?? dadosCnpja?.dataAbertura ?? undefined,
      natureza_juridica: mergedOverrides?.natureza_juridica ?? dadosCnpja?.naturezaJuridica ?? undefined,
      capital_social: mergedOverrides?.capital_social ?? dadosCnpja?.capitalSocial ?? undefined,
      cnpja_response: JSON.stringify(cnpjaResult.data)
    };

    const dbResult = await dbService.insertCompanyData(dadosCompletos);
    
    if (dbResult.success) {
      console.log(`✅ Dados salvos no banco (ID: ${dbResult.empresaId})`);
    } else {
      console.log(`❌ Falha ao salvar no banco: ${dbResult.error}`);
    }
    
  } catch (error) {
    console.log(`❌ Erro ao salvar no banco: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

// Executa o programa
if (require.main === module) {
  main();
}
