import axios from 'axios';
import { getAtakToken, authenticateAtak, isAtakConfigured } from './atakAuth';
import { DatabaseService } from './databaseService';
import { TIPOS_DE_CADASTRO, AtakCustomerSearchResponse, AtakApiResponse } from './atakConstants';
import { IBGEService } from './ibgeService';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Cria instância do Axios com configuração para Atak
 */
const createAtakAxios = () => {
  return axios.create({
    baseURL: process.env.ATAK_BASE_URL || '',
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json'
    }
  });
};

/**
 * Interface para o payload de cadastro no Atak
 */
export interface AtakCustomerPayload {
  UtilizaSequenciaDaAtak: boolean;
  tipoDeCadastro: string;
  CodigoDaFilial: string;
  RazaoSocial: string;
  nomeFantasia: string;
  tipoDePessoa: string;
  cpfCnpj: string;
  identificadorEstadual: number;
  observacao: string;
  codigoDaSituacao: string;
  codigoDoRamoDaAtividade: string;
  codigoDoPercursoDaRotaDeEntrega: string;
  uf: string;
  indicadorMicroEmpresa: string;
  suframa: string;
  Enderecos: {
    IdDoPaisF?: string;
    UFF?: string;
    ConteudoEnderecoF?: string;
    BairroF?: string;
    CodigoIBGECidadeF?: string;
    CidadeF?: string;
    TelefoneF?: string;
    EmailF?: string;
    CEPF?: string;
    NumeroF?: string;
    ObservacaoF?: string;
    LatitudeF?: string;
    LongitudeF?: string;
    
    IdDoPaisC?: string;
    UFC?: string;
    ConteudoEnderecoC?: string;
    BairroC?: string;
    CodigoIBGECidadeC?: string;
    CidadeC?: string;
    TelefoneC?: string;
    EmailC?: string;
    CEPC?: string;
    ObservacaoC?: string;
    NumeroC?: string;
    LatitudeC?: string;
    LongitudeC?: string;
    
    IdDoPaisE?: string;
    UFE?: string;
    ConteudoEnderecoE?: string;
    BairroE?: string;
    CodigoIBGECidadeE?: string;
    CidadeE?: string;
    TelefoneE?: string;
    EmailE?: string;
    CEPE?: string;
    ObservacaoE?: string;
    NumeroE?: string;
    LatitudeE?: string;
    LongitudeE?: string;
    
    IdDoPaisR?: string;
    UFR?: string;
    ConteudoEnderecoR?: string;
    BairroR?: string;
    CodigoIBGECidadeR?: string;
    CidadeR?: string;
    TelefoneR?: string;
    EmailR?: string;
    CEPR?: string;
    ObservacaoR?: string;
    NumeroR?: string;
    LatitudeR?: string;
    LongitudeR?: string;
    
    IdDoPaisT?: string;
    UFT?: string;
    ConteudoEnderecoT?: string;
    BairroT?: string;
    CodigoIBGECidadeT?: string;
    CidadeT?: string;
    TelefoneT?: string;
    EmailT?: string;
    CEPT?: string;
    ObservacaoT?: string;
    NumeroT?: string;
    LatitudeT?: string;
    LongitudeT?: string;
  };
  Financeiro: {
    CodigoDaListaDePreco: number;
    CodigoDaCarteira: number;
    CodigoFormaDeCobranca: number;
    CodigoDoVendedor: number;
    idDaCondicaoDePagamento?: string;
    ValorDoLimiteDeCredito?: number;
  };
}

/**
 * Interface para dados consolidados de uma empresa
 */
export interface ConsolidatedCompanyData {
  empresa: {
    cnpj: string;
    razaoSocial: string;
    nomeFantasia?: string;
    situacaoCadastral?: string;
    porte?: string;
    naturezaJuridica?: string;
    dataAbertura?: string;
    inscricaoEstadual?: string;
    inscricaoSuframa?: string;
  };
  endereco: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
    latitude?: number;
    longitude?: number;
  };
  contato: {
    telefones?: string[];
    emails?: string[];
  };
  formulario?: {
    ramo_atividade_id?: number;
    codigo_carteira_id?: number;
    lista_preco_id?: number;
    forma_pagamento_desejada_id?: number;
    // Permite receber diretamente do formulário já no formato esperado pelo Atak
    codigoDoRamoDaAtividade?: string;
    carteira_codigo?: number;
    lista_preco_codigo?: number;
    forma_cobranca_codigo?: number;
    vendedor_codigo?: number;
  };
}

/**
 * Classe de serviço para integração com Atak
 */
export class AtakService {
  private baseUrl: string;
  private dbService: DatabaseService;

  constructor(dbService: DatabaseService) {
    this.baseUrl = process.env.ATAK_BASE_URL || '';
    this.dbService = dbService;
  }

