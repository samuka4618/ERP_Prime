import { Logger } from '../utils/logger';
import { DadosTESSCompletos, DadosTESSResposta } from '../types/tessTypes';

export class TessDataParserNew {
  /**
   * Extrai dados estruturados da resposta da TESS para o novo schema
   */
  static extrairDadosTESSCompletos(respostaTESS: string, cnpj: string): DadosTESSCompletos {
    try {
      console.log('🔍 Extraindo dados estruturados da resposta TESS para novo schema...');
      
      // Tenta extrair JSON da resposta
      let jsonMatch = respostaTESS.match(/```json\s*(\{[\s\S]*?\})\s*```/);
      
      // Se não encontrou com marcadores, tenta sem eles
      if (!jsonMatch) {
        jsonMatch = respostaTESS.match(/(\{[\s\S]*\})/);
      }
      
      if (jsonMatch) {
        console.log('📄 JSON encontrado, fazendo parse...');
        try {
          const jsonData: DadosTESSResposta = JSON.parse(jsonMatch[1]);
          console.log('✅ JSON parseado com sucesso, extraindo dados...');
          return this.extrairDadosDoJSON(jsonData, cnpj);
        } catch (jsonError) {
          console.log('⚠️ Erro ao fazer parse do JSON, usando fallback...', jsonError);
          return this.extrairDadosFallback(respostaTESS, cnpj);
        }
      } else {
        console.log('📄 JSON não encontrado, usando extração por regex...');
        return this.extrairDadosFallback(respostaTESS, cnpj);
      }

    } catch (error) {
      console.error('❌ Erro ao extrair dados da resposta TESS:', error);
      Logger.error('Erro na extração de dados TESS', { error: error instanceof Error ? error.message : 'Erro desconhecido' });
      
      // Retorna dados básicos em caso de erro
      return this.criarDadosBasicos(cnpj);
    }
  }

  /**
   * Extrai dados do JSON da resposta TESS
   */
  private static extrairDadosDoJSON(jsonData: DadosTESSResposta, cnpj: string): DadosTESSCompletos {
    const dados: DadosTESSCompletos = {
      consulta: {
        operador: jsonData.consulta?.operador || 'Sistema',
        data_hora: this.parseDateFromISO(jsonData.consulta?.data_hora as any) || new Date(),
        produto: jsonData.consulta?.produto || 'SPC + POSITIVO AVANÇADO PJ',
        protocolo: jsonData.consulta?.protocolo || 'N/A'
      },
      empresa: {
        cnpj: cnpj,
        razao_social: jsonData.empresa?.razao_social || 'Empresa não identificada',
        situacao_cnpj: jsonData.empresa?.situacao_cnpj || 'N/A',
        atualizacao: this.parseDateFromISO((jsonData.empresa as any)?.atualizacao as any),
        fundacao: this.parseDateFromISO((jsonData.empresa as any)?.fundacao as any)
      },
      endereco: {
        logradouro: jsonData.empresa?.endereco?.logradouro,
        numero: jsonData.empresa?.endereco?.numero,
        complemento: jsonData.empresa?.endereco?.complemento,
        bairro: jsonData.empresa?.endereco?.bairro,
        cidade: jsonData.empresa?.endereco?.cidade,
        estado: jsonData.empresa?.endereco?.estado,
        cep: jsonData.empresa?.endereco?.cep
      },
      dados_contato: {
        telefones_fixos: jsonData.empresa?.telefones?.fixos,
        telefones_celulares: jsonData.empresa?.telefones?.celulares,
        emails: jsonData.empresa?.emails
      },
      ocorrencias: {
        score_pj: jsonData.ocorrencias?.score_pj,
        dados_contato: jsonData.ocorrencias?.dados_contato,
        historico_scr: jsonData.ocorrencias?.historico_scr,
        historico_pagamentos_positivo: jsonData.ocorrencias?.historico_pagamentos_positivo,
        limite_credito_pj: jsonData.ocorrencias?.limite_credito_pj,
        quadro_administrativo: jsonData.ocorrencias?.quadro_administrativo,
        consultas_realizadas: jsonData.ocorrencias?.consultas_realizadas,
        gasto_financeiro_estimado: jsonData.ocorrencias?.gasto_financeiro_estimado,
        controle_societario: jsonData.ocorrencias?.controle_societario
      },
      socios: (jsonData.controle_societario || []).map(socio => ({
        cpf: socio?.cpf,
        nome: socio?.nome,
        entrada: this.parseDateFromISO((socio as any)?.entrada as any),
        participacao: socio?.participacao?.valor,
        valor_participacao: socio?.participacao?.valor,
        percentual_participacao: socio?.participacao?.percentual,
        cargo: socio?.cargo
      })),
      quadro_administrativo: (jsonData.quadro_administrativo || []).map(admin => ({
        cpf: admin?.cpf,
        nome: admin?.nome,
        cargo: admin?.cargo,
        eleito_em: this.parseDateFromISO((admin as any)?.eleito_em as any)
      })),
      historico_pagamento_positivo: {
        compromissos_ativos: jsonData.historico_pagamento_positivo?.compromissos_ativos,
        contratos_ativos: jsonData.historico_pagamento_positivo?.contratos_ativos,
        credores: jsonData.historico_pagamento_positivo?.credores,
        parcelas_a_vencer_percentual: jsonData.historico_pagamento_positivo?.parcelas?.a_vencer_percentual,
        parcelas_pagas_percentual: jsonData.historico_pagamento_positivo?.parcelas?.pagas_percentual,
        parcelas_abertas_percentual: jsonData.historico_pagamento_positivo?.parcelas?.abertas_percentual,
        contratos_pagos: jsonData.historico_pagamento_positivo?.contratos_pagos,
        contratos_abertos: jsonData.historico_pagamento_positivo?.contratos_abertos,
        uso_cheque_especial: (jsonData.historico_pagamento_positivo?.uso_cheque_especial as any) === 1
      },
      score_credito: {
        score: jsonData.score_credito?.score,
        risco: jsonData.score_credito?.risco,
        probabilidade_inadimplencia: jsonData.score_credito?.probabilidade_inadimplencia,
        limite_credito_valor: (jsonData as any)?.limite_credito?.valor,
        gasto_financeiro_estimado_valor: (jsonData as any)?.gasto_financeiro_estimado?.valor
      },
      scr: {
        atualizacao: this.parseDateFromISO((jsonData.scr as any)?.atualizacao as any),
        quantidade_operacoes: jsonData.scr?.quantidade_operacoes,
        inicio_relacionamento: this.parseDateFromISO((jsonData.scr as any)?.inicio_relacionamento as any),
        valor_contratado: jsonData.scr?.valor_contratado,
        instituicoes: jsonData.scr?.instituicoes,
        carteira_ativa_total: jsonData.scr?.carteira_ativa_total,
        vencimento_ultima_parcela: jsonData.scr?.vencimento_ultima_parcela,
        garantias_quantidade_maxima: jsonData.scr?.garantias?.quantidade_maxima
      },
      consultas_realizadas: (jsonData.consultas?.registros || []).map(consulta => ({
        data_hora: this.parseDateFromISO((consulta as any)?.data_hora as any),
        associado: consulta?.associado,
        cidade: consulta?.cidade,
        origem: consulta?.origem
      })),
      tipos_garantias: (jsonData.scr?.garantias?.tipos || []).map(tipo => ({
        tipo_garantia: tipo
      }))
    };

    console.log(`✅ Dados extraídos com sucesso:`);
    console.log(`   - Empresa: ${dados.empresa.razao_social}`);
    console.log(`   - Sócios: ${dados.socios.length}`);
    console.log(`   - Quadro Administrativo: ${dados.quadro_administrativo.length}`);
    console.log(`   - Consultas Realizadas: ${dados.consultas_realizadas.length}`);
    console.log(`   - Tipos de Garantias: ${dados.tipos_garantias.length}`);

    Logger.success('Dados extraídos da resposta TESS', {
      empresa: dados.empresa.razao_social,
      sociosCount: dados.socios.length,
      quadroCount: dados.quadro_administrativo.length,
      consultasCount: dados.consultas_realizadas.length
    });

    return dados;
  }

