import { SPCBot } from './spcBot';
import { TessService } from './tessService';
import { CNPJAService, CNPJAConfig } from './cnpjaService';
import { DatabaseService, DatabaseConfig } from './databaseService';
import { Logger } from '../utils/logger';
import { config } from '../config';

export interface SistemaIntegradoConfig {
  spc: {
    headless: boolean;
    timeout: number;
  };
  tess: {
    apiKey: string;
    baseUrl: string;
  };
  cnpja: CNPJAConfig;
  database: DatabaseConfig;
}

export interface ConsultaCompletaResult {
  success: boolean;
  cnpj: string;
  dataConsulta: Date;
  spc: {
    sucesso: boolean;
    arquivo?: string;
    erro?: string;
  };
  tess: {
    sucesso: boolean;
    resposta?: string;
    erro?: string;
  };
  cnpja: {
    sucesso: boolean;
    dados?: any;
    erro?: string;
  };
  database: {
    sucesso: boolean;
    empresaId?: number;
    erro?: string;
  };
  custoTotal: number;
}

export class SistemaIntegradoCompleto {
  private spcBot: SPCBot;
  private tessService: TessService;
  private cnpjaService: CNPJAService;
  private databaseService: DatabaseService;

  constructor(config: SistemaIntegradoConfig) {
    this.spcBot = new SPCBot(config.spc);
    this.tessService = new TessService(config.tess);
    this.cnpjaService = new CNPJAService(config.cnpja);
    this.databaseService = new DatabaseService(config.database);
  }

  /**
   * Executa consulta completa: SPC -> TESS -> CNPJÁ -> Database
   */
  async consultarCNPJCompleto(cnpj: string): Promise<ConsultaCompletaResult> {
    const resultado: ConsultaCompletaResult = {
      success: false,
      cnpj,
      dataConsulta: new Date(),
      spc: { sucesso: false },
      tess: { sucesso: false },
      cnpja: { sucesso: false },
      database: { sucesso: false },
      custoTotal: 0
    };

    try {
      console.log(`\n🚀 Iniciando consulta completa para CNPJ: ${cnpj}`);
      console.log('='.repeat(80));

      // 1. CONSULTA SPC
      console.log('\n📋 1. Consultando SPC...');
      try {
        const spcResult = await this.spcBot.consultarCNPJ(cnpj);
        resultado.spc.sucesso = spcResult.success;
        resultado.spc.arquivo = spcResult.pdfPath;
        resultado.spc.erro = spcResult.error;
        
        if (spcResult.success) {
          console.log(`✅ SPC: PDF salvo em ${spcResult.pdfPath}`);
        } else {
          console.log(`❌ SPC: ${spcResult.error}`);
          throw new Error(`Falha na consulta SPC: ${spcResult.error}`);
        }
      } catch (error) {
        resultado.spc.erro = error instanceof Error ? error.message : 'Erro desconhecido';
        console.log(`❌ SPC: ${resultado.spc.erro}`);
        throw error;
      }

      // 2. PROCESSAMENTO TESS
      console.log('\n🤖 2. Processando com TESS...');
      try {
        const tessResult = await this.tessService.processarPDF(resultado.spc.arquivo!);
        resultado.tess.sucesso = tessResult.success;
        resultado.tess.resposta = tessResult.response;
        resultado.tess.erro = tessResult.error;
        resultado.custoTotal += tessResult.creditosUtilizados || 0;
        
        if (tessResult.success) {
          console.log(`✅ TESS: Processado com sucesso (${tessResult.creditosUtilizados || 0} créditos)`);
        } else {
          console.log(`❌ TESS: ${tessResult.error}`);
          throw new Error(`Falha no processamento TESS: ${tessResult.error}`);
        }
      } catch (error) {
        resultado.tess.erro = error instanceof Error ? error.message : 'Erro desconhecido';
        console.log(`❌ TESS: ${resultado.tess.erro}`);
        throw error;
      }

      // 3. CONSULTA CNPJÁ
      console.log('\n🏢 3. Consultando CNPJÁ...');
      try {
        const cnpjaResult = await this.cnpjaService.queryCompany(cnpj);
        resultado.cnpja.sucesso = cnpjaResult.success;
        resultado.cnpja.dados = cnpjaResult.data;
        resultado.cnpja.erro = cnpjaResult.error;
        
        // Custo CNPJÁ: 1 base + 2 parâmetros (IE + geocoding) = 3 ₪
        // Se SUFRAMA foi consultado, adiciona +1 ₪
        let custoCnpja = 3;
        if (cnpjaResult.data?.suframa && cnpjaResult.data.suframa.length > 0) {
          custoCnpja = 4;
        }
        resultado.custoTotal += custoCnpja;
        
        if (cnpjaResult.success) {
          console.log(`✅ CNPJÁ: Dados obtidos (${custoCnpja} ₪)`);
          console.log(`   - Razão Social: ${cnpjaResult.data?.company.name || 'N/A'}`);
          console.log(`   - IE: ${cnpjaResult.data?.registrations?.[0]?.number || 'N/A'}`);
          console.log(`   - Coordenadas: ${cnpjaResult.data?.address?.latitude && cnpjaResult.data?.address?.longitude ? 
            `${cnpjaResult.data.address.latitude}, ${cnpjaResult.data.address.longitude}` : 'N/A'}`);
          console.log(`   - SUFRAMA: ${cnpjaResult.data?.suframa?.length || 0} inscrições`);
        } else {
          console.log(`❌ CNPJÁ: ${cnpjaResult.error}`);
          throw new Error(`Falha na consulta CNPJÁ: ${cnpjaResult.error}`);
        }
      } catch (error) {
        resultado.cnpja.erro = error instanceof Error ? error.message : 'Erro desconhecido';
        console.log(`❌ CNPJÁ: ${resultado.cnpja.erro}`);
        throw error;
      }

      // 4. INSERÇÃO NO BANCO DE DADOS
      console.log('\n💾 4. Salvando no banco de dados...');
      try {
        // Extrair dados do CNPJÁ para o banco
        const dadosCnpja = this.cnpjaService.extractDatabaseData(resultado.cnpja.dados!);
        
        // Preparar dados para inserção
        const dadosCompletos = {
          cnpj,
          data_consulta: resultado.dataConsulta,
          spc_sucesso: resultado.spc.sucesso,
          spc_arquivo: resultado.spc.arquivo,
          tess_sucesso: resultado.tess.sucesso,
          tess_resposta: resultado.tess.resposta,
          cnpja_sucesso: resultado.cnpja.sucesso,
          cnpja_erro: resultado.cnpja.erro,
          inscricao_estadual: dadosCnpja.inscricaoEstadual,
          inscricao_suframa: dadosCnpja.inscricaoSuframa,
          latitude: dadosCnpja.latitude,
          longitude: dadosCnpja.longitude,
          endereco_completo: dadosCnpja.enderecoCompleto,
          atividade_principal: dadosCnpja.atividadePrincipal,
          porte: dadosCnpja.porte,
          telefone: dadosCnpja.telefone,
          email: dadosCnpja.email,
          website: dadosCnpja.website,
          razao_social: dadosCnpja.razaoSocial,
          nome_fantasia: dadosCnpja.nomeFantasia,
          situacao: dadosCnpja.situacao,
          data_abertura: dadosCnpja.dataAbertura,
          natureza_juridica: dadosCnpja.naturezaJuridica,
          capital_social: dadosCnpja.capitalSocial,
          cnpja_response: JSON.stringify(resultado.cnpja.dados)
        };

        const dbResult = await this.databaseService.insertCompanyData(dadosCompletos);
        resultado.database.sucesso = dbResult.success;
        resultado.database.empresaId = dbResult.empresaId;
        resultado.database.erro = dbResult.error;
        
        if (dbResult.success) {
          console.log(`✅ Database: Dados salvos (ID: ${dbResult.empresaId})`);
        } else {
          console.log(`❌ Database: ${dbResult.error}`);
          throw new Error(`Falha ao salvar no banco: ${dbResult.error}`);
        }
      } catch (error) {
        resultado.database.erro = error instanceof Error ? error.message : 'Erro desconhecido';
        console.log(`❌ Database: ${resultado.database.erro}`);
        throw error;
      }

      // Sucesso completo
      resultado.success = true;
      console.log('\n🎉 Consulta completa realizada com sucesso!');
      console.log(`💰 Custo total: ${resultado.custoTotal} ₪`);
      console.log(`📊 Resumo:`);
      console.log(`   - SPC: ${resultado.spc.sucesso ? '✅' : '❌'}`);
      console.log(`   - TESS: ${resultado.tess.sucesso ? '✅' : '❌'}`);
      console.log(`   - CNPJÁ: ${resultado.cnpja.sucesso ? '✅' : '❌'}`);
      console.log(`   - Database: ${resultado.database.sucesso ? '✅' : '❌'}`);

      Logger.success(`Consulta completa ${cnpj} concluída`, {
        custoTotal: resultado.custoTotal,
        empresaId: resultado.database.empresaId
      });

    } catch (error) {
      console.error('\n❌ Erro na consulta completa:', error);
      Logger.error(`Falha na consulta completa ${cnpj}`, { error: error instanceof Error ? error.message : 'Erro desconhecido' });
    }

    return resultado;
  }

