// Tipos para o novo schema de banco de dados TESS/SPC
// Baseado no schema_sqlserver.sql

export interface ConsultaData {
  operador: string;
  data_hora: Date;
  produto: string;
  protocolo: string;
}

export interface EmpresaData {
  cnpj: string;
  inscricao_estadual?: string;
  inscricao_suframa?: string;
  razao_social: string;
  nome_fantasia?: string;
  situacao_cnpj?: string;
  atualizacao?: Date;
  fundacao?: Date;
  natureza_juridica?: string;
  porte?: string;
  capital_social?: number;
  atividade_principal?: string;
  telefone?: string;
  email?: string;
  website?: string;
  cnpja_response?: string; // JSON completo do CNPJÁ
}

export interface EnderecoData {
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  longitude?: number;
  latitude?: number;
}

export interface DadosContatoData {
  telefones_fixos?: string[]; // Array de telefones fixos
  telefones_celulares?: string[]; // Array de telefones celulares
  emails?: string[]; // Array de emails
}

export interface OcorrenciasData {
  score_pj?: number;
  dados_contato?: number;
  historico_scr?: number;
  historico_pagamentos_positivo?: number;
  limite_credito_pj?: number;
  quadro_administrativo?: number;
  consultas_realizadas?: number;
  gasto_financeiro_estimado?: number;
  controle_societario?: number;
}

export interface SocioData {
  cpf: string;
  nome: string;
  entrada?: Date;
  participacao?: number;
  valor_participacao?: number;
  percentual_participacao?: number;
  cargo?: string;
}

export interface QuadroAdministrativoData {
  cpf: string;
  nome: string;
  cargo?: string;
  eleito_em?: Date;
}

export interface HistoricoPagamentoPositivoData {
  compromissos_ativos?: string;
  contratos_ativos?: number;
  credores?: number;
  parcelas_a_vencer_percentual?: number;
  parcelas_pagas_percentual?: number;
  parcelas_abertas_percentual?: number;
  contratos_pagos?: string;
  contratos_abertos?: string;
  uso_cheque_especial?: boolean;
}

export interface ScoreCreditoData {
  score?: number;
  risco?: string;
  probabilidade_inadimplencia?: number;
  limite_credito_valor?: number;
  gasto_financeiro_estimado_valor?: number;
}

export interface SCRData {
  atualizacao?: Date;
  quantidade_operacoes?: number;
  inicio_relacionamento?: Date;
  valor_contratado?: string;
  instituicoes?: number;
  carteira_ativa_total?: string;
  vencimento_ultima_parcela?: string;
  garantias_quantidade_maxima?: number;
}

export interface ConsultasRealizadasData {
  data_hora?: Date;
  associado?: string;
  cidade?: string;
  origem?: string;
}

export interface TiposGarantiasData {
  tipo_garantia: string;
}

// Interface principal para dados completos da consulta TESS
export interface DadosTESSCompletos {
  consulta: ConsultaData;
  empresa: EmpresaData;
  endereco: EnderecoData;
  dados_contato: DadosContatoData;
  ocorrencias: OcorrenciasData;
  socios: SocioData[];
  quadro_administrativo: QuadroAdministrativoData[];
  historico_pagamento_positivo: HistoricoPagamentoPositivoData;
  score_credito: ScoreCreditoData;
  scr: SCRData;
  consultas_realizadas: ConsultasRealizadasData[];
  tipos_garantias: TiposGarantiasData[];
}

// Interface para resposta do parser TESS
export interface DadosTESSResposta {
  consulta: {
    operador: string;
    data_hora: string;
    produto: string;
    protocolo: string;
  };
  empresa: {
    cnpj: string;
    razao_social: string;
    situacao_cnpj: string;
    atualizacao: string;
    fundacao: string;
    endereco: {
      logradouro: string;
      numero: string;
      complemento: string;
      bairro: string;
      cidade: string;
      estado: string;
      cep: string;
    };
    telefones: {
      fixos: string[];
      celulares: string[];
    };
    emails: string[];
  };
  ocorrencias: {
    score_pj: number;
    dados_contato: number;
    historico_scr: number;
    historico_pagamentos_positivo: number;
    limite_credito_pj: number;
    quadro_administrativo: number;
    consultas_realizadas: number;
    gasto_financeiro_estimado: number;
    controle_societario: number;
  };
  controle_societario: Array<{
    cpf: string;
    nome: string;
    entrada: string;
    participacao: {
      valor: number;
      percentual: number;
    };
    cargo: string;
  }>;
  quadro_administrativo: Array<{
    cpf: string;
    nome: string;
    cargo: string;
    eleito_em: string;
  }>;
  historico_pagamento_positivo: {
    compromissos_ativos: string;
    contratos_ativos: number;
    credores: number;
    parcelas: {
      a_vencer_percentual: number;
      pagas_percentual: number;
      abertas_percentual: number;
    };
    contratos_pagos: string;
    contratos_abertos: string;
    uso_cheque_especial: number;
  };
  score_credito: {
    score: number;
    risco: string;
    probabilidade_inadimplencia: number;
  };
  consultas: {
    ultimos_30_dias: number;
    ultimos_90_dias: number;
    registros: Array<{
      data_hora: string;
      associado: string;
      cidade: string;
      origem: string;
    }>;
  };
  limite_credito: {
    valor: number;
    metodologia: string;
  };
  gasto_financeiro_estimado: {
    valor: number;
    observacao: string;
  };
  scr: {
    atualizacao: string;
    quantidade_operacoes: number;
    inicio_relacionamento: string;
    valor_contratado: string;
    instituicoes: number;
    carteira_ativa_total: string;
    vencimento_ultima_parcela: string;
    garantias: {
      quantidade_maxima: number;
      tipos: string[];
    };
  };
}
