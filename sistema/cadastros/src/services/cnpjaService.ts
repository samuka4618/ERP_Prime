import axios, { AxiosResponse } from 'axios';
import { Logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

export interface CNPJAConfig {
  apiKey: string;
  baseUrl: string;
}

export interface CNPJAAddress {
  municipality?: number;
  street?: string;
  number?: string;
  details?: string;
  district?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: {
    id: number;
    name: string;
  };
  latitude?: number;
  longitude?: number;
}

export interface CNPJARegistration {
  number: string;
  state: string;
  enabled: boolean;
  statusDate: string;
  status: {
    id: number;
    text: string;
  };
  type: {
    id: number;
    text: string;
  };
}

export interface CNPJANature {
  id: number;
  text: string;
}

export interface CNPJASize {
  id: number;
  acronym: string;
  text: string;
}

export interface CNPJAPerson {
  id: string;
  name: string;
  type: string;
  taxId: string;
  age: string;
}

export interface CNPJARole {
  id: number;
  text: string;
}

export interface CNPJAMember {
  since: string;
  role: CNPJARole;
  person: CNPJAPerson;
  agent?: {
    role: CNPJARole;
    person: CNPJAPerson;
  };
}

export interface CNPJASuframa {
  number: string;
  status: string;
  date: string;
}

export interface CNPJAPhone {
  type: string;
  area: string;
  number: string;
}

export interface CNPJAEmail {
  ownership: string;
  address: string;
  domain: string;
}

export interface CNPJAActivity {
  id: number;
  text: string;
}

export interface CNPJACompany {
  id: number;
  name: string;
  equity?: number;
  nature?: CNPJANature;
  size?: CNPJASize;
  members?: CNPJAMember[];
}

export interface CNPJAResponse {
  updated: string;
  taxId: string;
  company: CNPJACompany;
  alias?: string;
  founded: string;
  head: boolean;
  statusDate: string;
  status: {
    id: number;
    text: string;
  };
  address: CNPJAAddress;
  phones?: CNPJAPhone[];
  emails?: CNPJAEmail[];
  mainActivity?: CNPJAActivity;
  sideActivities?: CNPJAActivity[];
  registrations?: CNPJARegistration[];
  suframa?: CNPJASuframa[];
}

export interface CNPJAQueryResult {
  success: boolean;
  cnpj: string;
  data?: CNPJAResponse;
  error?: string;
  timestamp: Date;
}

export class CNPJAService {
  private config: CNPJAConfig;
  private axiosInstance: any;
  private outputPath: string;

  // Estados da Zona Franca onde SUFRAMA é aplicável
  private readonly SUFRAMA_STATES = ['AM', 'AC', 'RO', 'RR'];
  private readonly SUFRAMA_MUNICIPALITIES_AP = ['Macapá', 'Santana'];

  constructor(config: CNPJAConfig, outputPath: string = './cnpja_responses') {
    this.config = config;
    // Resolve caminho para dentro do projeto (pasta cadastros)
    this.outputPath = path.resolve(__dirname, '..', '..', outputPath);
    this.axiosInstance = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Authorization': config.apiKey, // API Key direto no header Authorization
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 segundos de timeout
    });
    
    // Criar pasta se não existir
    if (!fs.existsSync(this.outputPath)) {
      fs.mkdirSync(this.outputPath, { recursive: true });
    }
  }

  /**
   * Verifica se deve consultar SUFRAMA baseado no estado da empresa
   */
  private shouldQuerySuframa(state: string, city?: string): boolean {
    // Estados da Zona Franca
    if (this.SUFRAMA_STATES.includes(state)) {
      return true;
    }
    
    // Amapá - apenas Macapá e Santana
    if (state === 'AP' && city) {
      return this.SUFRAMA_MUNICIPALITIES_AP.some(municipality => 
        city.toLowerCase().includes(municipality.toLowerCase())
      );
    }
    
    return false;
  }

  /**
   * Salva a resposta completa do CNPJÁ em arquivo JSON
   */
  private async saveResponse(cnpj: string, response: CNPJAResponse): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `cnpja_${cnpj}_${timestamp}.json`;
      const filepath = path.join(this.outputPath, filename);
      
      const responseData = {
        cnpj,
        timestamp: new Date().toISOString(),
        response
      };
      
      fs.writeFileSync(filepath, JSON.stringify(responseData, null, 2), 'utf8');
      console.log(`💾 Resposta CNPJÁ salva: ${filename}`);
    } catch (error) {
      console.error('❌ Erro ao salvar resposta CNPJÁ:', error);
    }
  }

  /**
   * Consulta dados de uma empresa pelo CNPJ
   */
  async queryCompany(cnpj: string, retries: number = 3): Promise<CNPJAQueryResult> {
    const result: CNPJAQueryResult = {
      success: false,
      cnpj,
      timestamp: new Date()
    };

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`Consultando CNPJ no CNPJÁ: ${cnpj} (tentativa ${attempt}/${retries})`);
        
        // Remove formatação do CNPJ (pontos, traços, barras)
        const cleanCnpj = cnpj.replace(/[^\d]/g, '');
        
        if (cleanCnpj.length !== 14) {
          throw new Error('CNPJ deve ter 14 dígitos');
        }

        // Primeira consulta para obter dados básicos e verificar estado
        const basicResponse: AxiosResponse<CNPJAResponse> = await this.axiosInstance.get(
          `/office/${cleanCnpj}`,
          {
            params: {
              registrations: 'BR', // Busca inscrições em todas as unidades federativas
              geocoding: true,     // Habilita geocodificação para obter latitude/longitude
              strategy: 'CACHE_IF_ERROR',
              maxAge: 30
            }
          }
        );

        if (basicResponse.data) {
          const state = basicResponse.data.address?.state;
          const city = basicResponse.data.address?.city;
          
          // Verifica se deve consultar SUFRAMA
          const shouldQuerySuframa = this.shouldQuerySuframa(state || '', city);
          
          let finalResponse = basicResponse;
          
          // Se deve consultar SUFRAMA, faz uma segunda consulta com o parâmetro
          if (shouldQuerySuframa) {
            console.log(`🏭 Empresa localizada em ${city}/${state} - consultando SUFRAMA`);
            
            const suframaResponse: AxiosResponse<CNPJAResponse> = await this.axiosInstance.get(
              `/office/${cleanCnpj}`,
              {
                params: {
                  registrations: 'BR',
                  geocoding: true,
                  suframa: true,      // Adiciona consulta SUFRAMA
                  strategy: 'CACHE_IF_ERROR',
                  maxAge: 30
                }
              }
            );
            
            finalResponse = suframaResponse;
          } else {
            console.log(`📍 Empresa localizada em ${city}/${state} - SUFRAMA não aplicável`);
          }

          result.success = true;
          result.data = finalResponse.data;
          
          // Salva a resposta completa em arquivo JSON
          await this.saveResponse(cnpj, finalResponse.data);
          
          console.log(`✅ Dados obtidos do CNPJÁ para ${cnpj}:`);
          console.log(`- Razão Social: ${result.data.company.name || 'N/A'}`);
          console.log(`- Status: ${result.data.status.text || 'N/A'}`);
          console.log(`- Cidade: ${result.data.address.city || 'N/A'}/${result.data.address.state || 'N/A'}`);
          console.log(`- Inscrições Estaduais: ${result.data.registrations?.length || 0}`);
          console.log(`- Coordenadas: ${result.data.address.latitude && result.data.address.longitude ? 
            `${result.data.address.latitude}, ${result.data.address.longitude}` : 
            'N/A'}`);
          console.log(`- SUFRAMA: ${shouldQuerySuframa ? (result.data.suframa?.length || 0) + ' inscrições' : 'N/A'}`);
          
          Logger.success(`Consulta CNPJÁ ${cnpj} concluída`, {
            companyName: result.data.company.name,
            registrations: result.data.registrations?.length || 0,
            hasGeolocation: !!(result.data.address.latitude && result.data.address.longitude),
            suframaQueried: shouldQuerySuframa,
            suframaCount: result.data.suframa?.length || 0
          });
          
          return result;
        } else {
          throw new Error('Resposta inválida do servidor CNPJÁ');
        }

      } catch (error) {
        console.error(`Erro ao consultar CNPJÁ (tentativa ${attempt}):`, error);
        
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          const statusText = error.response?.statusText;
          
          console.error('Detalhes do erro Axios:');
          console.error('Status:', status);
          console.error('Status Text:', statusText);
          console.error('Data:', error.response?.data);
          
          // Trata erros específicos
          if (status === 401) {
            result.error = 'Chave de API inválida ou expirada';
            break; // Não tenta novamente para erro de autenticação
          } else if (status === 404) {
            result.error = 'CNPJ não encontrado no CNPJÁ';
            break; // Não tenta novamente para CNPJ não encontrado
          } else if (status === 429) {
            const retryAfter = error.response?.headers['retry-after'] || 10;
            console.log(`Rate limit atingido. Aguardando ${retryAfter} segundos...`);
            await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000));
            continue;
          } else if (status && status >= 500) {
            // Erro do servidor, tenta novamente
            if (attempt === retries) {
              result.error = `Erro do servidor CNPJÁ: ${status} - ${statusText}`;
            } else {
              await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
              continue;
            }
          } else {
            result.error = `Erro na consulta CNPJÁ: ${status || 'Sem status'} - ${statusText || 'Sem status text'}`;
            break;
          }
        } else {
          result.error = error instanceof Error ? error.message : 'Erro desconhecido';
          if (attempt === retries) {
            break;
          } else {
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
            continue;
          }
        }
      }
    }

    Logger.error(`Falha na consulta CNPJÁ ${cnpj}`, { error: result.error });
    return result;
  }

  /**
   * Consulta múltiplos CNPJs
   */
  async queryMultipleCompanies(cnpjs: string[]): Promise<CNPJAQueryResult[]> {
    console.log(`Iniciando consulta de ${cnpjs.length} CNPJs no CNPJÁ...`);
    
    const results: CNPJAQueryResult[] = [];
    
    for (let i = 0; i < cnpjs.length; i++) {
      const cnpj = cnpjs[i];
      
      try {
        const result = await this.queryCompany(cnpj);
        results.push(result);
        
        // Aguarda 1 segundo entre consultas para respeitar rate limiting
        if (i < cnpjs.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.error(`Erro ao consultar CNPJ ${cnpj}:`, error);
        results.push({
          success: false,
          cnpj,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
          timestamp: new Date()
        });
      }
    }

    // Log do resumo
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`\n=== Resumo da Consulta CNPJÁ ===`);
    console.log(`Total de CNPJs: ${results.length}`);
    console.log(`Sucessos: ${successful}`);
    console.log(`Falhas: ${failed}`);

    Logger.success(`Consulta CNPJÁ em lote concluída`, { 
      total: results.length, 
      successful, 
      failed 
    });

    return results;
  }

  /**
   * Extrai dados específicos para inserção no banco de dados
   */
  extractDatabaseData(response: CNPJAResponse): {
    inscricaoEstadual: string | null;
    latitude: number | null;
    longitude: number | null;
    enderecoCompleto: string;
    atividadePrincipal: string | null;
    porte: string | null;
    telefone: string | null;
    email: string | null;
    website: string | null;
    razaoSocial: string | null;
    nomeFantasia: string | null;
    situacao: string | null;
    dataAbertura: string | null;
    naturezaJuridica: string | null;
    capitalSocial: number | null;
    inscricaoSuframa: string | null;
  } {
    // Pega a primeira inscrição estadual ativa
    const inscricaoEstadual = response.registrations
      ?.filter(reg => reg.enabled === true)
      ?.map(reg => reg.number)
      ?.find(() => true) || null;

    // Coordenadas geográficas
    const latitude = response.address?.latitude || null;
    const longitude = response.address?.longitude || null;

    // Endereço completo
    const enderecoCompleto = [
      response.address?.street,
      response.address?.number,
      response.address?.details,
      response.address?.district,
      response.address?.city,
      response.address?.state,
      response.address?.zip
    ].filter(Boolean).join(', ') || 'Endereço não disponível';

    // Porte da empresa (extrai o texto do objeto)
    const porte = response.company.size?.text || null;

    // Telefone (primeiro telefone disponível)
    const telefone = response.phones?.[0] ? 
      `(${response.phones[0].area}) ${response.phones[0].number}` : null;

    // Email (primeiro email disponível)
    const email = response.emails?.[0]?.address || null;

    // Inscrição SUFRAMA (primeira inscrição disponível)
    const inscricaoSuframa = response.suframa?.[0]?.number || null;

    return {
      inscricaoEstadual,
      latitude,
      longitude,
      enderecoCompleto,
      atividadePrincipal: response.mainActivity?.text || null,
      porte,
      telefone,
      email,
      website: null, // Não disponível na API atual
      razaoSocial: response.company.name || null,
      nomeFantasia: response.alias || null,
      situacao: response.status.text || null,
      dataAbertura: response.founded || null,
      naturezaJuridica: response.company.nature?.text || null,
      capitalSocial: response.company.equity || null,
      inscricaoSuframa
    };
  }

  /**
   * Valida se os dados obtidos são suficientes para análise
   */
  validateData(response: CNPJAResponse): { isValid: boolean; missingFields: string[] } {
    const missingFields: string[] = [];

    if (!response.company.name) missingFields.push('razão social');
    if (!response.address?.city) missingFields.push('cidade');
    if (!response.address?.state) missingFields.push('estado');
    if (!response.registrations || response.registrations.length === 0) {
      missingFields.push('inscrição estadual');
    }
    if (!response.address?.latitude || !response.address?.longitude) {
      missingFields.push('coordenadas geográficas');
    }

    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  }
}
