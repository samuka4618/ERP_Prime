import * as sql from 'mssql';
import { getSqlConnection } from '../config/sqlserver';

export interface AnaliseCredito {
  // Dados da Empresa
  empresa_id: number;
  cnpj: string;
  inscricao_estadual?: string;
  razao_social: string;
  nome_fantasia?: string;
  situacao_cnpj?: string;
  
  // Endereço
  endereco?: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
    longitude?: number;
    latitude?: number;
  };
  
  // Dados de Contato
  contato?: {
    telefones?: string[];
    emails?: string[];
  };
  
  // Ocorrências
  ocorrencias?: {
    score_pj?: number;
    historico_scr?: number;
    historico_pagamentos_positivo?: number;
    limite_credito_pj?: number;
    quadro_administrativo?: number;
    consultas_realizadas?: number;
    gasto_financeiro_estimado?: number;
    controle_societario?: number;
  };
  
  // Score de Crédito
  score_credito?: {
    score?: number;
    risco?: string;
    probabilidade_inadimplencia?: number;
    limite_credito_valor?: number;
    gasto_financeiro_estimado_valor?: number;
  };
  
  // Histórico de Pagamento Positivo
  historico_pagamento?: {
    compromissos_ativos?: string;
    contratos_ativos?: number;
    credores?: number;
    parcelas_a_vencer_percentual?: number;
    parcelas_pagas_percentual?: number;
    parcelas_abertas_percentual?: number;
    contratos_pagos?: string;
    contratos_abertos?: string;
    uso_cheque_especial?: boolean;
  };
  
  // SCR
  scr?: {
    quantidade_operacoes?: number;
    inicio_relacionamento?: Date;
    valor_contratado?: string;
    instituicoes?: number;
    carteira_ativa_total?: string;
    vencimento_ultima_parcela?: string;
    garantias_quantidade_maxima?: number;
    tipos_garantias?: string[];
  };
  
  // Socios
  socios?: Array<{
    cpf: string;
    nome: string;
    entrada?: Date;
    participacao?: number;
    valor_participacao?: number;
    percentual_participacao?: number;
    cargo?: string;
  }>;
  
  // Quadro Administrativo
  quadro_administrativo?: Array<{
    cpf: string;
    nome: string;
    cargo?: string;
    eleito_em?: Date;
  }>;
  
  // Consultas Realizadas
  consultas_realizadas?: Array<{
    data_hora?: Date;
    associado?: string;
    cidade?: string;
    origem?: string;
  }>;
}

