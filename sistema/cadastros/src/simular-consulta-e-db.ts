import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { DatabaseService } from './services/databaseService';
import { CNPJAService, CNPJAResponse } from './services/cnpjaService';
import { cnpjaConfig, databaseConfig, config as baseConfig } from './config';

dotenv.config();

async function main() {
  const cnpjArg = process.argv[2] || baseConfig.cnpjToQuery;
  if (!cnpjArg) {
    console.error('❌ Informe um CNPJ. Ex.: npx ts-node src/simular-consulta-e-db.ts 17283362000130');
    process.exit(1);
  }

  const cnpj = cnpjArg.replace(/\D/g, '');
  console.log(`\n🔎 Simulando consulta e inserção para CNPJ: ${cnpj}`);

  // 1) Localiza um PDF existente deste CNPJ (para simular SPC)
  const downloadsDir = path.resolve(baseConfig.downloadPath || './downloads');
  let pdfPath: string | undefined;
  try {
    if (fs.existsSync(downloadsDir)) {
      const files = fs.readdirSync(downloadsDir)
        .filter(f => f.toLowerCase().endsWith('.pdf') && f.includes(cnpj))
        .sort((a, b) => fs.statSync(path.join(downloadsDir, b)).mtimeMs - fs.statSync(path.join(downloadsDir, a)).mtimeMs);
      if (files.length > 0) {
        pdfPath = path.join(downloadsDir, files[0]);
        console.log(`📄 PDF encontrado: ${pdfPath}`);
      } else {
        console.log('⚠️ Nenhum PDF encontrado para este CNPJ; seguindo sem arquivo do SPC.');
      }
    } else {
      console.log('⚠️ Pasta de downloads não encontrada; seguindo sem arquivo do SPC.');
    }
  } catch (e) {
    console.log('⚠️ Erro ao procurar PDF, seguindo sem arquivo do SPC.', e);
  }

  // 2) Obtém dados do CNPJÁ: usa arquivo salvo se existir; senão tenta API (se chave presente); senão aborta
  let cnpjaResponse: CNPJAResponse | undefined;
  const cnpjaDir = path.resolve('./cnpja_responses');
  try {
    const prefix = `cnpja_${cnpj}_`;
    if (fs.existsSync(cnpjaDir)) {
      const files = fs.readdirSync(cnpjaDir)
        .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
        .sort((a, b) => fs.statSync(path.join(cnpjaDir, b)).mtimeMs - fs.statSync(path.join(cnpjaDir, a)).mtimeMs);
      if (files.length > 0) {
        const latest = path.join(cnpjaDir, files[0]);
        const content = JSON.parse(fs.readFileSync(latest, 'utf8'));
        cnpjaResponse = content.response as CNPJAResponse;
        console.log(`🏢 CNPJÁ (arquivo) carregado: ${files[0]}`);
      }
    }
  } catch (e) {
    console.log('⚠️ Erro ao ler resposta CNPJÁ salva.', e);
  }

  if (!cnpjaResponse) {
    if (!cnpjaConfig.apiKey) {
      console.error('❌ Sem CNPJA_API_KEY e sem arquivo salvo para este CNPJ. Não é possível simular.');
      process.exit(1);
    }
    console.log('🌐 Consultando CNPJÁ via API (sem TESS/SPC)...');
    const cnpjaService = new CNPJAService(cnpjaConfig);
    const result = await cnpjaService.queryCompany(cnpj);
    if (!result.success || !result.data) {
      console.error(`❌ Falha ao obter dados do CNPJÁ: ${result.error || 'sem detalhes'}`);
      process.exit(1);
    }
    cnpjaResponse = result.data;
  }

  // 3) Extrai dados p/ banco usando o próprio extrator do serviço
  const cnpjaServiceForExtract = new CNPJAService(cnpjaConfig);
  const dadosCnpja = cnpjaServiceForExtract.extractDatabaseData(cnpjaResponse);

  // 4) Monta payload de inserção
  const dadosParaBanco = {
    cnpj,
    data_consulta: new Date(),
    spc_sucesso: !!pdfPath,
    spc_arquivo: pdfPath,
    tess_sucesso: false,
    tess_resposta: undefined as string | undefined,
    cnpja_sucesso: true,
    cnpja_erro: undefined as string | undefined,
    inscricao_estadual: dadosCnpja.inscricaoEstadual || undefined,
    inscricao_suframa: dadosCnpja.inscricaoSuframa || undefined,
    latitude: dadosCnpja.latitude || undefined,
    longitude: dadosCnpja.longitude || undefined,
    endereco_completo: dadosCnpja.enderecoCompleto || undefined,
    atividade_principal: dadosCnpja.atividadePrincipal || undefined,
    porte: dadosCnpja.porte || undefined,
    telefone: dadosCnpja.telefone || undefined,
    email: dadosCnpja.email || undefined,
    website: dadosCnpja.website || undefined,
    razao_social: dadosCnpja.razaoSocial || undefined,
    nome_fantasia: dadosCnpja.nomeFantasia || undefined,
    situacao: dadosCnpja.situacao || undefined,
    data_abertura: dadosCnpja.dataAbertura || undefined,
    natureza_juridica: dadosCnpja.naturezaJuridica || undefined,
    capital_social: dadosCnpja.capitalSocial || undefined,
    // inclui a resposta completa do CNPJÁ
    cnpja_response: JSON.stringify(cnpjaResponse)
  };

  // 5) Conecta no banco e tenta inserir, reportando o erro com detalhes
  const db = new DatabaseService(databaseConfig);
  try {
    console.log('\n🔌 Testando conexão com o SQL Server...');
    await db.connect();
  } catch (e) {
    console.error('❌ Falha na conexão com o banco. Verifique as variáveis DB_* no .env.');
    throw e;
  }

  try {
    console.log('🧪 Verificando stored procedures essenciais...');
    const okProcs = await db.testStoredProcedures();
    if (!okProcs) {
      console.error('❌ Stored procedures ausentes ou nome divergente. Cheque cadastros/database/*.sql');
    }
  } catch (e) {
    console.log('⚠️ Não foi possível validar todas as procedures. Prosseguindo para capturar erro real na inserção.');
  }

  console.log('\n💾 Tentando inserir dados no banco...');
  const result = await db.insertCompanyData(dadosParaBanco as any);
  if (result.success) {
    console.log(`✅ Inserção realizada. EmpresaID: ${result.empresaId}`);
  } else {
    console.error(`❌ Falha na inserção: ${result.error || 'sem mensagem'}`);
  }

  await db.disconnect();
}

main().catch(err => {
  console.error('❌ Erro inesperado na simulação:', err instanceof Error ? err.message : err);
  process.exit(1);
});