  /**
   * Extrai dados usando fallback (regex) quando JSON não está disponível
   */
  private static extrairDadosFallback(respostaTESS: string, cnpj: string): DadosTESSCompletos {
    console.log('📄 Usando extração por regex como fallback...');
    
    // Implementação básica de fallback
    // Aqui você pode implementar a lógica de regex se necessário
    return this.criarDadosBasicos(cnpj);
  }

  /**
   * Cria dados básicos em caso de erro
   */
  private static criarDadosBasicos(cnpj: string): DadosTESSCompletos {
    return {
      consulta: {
        operador: 'Sistema',
        data_hora: new Date(),
        produto: 'SPC + POSITIVO AVANÇADO PJ',
        protocolo: 'N/A'
      },
      empresa: {
        cnpj: cnpj,
        razao_social: 'Empresa não identificada',
        situacao_cnpj: 'N/A'
      },
      endereco: {},
      dados_contato: {},
      ocorrencias: {},
      socios: [],
      quadro_administrativo: [],
      historico_pagamento_positivo: {},
      score_credito: {},
      scr: {},
      consultas_realizadas: [],
      tipos_garantias: []
    };
  }

  /**
   * Converte string ISO para Date
   */
  private static parseDateFromISO(dateStr: string): Date | undefined {
    try {
      if (!dateStr || dateStr === 'Não informado') {
        return undefined;
      }
      return new Date(dateStr);
    } catch (error) {
      console.log('Erro ao converter data:', dateStr, error);
      return undefined;
    }
  }

  /**
   * Converte string de data para Date
   */
  private static parseDate(dateStr: string): Date | undefined {
    try {
      const [day, month, year] = dateStr.split('/');
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Converte string de moeda para número
   */
  private static parseCurrency(currencyStr: string): number | undefined {
    try {
      return parseFloat(currencyStr.replace(/[^\d.,]/g, '').replace(',', '.'));
    } catch (error) {
      return undefined;
    }
  }
}
