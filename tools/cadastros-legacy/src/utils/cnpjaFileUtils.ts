import * as fs from 'fs';
import * as path from 'path';
import { CNPJAResponse } from '../services/cnpjaService';

export interface CNPJAFileData {
  cnpj: string;
  timestamp: string;
  response: CNPJAResponse;
}

export interface CNPJADatabaseData {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  situacao: string;
  data_abertura?: string;
  natureza_juridica?: string;
  porte?: string;
  capital_social?: number;
  atividade_principal?: string;
  inscricao_estadual?: string;
  inscricao_suframa?: string;
  latitude?: number;
  longitude?: number;
  endereco_completo?: string;
  telefone?: string;
  email?: string;
  website?: string;
  cnpja_response: string; // JSON completo
}

export class CNPJAFileUtils {
  private cnpjaResponsesPath: string;

  constructor(cnpjaResponsesPath: string = './cnpja_responses') {
    this.cnpjaResponsesPath = cnpjaResponsesPath;
  }

  /**
   * Lista todos os arquivos JSON do CNPJÁ
   */
  listCNPJAFiles(): string[] {
    try {
      if (!fs.existsSync(this.cnpjaResponsesPath)) {
        return [];
      }
      
      return fs.readdirSync(this.cnpjaResponsesPath)
        .filter(file => file.endsWith('.json'))
        .sort();
    } catch (error) {
      console.error('❌ Erro ao listar arquivos CNPJÁ:', error);
      return [];
    }
  }

  /**
   * Lê um arquivo JSON do CNPJÁ
   */
  readCNPJAFile(filename: string): CNPJAFileData | null {
    try {
      const filepath = path.join(this.cnpjaResponsesPath, filename);
      const content = fs.readFileSync(filepath, 'utf8');
      return JSON.parse(content) as CNPJAFileData;
    } catch (error) {
      console.error(`❌ Erro ao ler arquivo CNPJÁ ${filename}:`, error);
      return null;
    }
  }

  /**
   * Lê o arquivo mais recente para um CNPJ específico
   */
  readLatestCNPJAFile(cnpj: string): CNPJAFileData | null {
    const files = this.listCNPJAFiles()
      .filter(file => file.includes(cnpj))
      .sort()
      .reverse(); // Mais recente primeiro

    if (files.length === 0) {
      return null;
    }

    return this.readCNPJAFile(files[0]);
  }

  /**
   * Extrai dados para inserção no banco de dados
   */
  extractDatabaseData(fileData: CNPJAFileData): CNPJADatabaseData | null {
    try {
      const { cnpj, response } = fileData;
      
      // Extrair inscrição estadual
      const inscricaoEstadual = response.registrations?.find((reg: any) => 
        reg.state === response.address?.state && reg.enabled
      )?.number;

      // Extrair inscrição SUFRAMA
      const inscricaoSuframa = response.suframa?.find((suf: any) => 
        suf.status === 'ATIVA' || suf.status === 'ATIVO'
      )?.number;

      // Montar endereço completo
      const enderecoCompleto = [
        response.address?.street,
        response.address?.number,
        response.address?.details,
        response.address?.district,
        response.address?.city,
        response.address?.state,
        response.address?.zip
      ].filter(Boolean).join(', ');

      // Extrair telefone principal
      const telefone = response.phones?.find((phone: any) => 
        phone.type?.text === 'FIXO' || phone.type?.text === 'COMERCIAL'
      )?.number || response.phones?.[0]?.number;

      // Extrair email principal
      const email = response.emails?.find((email: any) => 
        email.type?.text === 'COMERCIAL' || email.type?.text === 'PRINCIPAL'
      )?.address || response.emails?.[0]?.address;

      return {
        cnpj: cnpj.replace(/\D/g, ''), // Remove formatação
        razao_social: response.company.name || 'N/A',
        nome_fantasia: response.alias || undefined,
        situacao: response.status?.text || 'N/A',
        data_abertura: response.founded || undefined,
        natureza_juridica: response.company.nature?.text || undefined,
        porte: response.company.size?.text || undefined,
        capital_social: response.company.equity || undefined,
        atividade_principal: response.mainActivity?.text || undefined,
        inscricao_estadual: inscricaoEstadual || undefined,
        inscricao_suframa: inscricaoSuframa || undefined,
        latitude: response.address?.latitude || undefined,
        longitude: response.address?.longitude || undefined,
        endereco_completo: enderecoCompleto || undefined,
        telefone: telefone || undefined,
        email: email || undefined,
        website: undefined, // CNPJÁ não fornece website
        cnpja_response: JSON.stringify(response)
      };
    } catch (error) {
      console.error('❌ Erro ao extrair dados do CNPJÁ:', error);
      return null;
    }
  }

  /**
   * Processa todos os arquivos CNPJÁ e extrai dados para banco
   */
  processAllCNPJAFiles(): CNPJADatabaseData[] {
    const files = this.listCNPJAFiles();
    const results: CNPJADatabaseData[] = [];

    console.log(`📁 Encontrados ${files.length} arquivos CNPJÁ para processar`);

    for (const file of files) {
      const fileData = this.readCNPJAFile(file);
      if (fileData) {
        const dbData = this.extractDatabaseData(fileData);
        if (dbData) {
          results.push(dbData);
          console.log(`✅ Processado: ${file} - ${dbData.razao_social}`);
        } else {
          console.log(`❌ Falha ao processar: ${file}`);
        }
      }
    }

    return results;
  }
}