  /**
   * Busca um cliente existente no Atak
   */
  async searchCustomer(cnpj: string): Promise<AtakCustomerSearchResponse | null> {
    let triedReauth = false;
    const api = createAtakAxios();

    while (true) {
      try {
        if (!cnpj) {
          throw new Error('CNPJ não informado');
        }

        const cleanCnpj = cnpj.replace(/\D/g, '');
        
        let foundCustomer: AtakCustomerSearchResponse | null = null;

        // Tentar buscar com diferentes tipos de cadastro
        for (const tipo of TIPOS_DE_CADASTRO) {
          try {
            console.log(`🔍 Buscando cliente ${cleanCnpj} como tipo ${tipo.ID} (${tipo.Nome})...`);
            
            const token = await this.getValidToken(triedReauth);
            if (!token) {
              throw new Error('Não foi possível obter token válido');
            }

            const response = await api.get<AtakCustomerSearchResponse>(
              `/servico/integracaoterceiros/ObterCadastrosGerais/${tipo.ID}/${cleanCnpj}`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                }
              }
            );

            if (response.data) {
              foundCustomer = response.data;
              console.log(`✅ Cliente encontrado como tipo ${tipo.ID}:`, foundCustomer);
              return foundCustomer;
            }
          } catch (error: any) {
            const errorMsg = error?.response?.data || error?.message || '';
            
            // Detecta erro de token/terminal
            if (!triedReauth && this.isTokenError(errorMsg)) {
              console.warn('🔄 Token inválido detectado. Reautenticando...');
              await authenticateAtak();
              triedReauth = true;
              break; // Sai do for e tenta novamente
            }

            // Continue tentando outros tipos
            continue;
          }
        }

        if (foundCustomer) {
          return foundCustomer;
        }

        console.log(`⚠️ Cliente ${cleanCnpj} não encontrado em nenhum tipo de cadastro`);
        return null;

      } catch (error: any) {
        const errorMsg = error?.response?.data || error?.message || '';
        
        if (!triedReauth && this.isTokenError(errorMsg)) {
          console.warn('🔄 Token inválido detectado. Reautenticando...');
          await authenticateAtak();
          triedReauth = true;
          continue;
        }

        throw error;
      }
    }
  }

  /**
   * Busca dados completos de um cliente no Atak pelo ID
   */
  async getCustomerById(atakClienteId: number): Promise<{ success: boolean; error?: string; data?: any }> {
    // Verificar se o Atak está configurado
    if (!isAtakConfigured()) {
      return { 
        success: false, 
        error: 'Configurações do Atak não encontradas. Configure ATAK_USERNAME, ATAK_PASSWORD e ATAK_BASE_URL no .env.' 
      };
    }

    let triedReauth = false;
    const api = createAtakAxios();

    while (true) {
      try {
        if (!atakClienteId) {
          return { success: false, error: 'ID do cliente no Atak não informado' };
        }

        console.log(`🔍 Buscando dados completos do cliente ${atakClienteId} no Atak...`);

        // Buscar token de autenticação
        let token = await this.getValidToken(true);
        if (!token) {
          if (!triedReauth) {
            console.log('🔄 Tentando autenticar no Atak...');
            try {
              token = await authenticateAtak();
              triedReauth = true;
            } catch (authError: any) {
              console.error('❌ Erro ao autenticar:', authError.message);
              return { success: false, error: `Erro ao autenticar no Atak: ${authError.message}` };
            }
          }
          
          if (!token) {
            return { success: false, error: 'Não foi possível obter token de autenticação' };
          }
        }

        // Buscar dados do cliente usando ObterCadastroGeralPorId
        // Aumentar timeout para dar tempo da reautenticação se necessário
        const response = await api.get<any>(
          `/servico/integracaoterceiros/ObterCadastroGeralPorId/${atakClienteId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            validateStatus: () => true,
            timeout: 60000 // 60 segundos para dar tempo da reautenticação se necessário
          }
        );

        console.log('📥 Resposta recebida do Atak:');
        console.log('   Status:', response.status);
        console.log('   Data:', JSON.stringify(response.data, null, 2));

        // Verificar se a resposta contém erro mesmo com status 200
        const responseData = response.data;
        let responseString = '';
        if (typeof responseData === 'string') {
          responseString = responseData;
        } else if (responseData) {
          responseString = JSON.stringify(responseData);
        }

        // Verificar se há erro de token na resposta
        const hasTokenError = responseString.includes('TOKEN_INVALIDO_USUARIO_EM_TERMINAL_DIFERENTE') ||
                              responseString.includes('Token inválido para o request') ||
                              responseString.includes('Verifique se o mesmo usuário não está sendo utilizado em um terminal diferente');

        if (hasTokenError && !triedReauth) {
          console.log('🔄 Erro de token detectado na resposta. Limpando token antigo e reautenticando...');
          
          // Limpar token antigo do .env antes de reautenticar
          try {
            await this.clearAtakToken();
          } catch (clearError) {
            console.warn('⚠️ Erro ao limpar token antigo (continuando mesmo assim):', clearError);
          }
          
          // Reautenticar para obter novo token
          const newToken = await authenticateAtak();
          if (newToken && newToken.trim().length > 0) {
            console.log('✅ Novo token obtido após reautenticação');
            triedReauth = true;
            // Usar o novo token diretamente na próxima tentativa
            token = newToken;
            continue; // Tentar novamente com novo token
          } else {
            console.error('❌ Falha ao obter novo token após reautenticação');
            return { success: false, error: 'Não foi possível obter novo token após erro de autenticação' };
          }
        }

        if (response.status === 200 && !hasTokenError) {
          // Verificar se a resposta é realmente um objeto válido (não uma mensagem de erro)
          if (typeof responseData === 'object' && responseData !== null && !responseString.includes('~EXCEPTION')) {
            return { success: true, data: responseData };
          } else if (typeof responseData === 'string' && responseData.includes('~EXCEPTION')) {
            // É uma mensagem de erro formatada pelo Atak
            const errorMsg = this.extractErrorMessage(responseString);
            if (!triedReauth && this.isTokenError(errorMsg)) {
              console.log('🔄 Erro de token detectado. Limpando token antigo e reautenticando...');
              
              // Limpar token antigo do .env antes de reautenticar
              try {
                await this.clearAtakToken();
              } catch (clearError) {
                console.warn('⚠️ Erro ao limpar token antigo (continuando mesmo assim):', clearError);
              }
              
              // Reautenticar para obter novo token
              const newToken = await authenticateAtak();
              if (newToken && newToken.trim().length > 0) {
                console.log('✅ Novo token obtido após reautenticação');
                triedReauth = true;
                token = newToken;
                continue;
              } else {
                return { success: false, error: 'Não foi possível obter novo token após erro de autenticação' };
              }
            }
            return { success: false, error: errorMsg };
          } else {
            return { success: true, data: responseData };
          }
        } else {
          const data = response.data as any;
          const errorMsg = data?.Message || data?.Content || data?.ReasonPhrase || this.extractErrorMessage(responseString) || `Erro ${response.status}`;
          
          if (!triedReauth && this.isTokenError(errorMsg)) {
            console.log('🔄 Erro de token detectado. Limpando token antigo e reautenticando...');
            
            // Limpar token antigo do .env antes de reautenticar
            try {
              await this.clearAtakToken();
            } catch (clearError) {
              console.warn('⚠️ Erro ao limpar token antigo (continuando mesmo assim):', clearError);
            }
            
            // Reautenticar para obter novo token
            const newToken = await authenticateAtak();
            if (newToken && newToken.trim().length > 0) {
              console.log('✅ Novo token obtido após reautenticação');
              triedReauth = true;
              token = newToken;
              continue;
            } else {
              return { success: false, error: 'Não foi possível obter novo token após erro de autenticação' };
            }
          }
          
          return { success: false, error: `Não foi possível buscar dados: ${errorMsg}` };
        }

      } catch (error: any) {
        console.error('❌ Erro ao buscar dados do cliente no Atak');
        
        let errorMsg = '';
        if (error?.response) {
          errorMsg = error.response.data?.Content || error.response.data?.ReasonPhrase || (error.response.data as any)?.Erro || `Erro ${error.response.status}`;
          console.error('   Status:', error.response.status);
          console.error('   Resposta:', JSON.stringify(error.response.data, null, 2));
        } else if (error?.message) {
          errorMsg = error.message;
        } else {
          errorMsg = 'Erro desconhecido';
        }

        // Verifica se é erro de token
        if (!triedReauth && this.isTokenError(errorMsg)) {
          console.log('🔄 Token inválido. Limpando token antigo e reautenticando...');
          
          // Limpar token antigo do .env antes de reautenticar
          try {
            await this.clearAtakToken();
          } catch (clearError) {
            console.warn('⚠️ Erro ao limpar token antigo (continuando mesmo assim):', clearError);
          }
          
          // Reautenticar para obter novo token
          const newToken = await authenticateAtak();
          if (newToken && newToken.trim().length > 0) {
            console.log('✅ Novo token obtido após reautenticação');
            triedReauth = true;
            continue;
          } else {
            return { success: false, error: 'Não foi possível obter novo token após erro de autenticação' };
          }
        }

        return { success: false, error: errorMsg };
      }
    }
  }

  /**
   * Limpa o token do Atak do arquivo .env
   */
  private async clearAtakToken(): Promise<void> {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const envPath = path.resolve(process.cwd(), '.env');
      
      try {
        let envContent = await fs.readFile(envPath, 'utf-8');
        // Remover ou limpar a linha do token
        envContent = envContent.replace(/^ATAK_TOKEN=.*$/m, '');
        await fs.writeFile(envPath, envContent, 'utf-8');
        console.log('✅ Token antigo removido do .env');
      } catch (error) {
        // Se não conseguir ler o arquivo, continuar mesmo assim
        console.warn('⚠️ Não foi possível limpar token do .env (arquivo pode não existir)');
      }
      
      // Também limpar da memória do process.env
      delete process.env.ATAK_TOKEN;
    } catch (error) {
      console.warn('⚠️ Erro ao limpar token:', error);
      // Não falhar se não conseguir limpar
    }
  }

  /**
   * Extrai mensagem de erro do formato do Atak (~EXCEPTION_MESSAGE)
   */
  private extractErrorMessage(responseString: string): string {
    if (typeof responseString !== 'string') return '';
    
    // Procurar por ~EXCEPTION_MESSAGE(...)
    const exceptionMatch = responseString.match(/~EXCEPTION_MESSAGE\([^)]+\)\s*([^~]+)/);
    if (exceptionMatch && exceptionMatch[1]) {
      return exceptionMatch[1].trim();
    }
    
    // Procurar por mensagens de erro comuns
    if (responseString.includes('Token inválido')) {
      const tokenErrorMatch = responseString.match(/Token inválido[^<]+/);
      if (tokenErrorMatch) {
        return tokenErrorMatch[0].trim();
      }
    }
    
    return responseString;
  }

  /**
   * Verifica se o erro é relacionado a token
   */
  private isTokenError(errorMsg: string): boolean {
    if (typeof errorMsg !== 'string') return false;
    
    const tokenErrors = [
      'Token inválido para o request',
      'TOKEN_INVALIDO_USUARIO_EM_TERMINAL_DIFERENTE',
      'Verifique se o mesmo usuário não está sendo utilizado em um terminal diferente',
      'Token inválido',
      'Unauthorized',
      'TOKEN_INVALIDO'
    ];
    
    return tokenErrors.some(msg => errorMsg.includes(msg));
  }

  /**
   * Obtém um token válido, tentando reautenticar se necessário
   */
  private async getValidToken(autoReauth: boolean = false): Promise<string | null> {
    try {
      console.log('🔍 [ATAK-TOKEN] Buscando token existente...');
      let token = await getAtakToken();
      
      if (token && token.trim().length > 0) {
        console.log('✅ [ATAK-TOKEN] Token encontrado no .env (tamanho:', token.length, 'caracteres)');
        return token;
      }
      
      console.log('⚠️ [ATAK-TOKEN] Token não encontrado ou vazio no .env');
      
      if (autoReauth) {
        console.log('🔄 [ATAK-TOKEN] Tentando autenticar...');
        try {
          token = await authenticateAtak();
          if (token && token.trim().length > 0) {
            console.log('✅ [ATAK-TOKEN] Token obtido com sucesso após autenticação');
            return token;
          } else {
            console.error('❌ [ATAK-TOKEN] Autenticação retornou token vazio');
            return null;
          }
        } catch (authError: any) {
          console.error('❌ [ATAK-TOKEN] Erro durante autenticação:', authError.message);
          return null;
        }
      } else {
        console.log('⚠️ [ATAK-TOKEN] autoReauth=false, não tentando autenticar automaticamente');
      }
      
      return null;
    } catch (error: any) {
      console.error('❌ [ATAK-TOKEN] Erro ao buscar token:', error.message);
      return null;
    }
  }

  /**
   * Salva a resposta do Atak no banco de dados
   */
  async saveAtakResponse(
    cnpj: string,
    result: { success: boolean; error?: string; data?: any; customerId?: number },
    registrationId?: number
  ): Promise<void> {
    try {
      if (!this.dbService.isConnected()) {
        await this.dbService.connect();
      }

      const cleanCnpj = cnpj.replace(/\D/g, '');
      const atakClienteId = result.customerId || result.data?.ID || result.data?.id || null;
      const atakRespostaJson = result.data ? JSON.stringify(result.data) : null;
      const atakDataCadastro = new Date();
      const atakErro = result.success ? null : result.error;

      // 0. Se veio registrationId, atualizar diretamente esse registro
      if (registrationId) {
        console.log('[ATAK][SAVE] updateById', { registrationId, atakClienteId, hasData: !!atakRespostaJson, hasError: !!atakErro });
        const updateById = `
          UPDATE client_registrations
          SET 
            ${atakClienteId ? `atak_cliente_id = ${atakClienteId},` : ''}
            atak_resposta_json = ${atakRespostaJson ? `N'${atakRespostaJson.replace(/'/g, "''")}'` : 'NULL'},
            atak_data_cadastro = '${atakDataCadastro.toISOString()}',
            atak_erro = ${atakErro ? `N'${atakErro.replace(/'/g, "''")}'` : 'NULL'},
            updated_at = GETDATE()
          WHERE id = ${registrationId}
        `;
        await this.dbService.query(updateById);
        console.log('✅ Resposta do Atak atualizada pelo registration_id');
        return;
      }

      // 1. Se existir atak_cliente_id, tentar atualizar por ele
      if (atakClienteId) {
        const existing = await this.dbService.query(`
          SELECT TOP 1 id FROM client_registrations WHERE atak_cliente_id = ${atakClienteId}
        `);
        if (existing && existing.length > 0) {
          const updateQuery = `
            UPDATE client_registrations
            SET 
              atak_resposta_json = ${atakRespostaJson ? `N'${atakRespostaJson.replace(/'/g, "''")}'` : 'NULL'},
              atak_data_cadastro = '${atakDataCadastro.toISOString()}',
              atak_erro = ${atakErro ? `N'${atakErro.replace(/'/g, "''")}'` : 'NULL'},
              updated_at = GETDATE()
            WHERE atak_cliente_id = ${atakClienteId}
          `;
          await this.dbService.query(updateQuery);
          console.log('✅ Resposta do Atak atualizada no registro existente (por atak_cliente_id)');
          return;
        }
      }

      // 2. Verificar se existe registro pelo CNPJ (normalizando no WHERE)
      const existingByCnpj = await this.dbService.query(`
        SELECT TOP 1 id, atak_cliente_id, codigo_carteira_id, lista_preco_id, forma_pagamento_desejada_id
        FROM client_registrations
        WHERE REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '-', ''), '/', '') = '${cleanCnpj}'
      `);

      if (existingByCnpj && existingByCnpj.length > 0) {
        const existingRecord = existingByCnpj[0];
        console.log('[ATAK][SAVE] updateByCnpj', { cnpj: cleanCnpj, atakClienteId, hasData: !!atakRespostaJson, hasError: !!atakErro });
        
        // Se já tem atak_cliente_id e é diferente do novo, logar aviso mas não atualizar
        if (existingRecord.atak_cliente_id && existingRecord.atak_cliente_id !== atakClienteId) {
          console.warn(`⚠️  Cliente ${cleanCnpj} já possui atak_cliente_id ${existingRecord.atak_cliente_id}, novo ID ${atakClienteId} será ignorado`);
        }

        // Atualizar registro existente mantendo valores de foreign keys se já existirem
        const updateQuery = `
          UPDATE client_registrations
          SET 
            ${atakClienteId && !existingRecord.atak_cliente_id ? `atak_cliente_id = ${atakClienteId},` : ''}
            atak_resposta_json = ${atakRespostaJson ? `N'${atakRespostaJson.replace(/'/g, "''")}'` : 'NULL'},
            atak_data_cadastro = '${atakDataCadastro.toISOString()}',
            atak_erro = ${atakErro ? `N'${atakErro.replace(/'/g, "''")}'` : 'NULL'},
            updated_at = GETDATE()
          WHERE REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '-', ''), '/', '') = '${cleanCnpj}'
        `;
        
        await this.dbService.query(updateQuery);
        console.log('✅ Resposta do Atak atualizada no registro existente (por CNPJ)');
        return;
      }

      // 3. Novo registro (apenas se não veio registrationId e não achou por CNPJ) - verificar se foreign keys existem antes de inserir
      const empresa = await this.dbService.query(`
        SELECT TOP 1 razao_social, nome_fantasia
        FROM empresa 
        WHERE cnpj = '${cleanCnpj}'
        ORDER BY updated_at DESC
      `);

      const razaoSocial = empresa && empresa.length > 0 
        ? empresa[0].razao_social 
        : 'EMPRESA NÃO ENCONTRADA';

      // Verificar se os valores de foreign key existem nas tabelas relacionadas
      const codigoCarteira = parseInt(process.env.ATAK_CODIGO_CARTEIRA || '101');
      const codigoListaPreco = parseInt(process.env.ATAK_CODIGO_LISTA_PRECO || '1');
      const codigoFormaCobranca = parseInt(process.env.ATAK_CODIGO_FORMA_COBRANCA || '1');

      // Verificar se codigo_carteira_id existe
      const carteiraExists = await this.dbService.query(`
        SELECT TOP 1 id FROM client_config_codigo_carteira WHERE id = ${codigoCarteira}
      `);
      
      // Verificar se lista_preco_id existe (ajustar tabela conforme seu schema)
      // const listaPrecoExists = await this.dbService.query(`
      //   SELECT TOP 1 id FROM client_config_lista_preco WHERE id = ${codigoListaPreco}
      // `);

      // Usar NULL para foreign keys que não existem ou são inválidas
      const finalCodigoCarteira = (carteiraExists && carteiraExists.length > 0) ? codigoCarteira : 'NULL';
      // const finalListaPreco = (listaPrecoExists && listaPrecoExists.length > 0) ? codigoListaPreco : 'NULL';
      const finalListaPreco = codigoListaPreco; // Assumir que existe, ajustar se necessário
      const finalFormaCobranca = codigoFormaCobranca; // Assumir que existe, ajustar se necessário

      await this.dbService.query(`
        INSERT INTO client_registrations (
          user_id,
          nome_cliente,
          nome_fantasia,
          cnpj,
          email,
          ramo_atividade_id,
          vendedor_id,
          gestor_id,
          codigo_carteira_id,
          lista_preco_id,
          forma_pagamento_desejada_id,
          imagem_externa_path,
          imagem_interna_path,
          status,
          atak_cliente_id,
          atak_resposta_json,
          atak_data_cadastro,
          atak_erro
        ) VALUES (
          1,
          N'${razaoSocial.replace(/'/g, "''")}',
          NULL,
          '${cleanCnpj}',
          'noreply@system.local',
          1,
          1,
          1,
          ${finalCodigoCarteira},
          ${finalListaPreco},
          ${finalFormaCobranca},
          '',
          '',
          'cadastro_enviado',
          ${atakClienteId ? atakClienteId : 'NULL'},
          ${atakRespostaJson ? `N'${atakRespostaJson.replace(/'/g, "''")}'` : 'NULL'},
          '${atakDataCadastro.toISOString()}',
          ${atakErro ? `N'${atakErro.replace(/'/g, "''")}'` : 'NULL'}
        )
      `);
      console.log('✅ Resposta do Atak salva em novo registro criado');
      
    } catch (error: any) {
      // Tratamento mais detalhado de erros
      const errorMessage = error.message || 'Erro desconhecido';
      
      // Verificar tipos comuns de erro
      if (errorMessage.includes('FOREIGN KEY constraint')) {
        console.error('❌ Erro de Foreign Key ao salvar resposta do Atak:', errorMessage);
        console.error('   💡 Verifique se os valores de codigo_carteira_id, lista_preco_id ou forma_pagamento_desejada_id existem nas tabelas relacionadas');
      } else if (errorMessage.includes('PRIMARY KEY constraint') || errorMessage.includes('duplicate key')) {
        console.error('❌ Erro de duplicação ao salvar resposta do Atak:', errorMessage);
        console.error('   💡 Tentando atualizar registro existente...');
        // Tentar atualizar se deu erro de duplicação
        try {
          const cleanCnpj = cnpj.replace(/\D/g, '');
          const atakClienteId = result.customerId || result.data?.ID || result.data?.id || null;
          const atakRespostaJson = result.data ? JSON.stringify(result.data) : null;
          const atakDataCadastro = new Date();
          const atakErro = result.success ? null : result.error;
          
          await this.dbService.query(`
            UPDATE client_registrations
            SET 
              ${atakClienteId ? `atak_cliente_id = ${atakClienteId},` : ''}
              atak_resposta_json = ${atakRespostaJson ? `N'${atakRespostaJson.replace(/'/g, "''")}'` : 'NULL'},
              atak_data_cadastro = '${atakDataCadastro.toISOString()}',
              atak_erro = ${atakErro ? `N'${atakErro.replace(/'/g, "''")}'` : 'NULL'},
              updated_at = GETDATE()
            WHERE cnpj = '${cleanCnpj}'
          `);
          console.log('✅ Registro atualizado com sucesso após erro de duplicação');
        } catch (updateError: any) {
          console.error('❌ Erro ao tentar atualizar registro:', updateError.message);
        }
      } else {
        console.error('❌ Erro ao salvar resposta do Atak:', errorMessage);
        console.error('   Detalhes:', error);
      }
      // Não lança erro para não quebrar o fluxo principal
    }
  }

  /**
   * Cadastra uma empresa no sistema Atak
   */
  async registerCompany(cnpj: string): Promise<{ success: boolean; error?: string; data?: any; customerId?: number }> {
    let triedReauth = false;

    while (true) {
      try {
        console.log(`🏢 Iniciando cadastro da empresa ${cnpj} no sistema Atak...`);

        // 1. Verificar se cliente já existe
        console.log('🔍 Verificando se cliente já existe no Atak...');
        const existingCustomer = await this.searchCustomer(cnpj);
        
        if (existingCustomer) {
          console.log('✅ Cliente já existe no Atak com ID:', existingCustomer.ID);
          const result = { 
            success: true, 
            data: existingCustomer,
            customerId: existingCustomer.ID,
            error: 'Cliente já cadastrado no Atak'
          };

          // Salvar resposta no banco de dados
          await this.saveAtakResponse(cnpj, result);

          return result;
        }

        // 2. Buscar dados consolidados da empresa no banco
        const companyData = await this.getConsolidatedCompanyData(cnpj);
        
        if (!companyData) {
          return { success: false, error: 'Empresa não encontrada no banco de dados' };
        }

        // 3. Transformar dados para o formato Atak
        const atakPayload = this.mapToAtakPayload(companyData);

        // 4. Obter token válido
        let token = await this.getValidToken(triedReauth);
        
        if (!token) {
          return { success: false, error: 'Não foi possível obter token de autenticação' };
        }

        // 5. Enviar para Atak
        const api = createAtakAxios();
        console.log('📤 Enviando dados para Atak...');
        console.log('📋 Payload:', JSON.stringify(atakPayload, null, 2));

        const response = await api.post<AtakApiResponse<any>>(
          '/servico/integracaoterceiros/CadastroGeral',
          atakPayload,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            validateStatus: () => true // Aceitar qualquer status para capturar a resposta
          }
        );

        // Log da resposta completa para debug
        console.log('📥 Resposta recebida do Atak:');
        console.log('   Status:', response.status);
        console.log('   Data:', JSON.stringify(response.data, null, 2));

        // Verifica se a resposta tem a estrutura esperada
        if (response.status !== 200) {
          // Status de erro, extrair mensagem
          let errorMsg = '';
          if (typeof response.data === 'string') {
            errorMsg = response.data;
          } else if (response.data && typeof response.data === 'object') {
            const data = response.data as any;
            errorMsg = data.Content || data.Erro || data.ReasonPhrase || `Erro ${response.status}: ${response.statusText}`;
          } else {
            errorMsg = `Erro ${response.status}: ${response.statusText}`;
          }
          throw new Error(errorMsg);
        }

        // Status 200, verificar se é sucesso
        if (response.data && typeof response.data === 'object') {
          const data = response.data as any;
          // Se tem IsSuccessStatusCode, verifica
          if ('IsSuccessStatusCode' in data) {
            if (!data.IsSuccessStatusCode) {
              const errorMsg = data.Content || data.Erro || data.ReasonPhrase || 'Erro desconhecido ao cadastrar';
              throw new Error(errorMsg);
            }
          }
          // Se chegou aqui, é sucesso
          console.log('✅ Empresa cadastrada com sucesso no Atak!');
          console.log('📋 Resposta:', response.data);
        } else {
          // Resposta não é objeto, pode ser sucesso simples
          console.log('✅ Empresa cadastrada com sucesso no Atak!');
          console.log('📋 Resposta:', response.data);
        }

        const result = { success: true, data: response.data };

        // Salvar resposta no banco de dados
        await this.saveAtakResponse(cnpj, result);

        return result;

      } catch (error: any) {
        console.error('❌ Erro ao cadastrar empresa no Atak');
        
        // Capturar detalhes completos do erro
        let errorMsg = '';
        let errorDetails: any = {};
        
        if (error?.response) {
          errorDetails = {
            status: error.response.status,
            statusText: error.response.statusText,
            headers: error.response.headers,
            data: error.response.data
          };
          
          // Tentar extrair mensagem de erro
          if (typeof error.response.data === 'string') {
            errorMsg = error.response.data;
          } else if (error.response.data?.Content) {
            errorMsg = error.response.data.Content;
          } else if (error.response.data?.Erro) {
            errorMsg = error.response.data.Erro;
          } else if (error.response.data?.ReasonPhrase) {
            errorMsg = error.response.data.ReasonPhrase;
          } else {
            errorMsg = `Erro ${error.response.status}: ${error.response.statusText}`;
          }
          
          console.error('   Status:', error.response.status);
          console.error('   Status Text:', error.response.statusText);
          console.error('   Resposta:', JSON.stringify(error.response.data, null, 2));
        } else if (error?.message) {
          errorMsg = error.message;
          console.error('   Mensagem:', error.message);
        } else {
          errorMsg = 'Erro desconhecido';
          console.error('   Erro completo:', error);
        }

        // Verifica se é erro de token
        if (!triedReauth && this.isTokenError(errorMsg)) {
          // Token inválido, tentar autenticar novamente
          console.log('🔄 Token inválido. Reautenticando...');
          await authenticateAtak();
          triedReauth = true;
          continue; // Tenta novamente
        }

        const errorResult = { 
          success: false, 
          error: errorMsg,
          details: errorDetails
        };

        // Salvar erro no banco de dados
        await this.saveAtakResponse(cnpj, errorResult);

        return errorResult;
      }
    }
  }

  /**
   * Busca dados consolidados de uma empresa no banco de dados
   */
  private async getConsolidatedCompanyData(cnpj: string): Promise<ConsolidatedCompanyData | null> {
    try {
      if (!this.dbService.isConnected()) {
        await this.dbService.connect();
      }

      // Buscar dados da empresa
      const empresa = await this.dbService.query(`
        SELECT TOP 1 
          cnpj, 
          razao_social, 
          nome_fantasia, 
          situacao_cnpj, 
          porte, 
          natureza_juridica, 
          fundacao,
          inscricao_estadual,
          inscricao_suframa
        FROM empresa 
        WHERE cnpj = '${cnpj.replace(/\D/g, '')}'
        ORDER BY updated_at DESC
      `);

      if (!empresa || empresa.length === 0) {
        return null;
      }

      const empresaData = empresa[0];

      // Buscar endereço
      const endereco = await this.dbService.query(`
        SELECT TOP 1 
          e.logradouro, 
          e.numero, 
          e.complemento, 
          e.bairro, 
          e.cidade, 
          e.estado, 
          e.cep,
          e.latitude,
          e.longitude
        FROM endereco e
        INNER JOIN empresa emp ON e.id_empresa = emp.id
        WHERE emp.cnpj = '${cnpj.replace(/\D/g, '')}'
        ORDER BY e.updated_at DESC
      `);

      // Buscar dados de contato
      const contato = await this.dbService.query(`
        SELECT TOP 1 
          dc.telefones_fixos,
          dc.telefones_celulares,
          dc.emails
        FROM dados_contato dc
        INNER JOIN empresa emp ON dc.id_empresa = emp.id
        WHERE emp.cnpj = '${cnpj.replace(/\D/g, '')}'
        ORDER BY dc.updated_at DESC
      `);

      // Parse dos dados de contato (JSON)
      let telefones: string[] = [];
      let emails: string[] = [];

      if (contato && contato.length > 0) {
        try {
          const telefonesFixos = JSON.parse(contato[0].telefones_fixos || '[]');
          const telefonesCelulares = JSON.parse(contato[0].telefones_celulares || '[]');
          telefones = [...telefonesFixos, ...telefonesCelulares];
          
          emails = JSON.parse(contato[0].emails || '[]');
        } catch (error) {
          console.warn('⚠️ Erro ao parsear dados de contato:', error);
        }
      }

      // Buscar dados do formulário de solicitação
      let formularioData = null;
      try {
        const formulario = await this.dbService.query(`
          SELECT TOP 1 
            cr.ramo_atividade_id,
            cr.codigo_carteira_id,
            cr.lista_preco_id,
            cr.forma_pagamento_desejada_id,
            cr.vendedor_id,
            cra.nome AS ramo_codigo,
            cc.nome AS carteira_codigo,
            lp.nome AS lista_preco_codigo,
            fpd.nome AS forma_cobranca_codigo,
            v.nome AS vendedor_codigo
          FROM client_registrations cr
          LEFT JOIN client_config_ramo_atividade cra ON cra.id = cr.ramo_atividade_id
          LEFT JOIN client_config_codigo_carteira cc ON cc.id = cr.codigo_carteira_id
          LEFT JOIN client_config_lista_preco lp ON lp.id = cr.lista_preco_id
          LEFT JOIN client_config_forma_pagamento_desejada fpd ON fpd.id = cr.forma_pagamento_desejada_id
          LEFT JOIN client_config_vendedor v ON v.id = cr.vendedor_id
          WHERE cr.cnpj = '${cnpj.replace(/\D/g, '')}'
          ORDER BY cr.updated_at DESC
        `);
        
        if (formulario && formulario.length > 0) {
          formularioData = {
            ramo_atividade_id: formulario[0].ramo_atividade_id,
            codigo_carteira_id: formulario[0].codigo_carteira_id,
            lista_preco_id: formulario[0].lista_preco_id,
            forma_pagamento_desejada_id: formulario[0].forma_pagamento_desejada_id,
            // Quando houver, já envia o código do ramo (ex.: '021')
            codigoDoRamoDaAtividade: formulario[0].ramo_codigo || undefined,
            carteira_codigo: formulario[0].carteira_codigo || undefined,
            lista_preco_codigo: formulario[0].lista_preco_codigo || undefined,
            forma_cobranca_codigo: formulario[0].forma_cobranca_codigo || undefined,
            vendedor_codigo: formulario[0].vendedor_codigo || undefined
          };
          console.log('📋 Dados do formulário encontrados:', formularioData);
        }
      } catch (error) {
        console.warn('⚠️ Erro ao buscar dados do formulário:', error);
      }

      return {
        empresa: {
          cnpj: empresaData.cnpj,
          razaoSocial: empresaData.razao_social,
          nomeFantasia: empresaData.nome_fantasia,
          situacaoCadastral: empresaData.situacao_cnpj,
          porte: empresaData.porte,
          naturezaJuridica: empresaData.natureza_juridica,
          dataAbertura: empresaData.fundacao,
          inscricaoEstadual: empresaData.inscricao_estadual,
          inscricaoSuframa: empresaData.inscricao_suframa,
        },
        endereco: endereco && endereco.length > 0 ? {
          logradouro: endereco[0].logradouro,
          numero: endereco[0].numero,
          complemento: endereco[0].complemento,
          bairro: endereco[0].bairro,
          cidade: endereco[0].cidade,
          estado: endereco[0].estado,
          cep: endereco[0].cep,
          latitude: endereco[0].latitude,
          longitude: endereco[0].longitude,
        } : {},
        contato: {
          telefones,
          emails,
        },
        formulario: formularioData || undefined,
      };

    } catch (error) {
      console.error('❌ Erro ao buscar dados da empresa:', error);
      return null;
    }
  }

  /**
   * Mapeia os dados da empresa para o formato do Atak
   */
  private mapToAtakPayload(data: ConsolidatedCompanyData): AtakCustomerPayload {
    const { empresa, endereco, contato, formulario } = data;

    // Determina tipo de pessoa (J para jurídica)
    const tipoPessoa = empresa.cnpj.length === 14 ? 'J' : 'F';

    // Extrai primeiro telefone e email
    const telefone = contato.telefones?.[0] || '';
    const email = contato.emails?.[0] || '';

    // Formata telefone removendo caracteres especiais
    const telefoneFormatado = telefone.replace(/\D/g, '');

    // Obtém códigos financeiros do formulário ou usa padrões
    // Prioriza códigos vindos das tabelas de configuração (convertendo string para número); fallback para IDs; por último, .env
    const parseCodigo = (codigoStr: string | number | undefined, envKey: string, envDefault: string, fallbackId?: number): number => {
      if (typeof codigoStr === 'number') return codigoStr;
      if (typeof codigoStr === 'string') {
        const parsed = parseInt(codigoStr);
        if (!isNaN(parsed)) return parsed;
      }
      return fallbackId || parseInt(process.env[envKey] || envDefault);
    };
    
    const codigoCarteira = formulario?.carteira_codigo 
      ? parseCodigo(formulario.carteira_codigo, 'ATAK_CODIGO_CARTEIRA', '101', formulario.codigo_carteira_id)
      : (formulario?.codigo_carteira_id || parseInt(process.env.ATAK_CODIGO_CARTEIRA || '101'));
    const codigoListaPreco = formulario?.lista_preco_codigo 
      ? parseCodigo(formulario.lista_preco_codigo, 'ATAK_CODIGO_LISTA_PRECO', '1', formulario.lista_preco_id)
      : (formulario?.lista_preco_id || parseInt(process.env.ATAK_CODIGO_LISTA_PRECO || '1'));
    const codigoFormaCobranca = formulario?.forma_cobranca_codigo 
      ? parseCodigo(formulario.forma_cobranca_codigo, 'ATAK_CODIGO_FORMA_COBRANCA', '1', formulario.forma_pagamento_desejada_id)
      : (formulario?.forma_pagamento_desejada_id || parseInt(process.env.ATAK_CODIGO_FORMA_COBRANCA || '1'));
    const codigoVendedor = formulario?.vendedor_codigo 
      ? parseCodigo(formulario.vendedor_codigo, 'ATAK_CODIGO_VENDEDOR', '1')
      : parseInt(process.env.ATAK_CODIGO_VENDEDOR || '1');
    
    // Obtém código do ramo de atividade do formulário ou usa padrão do .env
    // O ramo_atividade_id precisa ser convertido para string e formatado (com padding de zeros se necessário)
    // Prioriza campo vindo diretamente do formulário (string já formatada), depois ID numérico, depois .env
    const codigoRamoForm = (formulario?.codigoDoRamoDaAtividade || '').trim();
    const ramoAtividadeId = formulario?.ramo_atividade_id;
    const codigoRamoAtividade = codigoRamoForm
      ? codigoRamoForm.padStart(3, '0')
      : (ramoAtividadeId ? String(ramoAtividadeId).padStart(3, '0') : (process.env.ATAK_CODIGO_RAMO_ATIVIDADE || '037'));

    // Determina identificador estadual: 1 se tiver IE, 9 se não tiver
    const temInscricaoEstadual = empresa.inscricaoEstadual && empresa.inscricaoEstadual.trim().length > 0;
    const identificadorEstadual = temInscricaoEstadual ? 1 : 9;

    // Busca código IBGE do município
    const codigoIBGECidade = endereco.cidade && endereco.estado 
      ? IBGEService.buscarCodigoIBGE(endereco.cidade, endereco.estado) 
      : null;

    const payload: AtakCustomerPayload = {
      UtilizaSequenciaDaAtak: true,
      tipoDeCadastro: process.env.ATAK_TIPO_CADASTRO || 'G',
      CodigoDaFilial: process.env.ATAK_CODIGO_FILIAL || '001',
      RazaoSocial: empresa.razaoSocial,
      nomeFantasia: empresa.nomeFantasia || empresa.razaoSocial,
      tipoDePessoa: tipoPessoa,
      cpfCnpj: empresa.cnpj,
      identificadorEstadual: identificadorEstadual,
      observacao: '',
      codigoDaSituacao: this.mapSituacao(empresa.situacaoCadastral),
      codigoDoRamoDaAtividade: codigoRamoAtividade, // Vem do formulário, com fallback para .env
      codigoDoPercursoDaRotaDeEntrega: process.env.ATAK_CODIGO_PERCURSO_ROTA || '',
      uf: endereco.estado || '',
      indicadorMicroEmpresa: this.isMicroEmpresa(empresa.porte),
      suframa: empresa.inscricaoSuframa || '',
      Enderecos: {
        // Endereço Fiscal (F)
        IdDoPaisF: 'BR',
        UFF: endereco.estado,
        ConteudoEnderecoF: endereco.logradouro,
        BairroF: endereco.bairro,
        CodigoIBGECidadeF: codigoIBGECidade || undefined,
        CidadeF: endereco.cidade,
        TelefoneF: telefoneFormatado,
        EmailF: email,
        CEPF: endereco.cep?.replace(/\D/g, ''),
        NumeroF: endereco.numero,
        ObservacaoF: endereco.complemento || '',
        LatitudeF: endereco.latitude?.toString(),
        LongitudeF: endereco.longitude?.toString(),
        
        // Endereço de Cobrança (C) - usa os mesmos dados do fiscal
        UFC: endereco.estado,
        ConteudoEnderecoC: endereco.logradouro,
        BairroC: endereco.bairro,
        CodigoIBGECidadeC: codigoIBGECidade || undefined,
        CidadeC: endereco.cidade,
        TelefoneC: telefoneFormatado,
        EmailC: email,
        CEPC: endereco.cep?.replace(/\D/g, ''),
        NumeroC: endereco.numero,
        
        // Endereço de Entrega (E)
        UFE: endereco.estado,
        ConteudoEnderecoE: endereco.logradouro,
        BairroE: endereco.bairro,
        CodigoIBGECidadeE: codigoIBGECidade || undefined,
        CidadeE: endereco.cidade,
        TelefoneE: telefoneFormatado,
        EmailE: email,
        CEPE: endereco.cep?.replace(/\D/g, ''),
        NumeroE: endereco.numero,
        
        // Endereço de Retirada (R)
        UFR: endereco.estado,
        ConteudoEnderecoR: endereco.logradouro,
        BairroR: endereco.bairro,
        CodigoIBGECidadeR: codigoIBGECidade || undefined,
        CidadeR: endereco.cidade,
        TelefoneR: telefoneFormatado,
        EmailR: email,
        CEPR: endereco.cep?.replace(/\D/g, ''),
        NumeroR: endereco.numero,
        
        // Endereço de Triagem (T)
        UFT: endereco.estado,
        ConteudoEnderecoT: endereco.logradouro,
        BairroT: endereco.bairro,
        CodigoIBGECidadeT: codigoIBGECidade || undefined,
        CidadeT: endereco.cidade,
        TelefoneT: telefoneFormatado,
        EmailT: email,
        CEPT: endereco.cep?.replace(/\D/g, ''),
        NumeroT: endereco.numero,
      },
      Financeiro: {
        CodigoDaListaDePreco: codigoListaPreco,
        CodigoDaCarteira: codigoCarteira,
        CodigoFormaDeCobranca: codigoFormaCobranca,
        CodigoDoVendedor: codigoVendedor,
        // Campos opcionais (condicao_pagamento_id e limite_credito) são definidos após análise
        // e não fazem parte do payload inicial de cadastro
      },
    };

    return payload;
  }

  /**
   * Atualiza dados financeiros de um cliente existente no Atak
   * @param atakClienteId ID do cliente no Atak
   * @param condicaoPagamentoId ID da condição de pagamento
   * @param limiteCredito Limite de crédito (valor decimal)
   * @param codigoCarteira Código da carteira (opcional, se não fornecido busca do banco)
   * @param codigoFormaCobranca Código da forma de cobrança (opcional, se não fornecido busca do banco)
   * @param cnpj CNPJ do cliente (necessário para buscar valores atuais do banco)
   */
  async updateFinancialData(
    atakClienteId: number, 
    condicaoPagamentoId?: string, 
    limiteCredito?: number,
    codigoCarteira?: number,
    codigoFormaCobranca?: number,
    cnpj?: string
  ): Promise<{ success: boolean; error?: string; data?: any }> {
    // Verificar se o Atak está configurado antes de tentar qualquer operação
    if (!isAtakConfigured()) {
      console.warn('⚠️ [UPDATE-FINANCIAL] Configurações do Atak não encontradas. A atualização será apenas no banco de dados.');
      console.warn('   💡 Configure ATAK_USERNAME, ATAK_PASSWORD e ATAK_BASE_URL no .env para habilitar atualização no Atak');
      return { 
        success: false, 
        error: 'Configurações do Atak não encontradas. Dados salvos no banco, mas não atualizados no Atak. Configure ATAK_USERNAME, ATAK_PASSWORD e ATAK_BASE_URL no .env.' 
      };
    }

    let triedReauth = false;
    const api = createAtakAxios();

    while (true) {
      try {
        if (!atakClienteId) {
          return { success: false, error: 'ID do cliente no Atak não informado' };
        }

        console.log(`💰 Atualizando dados financeiros do cliente ${atakClienteId} no Atak...`);
        console.log(`   Condição de Pagamento: ${condicaoPagamentoId || 'não informado'}`);
        console.log(`   Limite de Crédito: ${limiteCredito || 'não informado'}`);
        console.log(`   Código da Carteira: ${codigoCarteira || 'buscar do banco'}`);
        console.log(`   Código da Forma de Cobrança: ${codigoFormaCobranca || 'buscar do banco'}`);

        // Se não foram fornecidos, buscar valores atuais do banco
        let codigoCarteiraFinal = codigoCarteira;
        let codigoFormaCobrancaFinal = codigoFormaCobranca;

        if ((!codigoCarteiraFinal || !codigoFormaCobrancaFinal) && cnpj) {
          try {
            // Garantir que está conectado ao banco antes de fazer a query
            if (!this.dbService || !this.dbService.isConnected()) {
              console.log('🔌 [UPDATE-FINANCIAL] Conectando ao banco de dados...');
              if (!this.dbService) {
                throw new Error('DatabaseService não foi inicializado');
              }
              await this.dbService.connect();
            }
            
            const formulario = await this.dbService.query(`
              SELECT TOP 1 
                cr.codigo_carteira_id,
                cr.forma_pagamento_desejada_id,
                cc.nome AS carteira_codigo,
                fpd.nome AS forma_cobranca_codigo
              FROM client_registrations cr
              LEFT JOIN client_config_codigo_carteira cc ON cc.id = cr.codigo_carteira_id
              LEFT JOIN client_config_forma_pagamento_desejada fpd ON fpd.id = cr.forma_pagamento_desejada_id
              WHERE cr.cnpj = '${cnpj.replace(/\D/g, '')}'
              ORDER BY cr.updated_at DESC
            `);

            if (formulario && formulario.length > 0) {
              const parseCodigo = (codigoStr: string | number | undefined, fallbackId?: number, envKey?: string, envDefault?: string): number => {
                if (typeof codigoStr === 'number') return codigoStr;
                if (typeof codigoStr === 'string') {
                  const parsed = parseInt(codigoStr);
                  if (!isNaN(parsed)) return parsed;
                }
                if (fallbackId) return fallbackId;
                return envKey ? parseInt(process.env[envKey] || envDefault || '0') : 0;
              };

              if (!codigoCarteiraFinal) {
                codigoCarteiraFinal = formulario[0].carteira_codigo
                  ? parseCodigo(formulario[0].carteira_codigo, formulario[0].codigo_carteira_id, 'ATAK_CODIGO_CARTEIRA', '101')
                  : (formulario[0].codigo_carteira_id || parseInt(process.env.ATAK_CODIGO_CARTEIRA || '101'));
              }

              if (!codigoFormaCobrancaFinal) {
                codigoFormaCobrancaFinal = formulario[0].forma_cobranca_codigo
                  ? parseCodigo(formulario[0].forma_cobranca_codigo, formulario[0].forma_pagamento_desejada_id, 'ATAK_CODIGO_FORMA_COBRANCA', '1')
                  : (formulario[0].forma_pagamento_desejada_id || parseInt(process.env.ATAK_CODIGO_FORMA_COBRANCA || '1'));
              }

              console.log(`📋 Valores obtidos do banco: Carteira=${codigoCarteiraFinal}, FormaCobranca=${codigoFormaCobrancaFinal}`);
            }
          } catch (error: any) {
            console.warn('⚠️ Erro ao buscar valores do banco, usando valores fornecidos ou padrões:', error.message || error);
          }
        }

        // Buscar token de autenticação - tentar autenticar automaticamente se não encontrar
        let token = await this.getValidToken(true); // Sempre tentar autenticar se necessário
        if (!token) {
          // Se ainda não tiver token, tentar autenticar uma vez
          if (!triedReauth) {
            console.log('🔄 [UPDATE-FINANCIAL] Tentando autenticar no Atak...');
            try {
              token = await authenticateAtak();
              triedReauth = true;
              if (token && token.trim().length > 0) {
                console.log('✅ [UPDATE-FINANCIAL] Token obtido após autenticação');
              }
            } catch (authError: any) {
              console.error('❌ [UPDATE-FINANCIAL] Erro ao autenticar:', authError.message);
              // Se ainda não conseguir autenticar após tentativa, retornar erro
              if (!triedReauth) {
                return { success: false, error: `Erro ao autenticar no Atak: ${authError.message}` };
              }
            }
          }
          
          if (!token) {
            return { success: false, error: 'Não foi possível obter token de autenticação' };
          }
        }

        // Buscar dados completos do cliente para obter informações necessárias
        if (!cnpj) {
          return { 
            success: false, 
            error: 'CNPJ não fornecido. Não é possível buscar dados do cliente para atualização.' 
          };
        }

        console.log('📋 Buscando dados do cliente para atualização no Atak...');

        // Buscar dados consolidados do cliente no banco para obter informações base
        const companyData = await this.getConsolidatedCompanyData(cnpj);
        
        if (!companyData) {
          return { 
            success: false, 
            error: 'Não foi possível buscar dados do cliente no banco de dados.' 
          };
        }

        // Criar payload conforme documentação do endpoint EditarCadastroGeral
        // O endpoint requer campos básicos obrigatórios (RazaoSocial/Nome) além dos campos financeiros
        const razaoSocial = companyData.empresa.razaoSocial || companyData.empresa.nomeFantasia || '';
        const nomeFantasia = companyData.empresa.nomeFantasia || companyData.empresa.razaoSocial || '';
        
        const editPayload: any = {
          ID: atakClienteId,
          // Campos obrigatórios básicos
          RazaoSocial: razaoSocial,
          NomeFantasia: nomeFantasia,
          // O Atak pode validar "Nome" separadamente, então adicionamos também
          Nome: razaoSocial || nomeFantasia,
        };

        // Adicionar campos financeiros que queremos atualizar
        if (codigoCarteiraFinal) {
          editPayload.CodigoDaCarteira = codigoCarteiraFinal;
        }
        if (codigoFormaCobrancaFinal) {
          editPayload.CodFormaDeCobranca = codigoFormaCobrancaFinal;
        }
        if (condicaoPagamentoId) {
          editPayload.CodCondicaoPagamento = condicaoPagamentoId;
        }
        if (limiteCredito !== undefined && limiteCredito !== null) {
          editPayload.LimiteCredito = limiteCredito;
        }

        // Se tiver dados do formulário, adicionar CodLista também
        if (companyData?.formulario?.lista_preco_codigo) {
          const codListaStr = String(companyData.formulario.lista_preco_codigo);
          const codLista = parseInt(codListaStr) || companyData.formulario.lista_preco_id || 1;
          editPayload.CodLista = codLista;
        }

        console.log('📤 Enviando payload para edição no Atak...');
        console.log('📋 Payload:', JSON.stringify(editPayload, null, 2));
        
        // Enviar PUT para EditarCadastroGeral (sem ID na URL, o ID vem no payload)
        console.log('🔗 Enviando PUT para /servico/integracaoterceiros/EditarCadastroGeral');
        const response = await api.put<AtakApiResponse<any>>(
          `/servico/integracaoterceiros/EditarCadastroGeral`,
          editPayload,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            validateStatus: () => true
          }
        );

        console.log('📥 Resposta recebida do Atak:');
        console.log('   Status:', response.status);
        console.log('   Data:', JSON.stringify(response.data, null, 2));

        if (response.status === 200 || response.status === 204) {
          const result = { success: true, data: response.data };
          console.log('✅ Dados financeiros atualizados com sucesso no Atak!');
          return result;
        } else {
          const data = response.data as any;
          const errorMsg = data?.Message || data?.Content || data?.ReasonPhrase || data?.Erro || `Erro ${response.status}`;
          console.error('❌ Erro ao atualizar no Atak:', errorMsg);
          return { 
            success: false, 
            error: `Não foi possível atualizar no Atak: ${errorMsg}. Verifique se o cliente existe no Atak e se o endpoint está correto.` 
          };
        }

      } catch (error: any) {
        console.error('❌ Erro ao atualizar dados financeiros no Atak');
        
        let errorMsg = '';
        if (error?.response) {
          errorMsg = error.response.data?.Content || error.response.data?.ReasonPhrase || (error.response.data as any)?.Erro || `Erro ${error.response.status}`;
          console.error('   Status:', error.response.status);
          console.error('   Resposta:', JSON.stringify(error.response.data, null, 2));
        } else if (error?.message) {
          errorMsg = error.message;
        } else {
          errorMsg = 'Erro desconhecido';
        }

        // Verifica se é erro de token
        if (!triedReauth && this.isTokenError(errorMsg)) {
          console.log('🔄 Token inválido. Reautenticando...');
          await authenticateAtak();
          triedReauth = true;
          continue;
        }

        return { success: false, error: errorMsg };
      }
    }
  }

  /**
   * Busca condições de pagamento disponíveis no banco de dados SQL Server (tabela tbCondPgto)
   * NOTA: Este método busca diretamente do SQL Server, NÃO do Atak
   */
  async getCondicoesPagamento(): Promise<{ success: boolean; data?: Array<{ id: string; nome: string; descricao?: string }>; error?: string }> {
    console.log('🚀🚀🚀 [CONDICOES-PAGAMENTO] MÉTODO INICIADO - BUSCANDO DO BANCO DE DADOS (tbCondPgto)');
    console.log('🚀🚀🚀 [CONDICOES-PAGAMENTO] NÃO está buscando do Atak - apenas SQL Server');
    
    try {
      console.log('🚀 [CONDICOES-PAGAMENTO] Buscando condições de pagamento do banco de dados [SATKPRIME].[dbo].[tbCondPgto]...');
      
      // Garantir que está conectado ao banco
      if (!this.dbService || !this.dbService.isConnected()) {
        console.log('🔌 [CONDICOES-PAGAMENTO] Conectando ao banco de dados...');
        if (!this.dbService) {
          throw new Error('DatabaseService não foi inicializado');
        }
        await this.dbService.connect();
      }

      // Query para buscar condições de pagamento
      // A tabela está no banco SATKPRIME, não no banco consultas_tess
      // Colunas: Cod_cond_pgto, Desc_cond_pgto
      const query = `
        SELECT TOP 1000
          CAST(Cod_cond_pgto AS VARCHAR(50)) AS id,
          Desc_cond_pgto AS nome,
          Desc_cond_pgto AS descricao
        FROM [SATKPRIME].[dbo].[tbCondPgto]
        ORDER BY Cod_cond_pgto
      `;

      console.log('📊 [CONDICOES-PAGAMENTO] Executando query...');
      const result = await this.dbService.query(query);

      if (!result || result.length === 0) {
        console.warn('⚠️ [CONDICOES-PAGAMENTO] Nenhuma condição de pagamento encontrada na tabela [SATKPRIME].[dbo].[tbCondPgto]');
        return { 
          success: true, 
          data: [] // Retornar array vazio ao invés de erro
        };
      }

      console.log(`✅ [CONDICOES-PAGAMENTO] ${result.length} condições de pagamento encontradas`);
      
      // Mapear os resultados para o formato esperado
      const condicoes = result.map((row: any) => ({
        id: String(row.id || row.Id || row.Codigo || row.CodCondPgto || ''),
        nome: String(row.nome || row.Nome || row.Descricao || row.DescCondPgto || 'Sem descrição'),
        descricao: row.descricao || row.Descricao || row.DescCondPgto || undefined
      }));

      console.log(`📋 [CONDICOES-PAGAMENTO] Primeira condição:`, condicoes[0]);
      
      return { 
        success: true, 
        data: condicoes 
      };

    } catch (error: any) {
      console.error('❌ [CONDICOES-PAGAMENTO] Erro ao buscar condições de pagamento do banco de dados:');
      console.error('   Erro:', error.message);
      console.error('   Stack:', error.stack);
      
      // Tentar uma query mais simples caso a primeira falhe
      try {
        console.log('🔄 [CONDICOES-PAGAMENTO] Tentando query alternativa (SELECT * FROM [SATKPRIME].[dbo].[tbCondPgto])...');
        const simpleQuery = 'SELECT TOP 1000 * FROM [SATKPRIME].[dbo].[tbCondPgto]';
        const result = await this.dbService.query(simpleQuery);
        
        if (result && result.length > 0) {
          console.log(`✅ [CONDICOES-PAGAMENTO] ${result.length} registros encontrados com query alternativa`);
          console.log('📋 [CONDICOES-PAGAMENTO] Colunas disponíveis:', Object.keys(result[0]));
          
          // Mapear usando as colunas disponíveis (Cod_cond_pgto, Desc_cond_pgto)
          const condicoes = result.map((row: any) => {
            const codigo = row.Cod_cond_pgto || row.cod_cond_pgto;
            const descricao = row.Desc_cond_pgto || row.desc_cond_pgto;
            
            return {
              id: String(codigo || ''),
              nome: String(descricao || 'Sem descrição'),
              descricao: descricao || undefined
            };
          });
          
          return { success: true, data: condicoes };
        }
      } catch (simpleError: any) {
        console.error('❌ [CONDICOES-PAGAMENTO] Query alternativa também falhou:', simpleError.message);
      }
      
      return { 
        success: false, 
        error: `Erro ao buscar condições de pagamento: ${error.message}. Verifique se a tabela [SATKPRIME].[dbo].[tbCondPgto] existe e está acessível.` 
      };
    }
  }

  /**
   * Mapeia a situação cadastral para o código do Atak
   * Atak aceita: A - Aprovado, B - Bloqueado, I - Inativo
   */
  private mapSituacao(situacao?: string): string {
    if (!situacao) return 'A'; // Padrão: Aprovado
    
    const situacaoUpper = situacao.toUpperCase();
    
    // Se já for A, B ou I, retorna direto
    if (situacaoUpper === 'A' || situacaoUpper === 'B' || situacaoUpper === 'I') {
      return situacaoUpper;
    }
    
    // Mapeia situações comuns
    if (situacaoUpper.includes('ATIVA') || situacaoUpper.includes('APROVADO')) return 'A';
    if (situacaoUpper.includes('SUSPENSA') || situacaoUpper.includes('BLOQUEADO')) return 'B';
    if (situacaoUpper.includes('BAIXADA') || situacaoUpper.includes('CANCELADA') || situacaoUpper.includes('INATIVO')) return 'I';
    
    // Padrão: Aprovado para empresas ativas
    return 'A';
  }

  /**
   * Determina se é micro empresa
   */
  private isMicroEmpresa(porte?: string): string {
    if (!porte) return 'N';
    
    const porteUpper = porte.toUpperCase();
    
    if (porteUpper.includes('MICRO') || porteUpper.includes('PEQUENO')) return 'S';
    
    return 'N';
  }
}

