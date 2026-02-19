export interface SPCConfig {
  url: string;
  operador: string;
  senha: string;
  palavraSecreta: string;
  downloadPath: string;
  cnpjToQuery: string;
  excelFile?: string;
  excelSheet?: string;
  excelCnpjColumn?: string;
  headless: boolean;
  browserTimeout: number;
  debug?: boolean;
  cnpjCacheExpirationHours: number;
}

export interface QueryResult {
  success: boolean;
  cnpj: string;
  fileName?: string;
  filePath?: string;
  error?: string;
  timestamp: Date;
}

export interface BatchQueryResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  results: QueryResult[];
  startTime: Date;
  endTime: Date;
  duration: number; // em milissegundos
}

export interface LoginCredentials {
  operador: string;
  senha: string;
  palavraSecreta: string;
}

export interface TessConfig {
  apiKey: string;
  baseUrl: string;
  agentId: string;
  model: string;
  temperature: number;
  outputPath: string;
  prompt?: string;
}

export interface CNPJAConfig {
  apiKey: string;
  baseUrl: string;
}

export interface DatabaseConfig {
  server: string;
  database: string;
  user: string;
  password: string;
  port?: number;
  options?: {
    encrypt?: boolean;
    trustServerCertificate?: boolean;
  };
}

export interface TessProcessResult {
  success: boolean;
  filePath: string;
  fileName: string;
  fileId?: string;
  response?: string;
  error?: string;
  credits?: number;
  timestamp: Date;
}