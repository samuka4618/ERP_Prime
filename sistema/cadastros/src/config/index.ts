import dotenv from 'dotenv';
import { SPCConfig, TessConfig, CNPJAConfig, DatabaseConfig } from '../types';

// Carrega as variáveis de ambiente
dotenv.config();

export const config = {
  url: process.env.SPC_URL || 'https://sistema.spcbrasil.com.br',
  operador: process.env.SPC_OPERADOR || '',
  senha: process.env.SPC_SENHA || '',
  palavraSecreta: process.env.SPC_PALAVRA_SECRETA || '',
  downloadPath: process.env.DOWNLOAD_PATH || './downloads',
  cnpjToQuery: process.env.CNPJ_TO_QUERY || '',
  excelFile: process.env.EXCEL_FILE || '',
  excelSheet: process.env.EXCEL_SHEET || '',
  excelCnpjColumn: process.env.EXCEL_CNPJ_COLUMN || '',
  headless: process.env.HEADLESS === 'true',
  browserTimeout: parseInt(process.env.BROWSER_TIMEOUT || '30000'),
  debug: process.env.DEBUG === 'true',
  cnpjCacheExpirationHours: parseInt(process.env.CNPJ_CACHE_EXPIRATION_HOURS || '24')
};

export const tessConfig: TessConfig = {
  apiKey: process.env.TESS_API_KEY || '',
  baseUrl: process.env.TESS_BASE_URL || 'https://tess.pareto.io',
  agentId: process.env.TESS_AGENT_ID || '',
  model: process.env.TESS_MODEL || 'tess-5',
  temperature: parseFloat(process.env.TESS_TEMPERATURE || '1'),
  outputPath: process.env.TESS_OUTPUT_PATH || './tess_responses',
  prompt: process.env.TESS_PROMPT || undefined // Opcional - agente já configurado
};

export const cnpjaConfig: CNPJAConfig = {
  apiKey: process.env.CNPJA_API_KEY || '',
  baseUrl: process.env.CNPJA_BASE_URL || 'https://api.cnpja.com'
};

export const databaseConfig: DatabaseConfig = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE || 'consultas',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  port: parseInt(process.env.DB_PORT || '1433'),
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true'
  }
};

// Valida se as configurações obrigatórias estão presentes
export function validateConfig(): void {
  if (!config.operador) {
    throw new Error('SPC_OPERADOR é obrigatório');
  }
  if (!config.senha) {
    throw new Error('SPC_SENHA é obrigatório');
  }
  if (!config.palavraSecreta) {
    throw new Error('SPC_PALAVRA_SECRETA é obrigatório');
  }
  
  // Valida se pelo menos uma fonte de CNPJ foi fornecida
  if (!config.cnpjToQuery && !config.excelFile) {
    throw new Error('É necessário fornecer CNPJ_TO_QUERY ou EXCEL_FILE');
  }
  
  // Se forneceu Excel, valida se o arquivo existe
  if (config.excelFile && !require('fs').existsSync(config.excelFile)) {
    throw new Error(`Arquivo Excel não encontrado: ${config.excelFile}`);
  }
}

// Valida as configurações da TESS
export function validateTessConfig(): void {
  if (!tessConfig.apiKey) {
    throw new Error('TESS_API_KEY é obrigatório');
  }
  if (!tessConfig.agentId) {
    throw new Error('TESS_AGENT_ID é obrigatório');
  }
}

// Valida as configurações do CNPJÁ
export function validateCNPJAConfig(): void {
  if (!cnpjaConfig.apiKey) {
    throw new Error('CNPJA_API_KEY é obrigatório');
  }
}
