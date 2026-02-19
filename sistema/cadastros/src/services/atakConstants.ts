/**
 * Tipos de cadastro no sistema Atak
 * Fonte: Sistema Atak
 */
export const TIPOS_DE_CADASTRO = [
  {
    ID: "B",
    Nome: "CONTAS CAIXA X BANCO",
  },
  {
    ID: "C",
    Nome: "CLIENTE CONSUMIDOR FINAL",
  },
  {
    ID: "D",
    Nome: "PRESTADORES DE SERVIÇOS P.FÍSICA",
  },
  {
    ID: "E",
    Nome: "PRESTADORES DE SERVICO P.JURÍDICA",
  },
  {
    ID: "F",
    Nome: "FORNECEDORES ALMOXARIFADO",
  },
  {
    ID: "G",
    Nome: "CLIENTES MERCADO INTERNO",
  },
  {
    ID: "H",
    Nome: "EMPRESAS DO GRUPO (FILIAIS)",
  },
  {
    ID: "I",
    Nome: "FORNECEDOR REVENDA",
  },
  {
    ID: "J",
    Nome: "FORNECEDOR DIVERSOS",
  },
  {
    ID: "K",
    Nome: "PLANO DE CONTAS",
  },
  {
    ID: "M",
    Nome: "MOTORISTAS",
  },
  {
    ID: "N",
    Nome: "A PAGAR FORNC. DIVERSOS(IMPOSTOS, TAXAS, E OUTROS)",
  },
  {
    ID: "O",
    Nome: "PERFIL PARTICIPANTE",
  },
  {
    ID: "S",
    Nome: "SISTEMA",
  },
  {
    ID: "T",
    Nome: "TRANSPORTADOR",
  },
  {
    ID: "U",
    Nome: "FUNCIONARIO/DEPARTAMENTOS",
  },
  {
    ID: "V",
    Nome: "VENDEDOR",
  },
  {
    ID: "X",
    Nome: "CLIENTES MERCADO EXTERNO",
  },
  {
    ID: "Y",
    Nome: "FORNECEDOR MATERIA PRIMA",
  },
  {
    ID: "Z",
    Nome: "PROSPECT",
  },
];

/**
 * Interface para resposta de busca de cliente no Atak
 */
export interface AtakCustomerSearchResponse {
  ID: number;
  CpfCgc: string;
  RazaoSocial: string;
  NomeFantasia?: string;
  TipoDePessoa?: string;
  TipoDeCadastro?: string;
  [key: string]: any;
}

/**
 * Resposta genérica da API Atak
 */
export interface AtakApiResponse<T> {
  Version: string;
  Content: any;
  StatusCode: number;
  ReasonPhrase: string;
  Headers: Record<string, any>;
  RequestMessage: any;
  IsSuccessStatusCode: boolean;
}