  /**
   * Consulta múltiplos CNPJs
   */
  async consultarMultiplosCNPJs(cnpjs: string[]): Promise<ConsultaCompletaResult[]> {
    console.log(`\n🚀 Iniciando consulta de ${cnpjs.length} CNPJs`);
    console.log('='.repeat(80));

    const resultados: ConsultaCompletaResult[] = [];
    
    for (let i = 0; i < cnpjs.length; i++) {
      const cnpj = cnpjs[i];
      console.log(`\n📋 Processando CNPJ ${i + 1}/${cnpjs.length}: ${cnpj}`);
      
      try {
        const resultado = await this.consultarCNPJCompleto(cnpj);
        resultados.push(resultado);
        
        // Aguarda 2 segundos entre consultas para respeitar rate limiting
        if (i < cnpjs.length - 1) {
          console.log('⏳ Aguardando 2 segundos...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        console.error(`❌ Erro ao processar CNPJ ${cnpj}:`, error);
        resultados.push({
          success: false,
          cnpj,
          dataConsulta: new Date(),
          spc: { sucesso: false, erro: error instanceof Error ? error.message : 'Erro desconhecido' },
          tess: { sucesso: false },
          cnpja: { sucesso: false },
          database: { sucesso: false },
          custoTotal: 0
        });
      }
    }

    // Resumo final
    const sucessos = resultados.filter(r => r.success).length;
    const falhas = resultados.filter(r => !r.success).length;
    const custoTotal = resultados.reduce((total, r) => total + r.custoTotal, 0);

    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMO FINAL');
    console.log('='.repeat(80));
    console.log(`Total de CNPJs: ${resultados.length}`);
    console.log(`Sucessos: ${sucessos}`);
    console.log(`Falhas: ${falhas}`);
    console.log(`Custo total: ${custoTotal} ₪`);

    Logger.success(`Consulta em lote concluída`, {
      total: resultados.length,
      sucessos,
      falhas,
      custoTotal
    });

    return resultados;
  }
}