export class AnaliseCreditoModel {
  static async findByCNPJ(cnpj: string): Promise<AnaliseCredito | null> {
    try {
      // Limpar CNPJ
      const cleanCNPJ = cnpj.replace(/\D/g, '');
      
      console.log(`🔍 [ANALISE-CREDITO] Buscando para CNPJ: ${cnpj} (limpo: ${cleanCNPJ})`);
      
      const pool = await getSqlConnection('consultas_tess'); // Banco de consultas
      
      // Buscar empresa (normalizar CNPJ na busca para encontrar com ou sem formatação)
      // Usar REPLACE para remover formatação e comparar apenas números
      // Nota: A tabela empresa não tem 'nome_fantasia' nem 'situacao', apenas 'situacao_cnpj'
      const empresaResult = await pool.request()
        .input('cnpj', sql.VarChar, cleanCNPJ)
        .query(`
          SELECT TOP 1 id, cnpj, inscricao_estadual, razao_social, situacao_cnpj, fundacao
          FROM empresa
          WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '') = @cnpj
          ORDER BY updated_at DESC, id DESC
        `);
      
      console.log(`🔍 [ANALISE-CREDITO] Empresas encontradas: ${empresaResult.recordset.length}`);
      
      // Se não encontrou, tentar buscar todos os CNPJs similares para debug
      if (!empresaResult.recordset[0]) {
        console.log(`❌ [ANALISE-CREDITO] Nenhuma empresa encontrada para CNPJ: ${cleanCNPJ}`);
        
        // Debug: tentar buscar qualquer registro similar
        const debugResult = await pool.request().query(`
          SELECT TOP 5 cnpj, razao_social, id, updated_at
          FROM empresa
          WHERE cnpj LIKE '%${cleanCNPJ.substring(0, 8)}%'
          ORDER BY updated_at DESC
        `);
        
        if (debugResult.recordset.length > 0) {
          console.log(`🔍 [ANALISE-CREDITO] CNPJs similares encontrados (para debug):`);
          debugResult.recordset.forEach((row: any) => {
            console.log(`   - CNPJ: ${row.cnpj}, Razão Social: ${row.razao_social}, ID: ${row.id}`);
          });
        } else {
          console.log(`❌ [ANALISE-CREDITO] Nenhum CNPJ similar encontrado. Empresa pode não ter sido processada ainda.`);
        }
        
        return null;
      }
      
      const empresa = empresaResult.recordset[0];
      const empresaId = empresa.id;
      
      // Buscar dados relacionados (pegar os mais recentes quando houver múltiplos)
      // Usar try-catch individual para cada query para não quebrar se uma falhar
      let enderecoResult: any = { recordset: [] };
      let dadosContatoResult: any = { recordset: [] };
      let ocorrenciasResult: any = { recordset: [] };
      let scoreResult: any = { recordset: [] };
      let historicoResult: any = { recordset: [] };
      let scrResult: any = { recordset: [] };
      let sociosResult: any = { recordset: [] };
      let quadroResult: any = { recordset: [] };
      let consultasRealizadasResult: any = { recordset: [] };

      try {
        [enderecoResult, dadosContatoResult, ocorrenciasResult, scoreResult, historicoResult, scrResult, sociosResult, quadroResult, consultasRealizadasResult] = await Promise.all([
          pool.request().query(`SELECT TOP 1 * FROM endereco WHERE id_empresa = ${empresaId} ORDER BY updated_at DESC, id DESC`).catch(err => { console.warn('⚠️ Erro ao buscar endereço:', err); return { recordset: [] }; }),
          pool.request().query(`SELECT TOP 1 * FROM dados_contato WHERE id_empresa = ${empresaId} ORDER BY updated_at DESC, id DESC`).catch(err => { console.warn('⚠️ Erro ao buscar dados_contato:', err); return { recordset: [] }; }),
          pool.request().query(`SELECT TOP 1 * FROM ocorrencias WHERE id_empresa = ${empresaId} ORDER BY updated_at DESC, id DESC`).catch(err => { console.warn('⚠️ Erro ao buscar ocorrencias:', err); return { recordset: [] }; }),
          pool.request().query(`SELECT TOP 1 * FROM score_credito WHERE id_empresa = ${empresaId} ORDER BY updated_at DESC, id DESC`).catch(err => { console.warn('⚠️ Erro ao buscar score_credito:', err); return { recordset: [] }; }),
          pool.request().query(`SELECT TOP 1 * FROM historico_pagamento_positivo WHERE id_empresa = ${empresaId} ORDER BY updated_at DESC, id DESC`).catch(err => { console.warn('⚠️ Erro ao buscar historico_pagamento_positivo:', err); return { recordset: [] }; }),
          pool.request().query(`SELECT TOP 1 * FROM scr WHERE id_empresa = ${empresaId} ORDER BY updated_at DESC, id DESC`).catch(err => { console.warn('⚠️ Erro ao buscar scr:', err); return { recordset: [] }; }),
          pool.request().query(`SELECT cpf, nome, entrada, participacao, valor_participacao, percentual_participacao, cargo FROM socios WHERE id_empresa = ${empresaId} ORDER BY id`).catch(err => { console.warn('⚠️ Erro ao buscar socios:', err); return { recordset: [] }; }),
          pool.request().query(`SELECT cpf, nome, cargo, eleito_em FROM quadro_administrativo WHERE id_empresa = ${empresaId} ORDER BY id`).catch(err => { console.warn('⚠️ Erro ao buscar quadro_administrativo:', err); return { recordset: [] }; }),
          pool.request().query(`SELECT * FROM consultas_realizadas WHERE id_empresa = ${empresaId} ORDER BY data_hora DESC`).catch(err => { console.warn('⚠️ Erro ao buscar consultas_realizadas:', err); return { recordset: [] }; })
        ]);
      } catch (error) {
        console.error('❌ [ANALISE-CREDITO] Erro ao buscar dados relacionados:', error);
        // Continuar mesmo com erro parcial
      }
      
      // Buscar garantias se SCR existe
      let garantiasResult: any = { recordset: [] };
      if (scrResult.recordset[0]?.id) {
        garantiasResult = await pool.request().query(`SELECT tipo_garantia FROM tipos_garantias WHERE id_scr = ${scrResult.recordset[0].id}`);
      }
      
      // Processar dados de contato (JSON)
      let telefones: string[] = [];
      let emails: string[] = [];
      if (dadosContatoResult.recordset[0]) {
        try {
          if (dadosContatoResult.recordset[0].telefones_fixos) {
            const telFixos = typeof dadosContatoResult.recordset[0].telefones_fixos === 'string' 
              ? JSON.parse(dadosContatoResult.recordset[0].telefones_fixos) 
              : dadosContatoResult.recordset[0].telefones_fixos;
            if (Array.isArray(telFixos)) telefones.push(...telFixos);
          }
          if (dadosContatoResult.recordset[0].telefones_celulares) {
            const telCel = typeof dadosContatoResult.recordset[0].telefones_celulares === 'string'
              ? JSON.parse(dadosContatoResult.recordset[0].telefones_celulares)
              : dadosContatoResult.recordset[0].telefones_celulares;
            if (Array.isArray(telCel)) telefones.push(...telCel);
          }
          if (dadosContatoResult.recordset[0].emails) {
            const emailsData = typeof dadosContatoResult.recordset[0].emails === 'string'
              ? JSON.parse(dadosContatoResult.recordset[0].emails)
              : dadosContatoResult.recordset[0].emails;
            if (Array.isArray(emailsData)) emails.push(...emailsData);
          }
        } catch (e) {
          console.warn('⚠️ [ANALISE-CREDITO] Erro ao processar dados de contato:', e);
        }
      }

      console.log(`✅ [ANALISE-CREDITO] Dados encontrados para empresa ID: ${empresaId}`);
      console.log(`   - Endereço: ${enderecoResult.recordset.length > 0 ? 'Sim' : 'Não'}`);
      console.log(`   - Dados Contato: ${dadosContatoResult.recordset.length > 0 ? 'Sim' : 'Não'} (${telefones.length} telefones, ${emails.length} emails)`);
      console.log(`   - Ocorrências: ${ocorrenciasResult.recordset.length > 0 ? 'Sim' : 'Não'}`);
      if (ocorrenciasResult.recordset.length > 0) {
        console.log(`      Ocorrências data:`, JSON.stringify(ocorrenciasResult.recordset[0], null, 2));
      }
      console.log(`   - Score: ${scoreResult.recordset.length > 0 ? 'Sim' : 'Não'}`);
      if (scoreResult.recordset.length > 0) {
        console.log(`      Score data:`, JSON.stringify(scoreResult.recordset[0], null, 2));
      }
      console.log(`   - Histórico Pagamento: ${historicoResult.recordset.length > 0 ? 'Sim' : 'Não'}`);
      if (historicoResult.recordset.length > 0) {
        console.log(`      Histórico data:`, JSON.stringify(historicoResult.recordset[0], null, 2));
      }
      console.log(`   - SCR: ${scrResult.recordset.length > 0 ? 'Sim' : 'Não'}`);
      if (scrResult.recordset.length > 0) {
        console.log(`      SCR data:`, JSON.stringify(scrResult.recordset[0], null, 2));
      }
      console.log(`   - Sócios: ${sociosResult.recordset.length}`);
      if (sociosResult.recordset.length > 0) {
        console.log(`      Primeiro sócio:`, JSON.stringify(sociosResult.recordset[0], null, 2));
      }
      console.log(`   - Quadro Admin: ${quadroResult.recordset.length}`);
      console.log(`   - Consultas Realizadas: ${consultasRealizadasResult.recordset.length}`);
      
      const resultado = {
        empresa_id: empresa.id,
        cnpj: empresa.cnpj,
        inscricao_estadual: empresa.inscricao_estadual,
        razao_social: empresa.razao_social,
        nome_fantasia: undefined, // Campo não existe na tabela empresa
        situacao_cnpj: empresa.situacao_cnpj,
        endereco: enderecoResult.recordset[0] ? {
          logradouro: enderecoResult.recordset[0].logradouro,
          numero: enderecoResult.recordset[0].numero,
          complemento: enderecoResult.recordset[0].complemento,
          bairro: enderecoResult.recordset[0].bairro,
          cidade: enderecoResult.recordset[0].cidade,
          estado: enderecoResult.recordset[0].estado,
          cep: enderecoResult.recordset[0].cep,
          longitude: enderecoResult.recordset[0].longitude ? Number(enderecoResult.recordset[0].longitude) : undefined,
          latitude: enderecoResult.recordset[0].latitude ? Number(enderecoResult.recordset[0].latitude) : undefined,
        } : undefined,
        // Dados de contato
        contato: (telefones.length > 0 || emails.length > 0) ? {
          telefones,
          emails
        } : undefined,
        ocorrencias: ocorrenciasResult.recordset[0] ? {
          score_pj: ocorrenciasResult.recordset[0].score_pj,
          historico_scr: ocorrenciasResult.recordset[0].historico_scr,
          historico_pagamentos_positivo: ocorrenciasResult.recordset[0].historico_pagamentos_positivo,
          limite_credito_pj: ocorrenciasResult.recordset[0].limite_credito_pj,
          quadro_administrativo: ocorrenciasResult.recordset[0].quadro_administrativo,
          consultas_realizadas: ocorrenciasResult.recordset[0].consultas_realizadas,
          gasto_financeiro_estimado: ocorrenciasResult.recordset[0].gasto_financeiro_estimado,
          controle_societario: ocorrenciasResult.recordset[0].controle_societario,
        } : undefined,
        score_credito: scoreResult.recordset[0] ? {
          score: scoreResult.recordset[0].score,
          risco: scoreResult.recordset[0].risco,
          probabilidade_inadimplencia: scoreResult.recordset[0].probabilidade_inadimplencia,
          limite_credito_valor: scoreResult.recordset[0].limite_credito_valor,
          gasto_financeiro_estimado_valor: scoreResult.recordset[0].gasto_financeiro_estimado_valor,
        } : undefined,
        historico_pagamento: historicoResult.recordset[0] ? {
          compromissos_ativos: historicoResult.recordset[0].compromissos_ativos,
          contratos_ativos: historicoResult.recordset[0].contratos_ativos,
          credores: historicoResult.recordset[0].credores,
          parcelas_a_vencer_percentual: historicoResult.recordset[0].parcelas_a_vencer_percentual,
          parcelas_pagas_percentual: historicoResult.recordset[0].parcelas_pagas_percentual,
          parcelas_abertas_percentual: historicoResult.recordset[0].parcelas_abertas_percentual,
          contratos_pagos: historicoResult.recordset[0].contratos_pagos,
          contratos_abertos: historicoResult.recordset[0].contratos_abertos,
          uso_cheque_especial: historicoResult.recordset[0].uso_cheque_especial,
        } : undefined,
        scr: scrResult.recordset[0] ? {
          quantidade_operacoes: scrResult.recordset[0].quantidade_operacoes,
          inicio_relacionamento: scrResult.recordset[0].inicio_relacionamento,
          valor_contratado: scrResult.recordset[0].valor_contratado,
          instituicoes: scrResult.recordset[0].instituicoes,
          carteira_ativa_total: scrResult.recordset[0].carteira_ativa_total,
          vencimento_ultima_parcela: scrResult.recordset[0].vencimento_ultima_parcela,
          garantias_quantidade_maxima: scrResult.recordset[0].garantias_quantidade_maxima,
          tipos_garantias: garantiasResult.recordset.map((g: any) => g.tipo_garantia),
        } : undefined,
        socios: sociosResult.recordset.map((s: any) => ({
          cpf: s.cpf,
          nome: s.nome,
          entrada: s.entrada ? new Date(s.entrada) : undefined,
          participacao: s.participacao ? Number(s.participacao) : undefined,
          valor_participacao: s.valor_participacao ? Number(s.valor_participacao) : undefined,
          percentual_participacao: s.percentual_participacao ? Number(s.percentual_participacao) : undefined,
          cargo: s.cargo
        })),
        quadro_administrativo: quadroResult.recordset.map((q: any) => ({
          cpf: q.cpf,
          nome: q.nome,
          cargo: q.cargo,
          eleito_em: q.eleito_em ? new Date(q.eleito_em) : undefined
        })),
        // Consultas realizadas
        consultas_realizadas: consultasRealizadasResult.recordset.map((c: any) => ({
          data_hora: c.data_hora ? new Date(c.data_hora) : undefined,
          associado: c.associado,
          cidade: c.cidade,
          origem: c.origem
        })),
      };
      
      console.log(`📊 [ANALISE-CREDITO] Resumo do retorno:`);
      console.log(`   - Tem ocorrências: ${resultado.ocorrencias ? 'Sim' : 'Não'}`);
      console.log(`   - Tem score: ${resultado.score_credito ? 'Sim' : 'Não'}`);
      console.log(`   - Tem histórico: ${resultado.historico_pagamento ? 'Sim' : 'Não'}`);
      console.log(`   - Tem SCR: ${resultado.scr ? 'Sim' : 'Não'}`);
      console.log(`   - Sócios: ${resultado.socios.length}`);
      console.log(`   - Quadro Admin: ${resultado.quadro_administrativo.length}`);
      console.log(`   - Consultas: ${resultado.consultas_realizadas.length}`);
      
      return resultado;
      
    } catch (error) {
      console.error('Erro ao buscar análise de crédito:', error);
      throw error;
    }
  }
}

