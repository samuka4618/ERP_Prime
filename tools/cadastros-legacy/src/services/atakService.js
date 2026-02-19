"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AtakService = void 0;
const axios_1 = __importDefault(require("axios"));
const atakAuth_1 = require("./atakAuth");
const atakConstants_1 = require("./atakConstants");
const ibgeService_1 = require("./ibgeService");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const createAtakAxios = () => {
    return axios_1.default.create({
        baseURL: process.env.ATAK_BASE_URL || '',
        timeout: 30000,
        headers: {
            'Content-Type': 'application/json'
        }
    });
};
class AtakService {
    constructor(dbService) {
        this.baseUrl = process.env.ATAK_BASE_URL || '';
        this.dbService = dbService;
    }
    async searchCustomer(cnpj) {
        let triedReauth = false;
        const api = createAtakAxios();
        while (true) {
            try {
                if (!cnpj) {
                    throw new Error('CNPJ não informado');
                }
                const cleanCnpj = cnpj.replace(/\D/g, '');
                let foundCustomer = null;
                for (const tipo of atakConstants_1.TIPOS_DE_CADASTRO) {
                    try {
                        console.log(`🔍 Buscando cliente ${cleanCnpj} como tipo ${tipo.ID} (${tipo.Nome})...`);
                        const token = await this.getValidToken(triedReauth);
                        if (!token) {
                            throw new Error('Não foi possível obter token válido');
                        }
                        const response = await api.get(`/servico/integracaoterceiros/ObterCadastrosGerais/${tipo.ID}/${cleanCnpj}`, {
                            headers: {
                                'Authorization': `Bearer ${token}`,
                            }
                        });
                        if (response.data) {
                            foundCustomer = response.data;
                            console.log(`✅ Cliente encontrado como tipo ${tipo.ID}:`, foundCustomer);
                            return foundCustomer;
                        }
                    }
                    catch (error) {
                        const errorMsg = error?.response?.data || error?.message || '';
                        if (!triedReauth && this.isTokenError(errorMsg)) {
                            console.warn('🔄 Token inválido detectado. Reautenticando...');
                            await (0, atakAuth_1.authenticateAtak)();
                            triedReauth = true;
                            break;
                        }
                        continue;
                    }
                }
                if (foundCustomer) {
                    return foundCustomer;
                }
                console.log(`⚠️ Cliente ${cleanCnpj} não encontrado em nenhum tipo de cadastro`);
                return null;
            }
            catch (error) {
                const errorMsg = error?.response?.data || error?.message || '';
                if (!triedReauth && this.isTokenError(errorMsg)) {
                    console.warn('🔄 Token inválido detectado. Reautenticando...');
                    await (0, atakAuth_1.authenticateAtak)();
                    triedReauth = true;
                    continue;
                }
                throw error;
            }
        }
    }
    async getCustomerById(atakClienteId) {
        if (!(0, atakAuth_1.isAtakConfigured)()) {
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
                let token = await this.getValidToken(true);
                if (!token) {
                    if (!triedReauth) {
                        console.log('🔄 Tentando autenticar no Atak...');
                        try {
                            token = await (0, atakAuth_1.authenticateAtak)();
                            triedReauth = true;
                        }
                        catch (authError) {
                            console.error('❌ Erro ao autenticar:', authError.message);
                            return { success: false, error: `Erro ao autenticar no Atak: ${authError.message}` };
                        }
                    }
                    if (!token) {
                        return { success: false, error: 'Não foi possível obter token de autenticação' };
                    }
                }
                const response = await api.get(`/servico/integracaoterceiros/ObterCadastroGeralPorId/${atakClienteId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                    validateStatus: () => true,
                    timeout: 60000
                });
                console.log('📥 Resposta recebida do Atak:');
                console.log('   Status:', response.status);
                console.log('   Data:', JSON.stringify(response.data, null, 2));
                const responseData = response.data;
                let responseString = '';
                if (typeof responseData === 'string') {
                    responseString = responseData;
                }
                else if (responseData) {
                    responseString = JSON.stringify(responseData);
                }
                const hasTokenError = responseString.includes('TOKEN_INVALIDO_USUARIO_EM_TERMINAL_DIFERENTE') ||
                    responseString.includes('Token inválido para o request') ||
                    responseString.includes('Verifique se o mesmo usuário não está sendo utilizado em um terminal diferente');
                if (hasTokenError && !triedReauth) {
                    console.log('🔄 Erro de token detectado na resposta. Limpando token antigo e reautenticando...');
                    try {
                        await this.clearAtakToken();
                    }
                    catch (clearError) {
                        console.warn('⚠️ Erro ao limpar token antigo (continuando mesmo assim):', clearError);
                    }
                    const newToken = await (0, atakAuth_1.authenticateAtak)();
                    if (newToken && newToken.trim().length > 0) {
                        console.log('✅ Novo token obtido após reautenticação');
                        triedReauth = true;
                        token = newToken;
                        continue;
                    }
                    else {
                        console.error('❌ Falha ao obter novo token após reautenticação');
                        return { success: false, error: 'Não foi possível obter novo token após erro de autenticação' };
                    }
                }
                if (response.status === 200 && !hasTokenError) {
                    if (typeof responseData === 'object' && responseData !== null && !responseString.includes('~EXCEPTION')) {
                        return { success: true, data: responseData };
                    }
                    else if (typeof responseData === 'string' && responseData.includes('~EXCEPTION')) {
                        const errorMsg = this.extractErrorMessage(responseString);
                        if (!triedReauth && this.isTokenError(errorMsg)) {
                            console.log('🔄 Erro de token detectado. Limpando token antigo e reautenticando...');
                            try {
                                await this.clearAtakToken();
                            }
                            catch (clearError) {
                                console.warn('⚠️ Erro ao limpar token antigo (continuando mesmo assim):', clearError);
                            }
                            const newToken = await (0, atakAuth_1.authenticateAtak)();
                            if (newToken && newToken.trim().length > 0) {
                                console.log('✅ Novo token obtido após reautenticação');
                                triedReauth = true;
                                token = newToken;
                                continue;
                            }
                            else {
                                return { success: false, error: 'Não foi possível obter novo token após erro de autenticação' };
                            }
                        }
                        return { success: false, error: errorMsg };
                    }
                    else {
                        return { success: true, data: responseData };
                    }
                }
                else {
                    const data = response.data;
                    const errorMsg = data?.Message || data?.Content || data?.ReasonPhrase || this.extractErrorMessage(responseString) || `Erro ${response.status}`;
                    if (!triedReauth && this.isTokenError(errorMsg)) {
                        console.log('🔄 Erro de token detectado. Limpando token antigo e reautenticando...');
                        try {
                            await this.clearAtakToken();
                        }
                        catch (clearError) {
                            console.warn('⚠️ Erro ao limpar token antigo (continuando mesmo assim):', clearError);
                        }
                        const newToken = await (0, atakAuth_1.authenticateAtak)();
                        if (newToken && newToken.trim().length > 0) {
                            console.log('✅ Novo token obtido após reautenticação');
                            triedReauth = true;
                            token = newToken;
                            continue;
                        }
                        else {
                            return { success: false, error: 'Não foi possível obter novo token após erro de autenticação' };
                        }
                    }
                    return { success: false, error: `Não foi possível buscar dados: ${errorMsg}` };
                }
            }
            catch (error) {
                console.error('❌ Erro ao buscar dados do cliente no Atak');
                let errorMsg = '';
                if (error?.response) {
                    errorMsg = error.response.data?.Content || error.response.data?.ReasonPhrase || error.response.data?.Erro || `Erro ${error.response.status}`;
                    console.error('   Status:', error.response.status);
                    console.error('   Resposta:', JSON.stringify(error.response.data, null, 2));
                }
                else if (error?.message) {
                    errorMsg = error.message;
                }
                else {
                    errorMsg = 'Erro desconhecido';
                }
                if (!triedReauth && this.isTokenError(errorMsg)) {
                    console.log('🔄 Token inválido. Limpando token antigo e reautenticando...');
                    try {
                        await this.clearAtakToken();
                    }
                    catch (clearError) {
                        console.warn('⚠️ Erro ao limpar token antigo (continuando mesmo assim):', clearError);
                    }
                    const newToken = await (0, atakAuth_1.authenticateAtak)();
                    if (newToken && newToken.trim().length > 0) {
                        console.log('✅ Novo token obtido após reautenticação');
                        triedReauth = true;
                        continue;
                    }
                    else {
                        return { success: false, error: 'Não foi possível obter novo token após erro de autenticação' };
                    }
                }
                return { success: false, error: errorMsg };
            }
        }
    }
    async clearAtakToken() {
        try {
            const fs = require('fs').promises;
            const path = require('path');
            const envPath = path.resolve(process.cwd(), '.env');
            try {
                let envContent = await fs.readFile(envPath, 'utf-8');
                envContent = envContent.replace(/^ATAK_TOKEN=.*$/m, '');
                await fs.writeFile(envPath, envContent, 'utf-8');
                console.log('✅ Token antigo removido do .env');
            }
            catch (error) {
                console.warn('⚠️ Não foi possível limpar token do .env (arquivo pode não existir)');
            }
            delete process.env.ATAK_TOKEN;
        }
        catch (error) {
            console.warn('⚠️ Erro ao limpar token:', error);
        }
    }
    extractErrorMessage(responseString) {
        if (typeof responseString !== 'string')
            return '';
        const exceptionMatch = responseString.match(/~EXCEPTION_MESSAGE\([^)]+\)\s*([^~]+)/);
        if (exceptionMatch && exceptionMatch[1]) {
            return exceptionMatch[1].trim();
        }
        if (responseString.includes('Token inválido')) {
            const tokenErrorMatch = responseString.match(/Token inválido[^<]+/);
            if (tokenErrorMatch) {
                return tokenErrorMatch[0].trim();
            }
        }
        return responseString;
    }
    isTokenError(errorMsg) {
        if (typeof errorMsg !== 'string')
            return false;
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
    async getValidToken(autoReauth = false) {
        try {
            console.log('🔍 [ATAK-TOKEN] Buscando token existente...');
            let token = await (0, atakAuth_1.getAtakToken)();
            if (token && token.trim().length > 0) {
                console.log('✅ [ATAK-TOKEN] Token encontrado no .env (tamanho:', token.length, 'caracteres)');
                return token;
            }
            console.log('⚠️ [ATAK-TOKEN] Token não encontrado ou vazio no .env');
            if (autoReauth) {
                console.log('🔄 [ATAK-TOKEN] Tentando autenticar...');
                try {
                    token = await (0, atakAuth_1.authenticateAtak)();
                    if (token && token.trim().length > 0) {
                        console.log('✅ [ATAK-TOKEN] Token obtido com sucesso após autenticação');
                        return token;
                    }
                    else {
                        console.error('❌ [ATAK-TOKEN] Autenticação retornou token vazio');
                        return null;
                    }
                }
                catch (authError) {
                    console.error('❌ [ATAK-TOKEN] Erro durante autenticação:', authError.message);
                    return null;
                }
            }
            else {
                console.log('⚠️ [ATAK-TOKEN] autoReauth=false, não tentando autenticar automaticamente');
            }
            return null;
        }
        catch (error) {
            console.error('❌ [ATAK-TOKEN] Erro ao buscar token:', error.message);
            return null;
        }
    }
    async saveAtakResponse(cnpj, result, registrationId) {
        try {
            if (!this.dbService.isConnected()) {
                await this.dbService.connect();
            }
            const cleanCnpj = cnpj.replace(/\D/g, '');
            const atakClienteId = result.customerId || result.data?.ID || result.data?.id || null;
            const atakRespostaJson = result.data ? JSON.stringify(result.data) : null;
            const atakDataCadastro = new Date();
            const atakErro = result.success ? null : result.error;
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
            const existingByCnpj = await this.dbService.query(`
        SELECT TOP 1 id, atak_cliente_id, codigo_carteira_id, lista_preco_id, forma_pagamento_desejada_id
        FROM client_registrations
        WHERE REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '-', ''), '/', '') = '${cleanCnpj}'
      `);
            if (existingByCnpj && existingByCnpj.length > 0) {
                const existingRecord = existingByCnpj[0];
                console.log('[ATAK][SAVE] updateByCnpj', { cnpj: cleanCnpj, atakClienteId, hasData: !!atakRespostaJson, hasError: !!atakErro });
                if (existingRecord.atak_cliente_id && existingRecord.atak_cliente_id !== atakClienteId) {
                    console.warn(`⚠️  Cliente ${cleanCnpj} já possui atak_cliente_id ${existingRecord.atak_cliente_id}, novo ID ${atakClienteId} será ignorado`);
                }
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
            const empresa = await this.dbService.query(`
        SELECT TOP 1 razao_social, nome_fantasia
        FROM empresa 
        WHERE cnpj = '${cleanCnpj}'
        ORDER BY updated_at DESC
      `);
            const razaoSocial = empresa && empresa.length > 0
                ? empresa[0].razao_social
                : 'EMPRESA NÃO ENCONTRADA';
            const codigoCarteira = parseInt(process.env.ATAK_CODIGO_CARTEIRA || '101');
            const codigoListaPreco = parseInt(process.env.ATAK_CODIGO_LISTA_PRECO || '1');
            const codigoFormaCobranca = parseInt(process.env.ATAK_CODIGO_FORMA_COBRANCA || '1');
            const carteiraExists = await this.dbService.query(`
        SELECT TOP 1 id FROM client_config_codigo_carteira WHERE id = ${codigoCarteira}
      `);
            const finalCodigoCarteira = (carteiraExists && carteiraExists.length > 0) ? codigoCarteira : 'NULL';
            const finalListaPreco = codigoListaPreco;
            const finalFormaCobranca = codigoFormaCobranca;
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
        }
        catch (error) {
            const errorMessage = error.message || 'Erro desconhecido';
            if (errorMessage.includes('FOREIGN KEY constraint')) {
                console.error('❌ Erro de Foreign Key ao salvar resposta do Atak:', errorMessage);
                console.error('   💡 Verifique se os valores de codigo_carteira_id, lista_preco_id ou forma_pagamento_desejada_id existem nas tabelas relacionadas');
            }
            else if (errorMessage.includes('PRIMARY KEY constraint') || errorMessage.includes('duplicate key')) {
                console.error('❌ Erro de duplicação ao salvar resposta do Atak:', errorMessage);
                console.error('   💡 Tentando atualizar registro existente...');
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
                }
                catch (updateError) {
                    console.error('❌ Erro ao tentar atualizar registro:', updateError.message);
                }
            }
            else {
                console.error('❌ Erro ao salvar resposta do Atak:', errorMessage);
                console.error('   Detalhes:', error);
            }
        }
    }
    async registerCompany(cnpj) {
        let triedReauth = false;
        while (true) {
            try {
                console.log(`🏢 Iniciando cadastro da empresa ${cnpj} no sistema Atak...`);
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
                    await this.saveAtakResponse(cnpj, result);
                    return result;
                }
                const companyData = await this.getConsolidatedCompanyData(cnpj);
                if (!companyData) {
                    return { success: false, error: 'Empresa não encontrada no banco de dados' };
                }
                const atakPayload = this.mapToAtakPayload(companyData);
                let token = await this.getValidToken(triedReauth);
                if (!token) {
                    return { success: false, error: 'Não foi possível obter token de autenticação' };
                }
                const api = createAtakAxios();
                console.log('📤 Enviando dados para Atak...');
                console.log('📋 Payload:', JSON.stringify(atakPayload, null, 2));
                const response = await api.post('/servico/integracaoterceiros/CadastroGeral', atakPayload, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                    validateStatus: () => true
                });
                console.log('📥 Resposta recebida do Atak:');
                console.log('   Status:', response.status);
                console.log('   Data:', JSON.stringify(response.data, null, 2));
                if (response.status !== 200) {
                    let errorMsg = '';
                    if (typeof response.data === 'string') {
                        errorMsg = response.data;
                    }
                    else if (response.data && typeof response.data === 'object') {
                        const data = response.data;
                        errorMsg = data.Content || data.Erro || data.ReasonPhrase || `Erro ${response.status}: ${response.statusText}`;
                    }
                    else {
                        errorMsg = `Erro ${response.status}: ${response.statusText}`;
                    }
                    throw new Error(errorMsg);
                }
                if (response.data && typeof response.data === 'object') {
                    const data = response.data;
                    if ('IsSuccessStatusCode' in data) {
                        if (!data.IsSuccessStatusCode) {
                            const errorMsg = data.Content || data.Erro || data.ReasonPhrase || 'Erro desconhecido ao cadastrar';
                            throw new Error(errorMsg);
                        }
                    }
                    console.log('✅ Empresa cadastrada com sucesso no Atak!');
                    console.log('📋 Resposta:', response.data);
                }
                else {
                    console.log('✅ Empresa cadastrada com sucesso no Atak!');
                    console.log('📋 Resposta:', response.data);
                }
                const result = { success: true, data: response.data };
                await this.saveAtakResponse(cnpj, result);
                return result;
            }
            catch (error) {
                console.error('❌ Erro ao cadastrar empresa no Atak');
                let errorMsg = '';
                let errorDetails = {};
                if (error?.response) {
                    errorDetails = {
                        status: error.response.status,
                        statusText: error.response.statusText,
                        headers: error.response.headers,
                        data: error.response.data
                    };
                    if (typeof error.response.data === 'string') {
                        errorMsg = error.response.data;
                    }
                    else if (error.response.data?.Content) {
                        errorMsg = error.response.data.Content;
                    }
                    else if (error.response.data?.Erro) {
                        errorMsg = error.response.data.Erro;
                    }
                    else if (error.response.data?.ReasonPhrase) {
                        errorMsg = error.response.data.ReasonPhrase;
                    }
                    else {
                        errorMsg = `Erro ${error.response.status}: ${error.response.statusText}`;
                    }
                    console.error('   Status:', error.response.status);
                    console.error('   Status Text:', error.response.statusText);
                    console.error('   Resposta:', JSON.stringify(error.response.data, null, 2));
                }
                else if (error?.message) {
                    errorMsg = error.message;
                    console.error('   Mensagem:', error.message);
                }
                else {
                    errorMsg = 'Erro desconhecido';
                    console.error('   Erro completo:', error);
                }
                if (!triedReauth && this.isTokenError(errorMsg)) {
                    console.log('🔄 Token inválido. Reautenticando...');
                    await (0, atakAuth_1.authenticateAtak)();
                    triedReauth = true;
                    continue;
                }
                const errorResult = {
                    success: false,
                    error: errorMsg,
                    details: errorDetails
                };
                await this.saveAtakResponse(cnpj, errorResult);
                return errorResult;
            }
        }
    }
    async getConsolidatedCompanyData(cnpj) {
        try {
            if (!this.dbService.isConnected()) {
                await this.dbService.connect();
            }
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
            let telefones = [];
            let emails = [];
            if (contato && contato.length > 0) {
                try {
                    const telefonesFixos = JSON.parse(contato[0].telefones_fixos || '[]');
                    const telefonesCelulares = JSON.parse(contato[0].telefones_celulares || '[]');
                    telefones = [...telefonesFixos, ...telefonesCelulares];
                    emails = JSON.parse(contato[0].emails || '[]');
                }
                catch (error) {
                    console.warn('⚠️ Erro ao parsear dados de contato:', error);
                }
            }
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
                        codigoDoRamoDaAtividade: formulario[0].ramo_codigo || undefined,
                        carteira_codigo: formulario[0].carteira_codigo || undefined,
                        lista_preco_codigo: formulario[0].lista_preco_codigo || undefined,
                        forma_cobranca_codigo: formulario[0].forma_cobranca_codigo || undefined,
                        vendedor_codigo: formulario[0].vendedor_codigo || undefined
                    };
                    console.log('📋 Dados do formulário encontrados:', formularioData);
                }
            }
            catch (error) {
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
        }
        catch (error) {
            console.error('❌ Erro ao buscar dados da empresa:', error);
            return null;
        }
    }
    mapToAtakPayload(data) {
        const { empresa, endereco, contato, formulario } = data;
        const tipoPessoa = empresa.cnpj.length === 14 ? 'J' : 'F';
        const telefone = contato.telefones?.[0] || '';
        const email = contato.emails?.[0] || '';
        const telefoneFormatado = telefone.replace(/\D/g, '');
        const parseCodigo = (codigoStr, envKey, envDefault, fallbackId) => {
            if (typeof codigoStr === 'number')
                return codigoStr;
            if (typeof codigoStr === 'string') {
                const parsed = parseInt(codigoStr);
                if (!isNaN(parsed))
                    return parsed;
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
        const codigoRamoForm = (formulario?.codigoDoRamoDaAtividade || '').trim();
        const ramoAtividadeId = formulario?.ramo_atividade_id;
        const codigoRamoAtividade = codigoRamoForm
            ? codigoRamoForm.padStart(3, '0')
            : (ramoAtividadeId ? String(ramoAtividadeId).padStart(3, '0') : (process.env.ATAK_CODIGO_RAMO_ATIVIDADE || '037'));
        const temInscricaoEstadual = empresa.inscricaoEstadual && empresa.inscricaoEstadual.trim().length > 0;
        const identificadorEstadual = temInscricaoEstadual ? 1 : 9;
        const codigoIBGECidade = endereco.cidade && endereco.estado
            ? ibgeService_1.IBGEService.buscarCodigoIBGE(endereco.cidade, endereco.estado)
            : null;
        const payload = {
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
            codigoDoRamoDaAtividade: codigoRamoAtividade,
            codigoDoPercursoDaRotaDeEntrega: process.env.ATAK_CODIGO_PERCURSO_ROTA || '',
            uf: endereco.estado || '',
            indicadorMicroEmpresa: this.isMicroEmpresa(empresa.porte),
            suframa: empresa.inscricaoSuframa || '',
            Enderecos: {
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
                UFC: endereco.estado,
                ConteudoEnderecoC: endereco.logradouro,
                BairroC: endereco.bairro,
                CodigoIBGECidadeC: codigoIBGECidade || undefined,
                CidadeC: endereco.cidade,
                TelefoneC: telefoneFormatado,
                EmailC: email,
                CEPC: endereco.cep?.replace(/\D/g, ''),
                NumeroC: endereco.numero,
                UFE: endereco.estado,
                ConteudoEnderecoE: endereco.logradouro,
                BairroE: endereco.bairro,
                CodigoIBGECidadeE: codigoIBGECidade || undefined,
                CidadeE: endereco.cidade,
                TelefoneE: telefoneFormatado,
                EmailE: email,
                CEPE: endereco.cep?.replace(/\D/g, ''),
                NumeroE: endereco.numero,
                UFR: endereco.estado,
                ConteudoEnderecoR: endereco.logradouro,
                BairroR: endereco.bairro,
                CodigoIBGECidadeR: codigoIBGECidade || undefined,
                CidadeR: endereco.cidade,
                TelefoneR: telefoneFormatado,
                EmailR: email,
                CEPR: endereco.cep?.replace(/\D/g, ''),
                NumeroR: endereco.numero,
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
            },
        };
        return payload;
    }
    async updateFinancialData(atakClienteId, condicaoPagamentoId, limiteCredito, codigoCarteira, codigoFormaCobranca, cnpj) {
        if (!(0, atakAuth_1.isAtakConfigured)()) {
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
                let codigoCarteiraFinal = codigoCarteira;
                let codigoFormaCobrancaFinal = codigoFormaCobranca;
                if ((!codigoCarteiraFinal || !codigoFormaCobrancaFinal) && cnpj) {
                    try {
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
                            const parseCodigo = (codigoStr, fallbackId, envKey, envDefault) => {
                                if (typeof codigoStr === 'number')
                                    return codigoStr;
                                if (typeof codigoStr === 'string') {
                                    const parsed = parseInt(codigoStr);
                                    if (!isNaN(parsed))
                                        return parsed;
                                }
                                if (fallbackId)
                                    return fallbackId;
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
                    }
                    catch (error) {
                        console.warn('⚠️ Erro ao buscar valores do banco, usando valores fornecidos ou padrões:', error.message || error);
                    }
                }
                let token = await this.getValidToken(true);
                if (!token) {
                    if (!triedReauth) {
                        console.log('🔄 [UPDATE-FINANCIAL] Tentando autenticar no Atak...');
                        try {
                            token = await (0, atakAuth_1.authenticateAtak)();
                            triedReauth = true;
                            if (token && token.trim().length > 0) {
                                console.log('✅ [UPDATE-FINANCIAL] Token obtido após autenticação');
                            }
                        }
                        catch (authError) {
                            console.error('❌ [UPDATE-FINANCIAL] Erro ao autenticar:', authError.message);
                            if (!triedReauth) {
                                return { success: false, error: `Erro ao autenticar no Atak: ${authError.message}` };
                            }
                        }
                    }
                    if (!token) {
                        return { success: false, error: 'Não foi possível obter token de autenticação' };
                    }
                }
                if (!cnpj) {
                    return {
                        success: false,
                        error: 'CNPJ não fornecido. Não é possível buscar dados do cliente para atualização.'
                    };
                }
                console.log('📋 Buscando dados do cliente para atualização no Atak...');
                const companyData = await this.getConsolidatedCompanyData(cnpj);
                if (!companyData) {
                    return {
                        success: false,
                        error: 'Não foi possível buscar dados do cliente no banco de dados.'
                    };
                }
                const razaoSocial = companyData.empresa.razaoSocial || companyData.empresa.nomeFantasia || '';
                const nomeFantasia = companyData.empresa.nomeFantasia || companyData.empresa.razaoSocial || '';
                const editPayload = {
                    ID: atakClienteId,
                    RazaoSocial: razaoSocial,
                    NomeFantasia: nomeFantasia,
                    Nome: razaoSocial || nomeFantasia,
                };
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
                if (companyData?.formulario?.lista_preco_codigo) {
                    const codListaStr = String(companyData.formulario.lista_preco_codigo);
                    const codLista = parseInt(codListaStr) || companyData.formulario.lista_preco_id || 1;
                    editPayload.CodLista = codLista;
                }
                console.log('📤 Enviando payload para edição no Atak...');
                console.log('📋 Payload:', JSON.stringify(editPayload, null, 2));
                console.log('🔗 Enviando PUT para /servico/integracaoterceiros/EditarCadastroGeral');
                const response = await api.put(`/servico/integracaoterceiros/EditarCadastroGeral`, editPayload, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                    validateStatus: () => true
                });
                console.log('📥 Resposta recebida do Atak:');
                console.log('   Status:', response.status);
                console.log('   Data:', JSON.stringify(response.data, null, 2));
                if (response.status === 200 || response.status === 204) {
                    const result = { success: true, data: response.data };
                    console.log('✅ Dados financeiros atualizados com sucesso no Atak!');
                    return result;
                }
                else {
                    const data = response.data;
                    const errorMsg = data?.Message || data?.Content || data?.ReasonPhrase || data?.Erro || `Erro ${response.status}`;
                    console.error('❌ Erro ao atualizar no Atak:', errorMsg);
                    return {
                        success: false,
                        error: `Não foi possível atualizar no Atak: ${errorMsg}. Verifique se o cliente existe no Atak e se o endpoint está correto.`
                    };
                }
            }
            catch (error) {
                console.error('❌ Erro ao atualizar dados financeiros no Atak');
                let errorMsg = '';
                if (error?.response) {
                    errorMsg = error.response.data?.Content || error.response.data?.ReasonPhrase || error.response.data?.Erro || `Erro ${error.response.status}`;
                    console.error('   Status:', error.response.status);
                    console.error('   Resposta:', JSON.stringify(error.response.data, null, 2));
                }
                else if (error?.message) {
                    errorMsg = error.message;
                }
                else {
                    errorMsg = 'Erro desconhecido';
                }
                if (!triedReauth && this.isTokenError(errorMsg)) {
                    console.log('🔄 Token inválido. Reautenticando...');
                    await (0, atakAuth_1.authenticateAtak)();
                    triedReauth = true;
                    continue;
                }
                return { success: false, error: errorMsg };
            }
        }
    }
    async getCondicoesPagamento() {
        console.log('🚀🚀🚀 [CONDICOES-PAGAMENTO] MÉTODO INICIADO - BUSCANDO DO BANCO DE DADOS (tbCondPgto)');
        console.log('🚀🚀🚀 [CONDICOES-PAGAMENTO] NÃO está buscando do Atak - apenas SQL Server');
        try {
            console.log('🚀 [CONDICOES-PAGAMENTO] Buscando condições de pagamento do banco de dados [SATKPRIME].[dbo].[tbCondPgto]...');
            if (!this.dbService || !this.dbService.isConnected()) {
                console.log('🔌 [CONDICOES-PAGAMENTO] Conectando ao banco de dados...');
                if (!this.dbService) {
                    throw new Error('DatabaseService não foi inicializado');
                }
                await this.dbService.connect();
            }
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
                    data: []
                };
            }
            console.log(`✅ [CONDICOES-PAGAMENTO] ${result.length} condições de pagamento encontradas`);
            const condicoes = result.map((row) => ({
                id: String(row.id || row.Id || row.Codigo || row.CodCondPgto || ''),
                nome: String(row.nome || row.Nome || row.Descricao || row.DescCondPgto || 'Sem descrição'),
                descricao: row.descricao || row.Descricao || row.DescCondPgto || undefined
            }));
            console.log(`📋 [CONDICOES-PAGAMENTO] Primeira condição:`, condicoes[0]);
            return {
                success: true,
                data: condicoes
            };
        }
        catch (error) {
            console.error('❌ [CONDICOES-PAGAMENTO] Erro ao buscar condições de pagamento do banco de dados:');
            console.error('   Erro:', error.message);
            console.error('   Stack:', error.stack);
            try {
                console.log('🔄 [CONDICOES-PAGAMENTO] Tentando query alternativa (SELECT * FROM [SATKPRIME].[dbo].[tbCondPgto])...');
                const simpleQuery = 'SELECT TOP 1000 * FROM [SATKPRIME].[dbo].[tbCondPgto]';
                const result = await this.dbService.query(simpleQuery);
                if (result && result.length > 0) {
                    console.log(`✅ [CONDICOES-PAGAMENTO] ${result.length} registros encontrados com query alternativa`);
                    console.log('📋 [CONDICOES-PAGAMENTO] Colunas disponíveis:', Object.keys(result[0]));
                    const condicoes = result.map((row) => {
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
            }
            catch (simpleError) {
                console.error('❌ [CONDICOES-PAGAMENTO] Query alternativa também falhou:', simpleError.message);
            }
            return {
                success: false,
                error: `Erro ao buscar condições de pagamento: ${error.message}. Verifique se a tabela [SATKPRIME].[dbo].[tbCondPgto] existe e está acessível.`
            };
        }
    }
    mapSituacao(situacao) {
        if (!situacao)
            return 'A';
        const situacaoUpper = situacao.toUpperCase();
        if (situacaoUpper === 'A' || situacaoUpper === 'B' || situacaoUpper === 'I') {
            return situacaoUpper;
        }
        if (situacaoUpper.includes('ATIVA') || situacaoUpper.includes('APROVADO'))
            return 'A';
        if (situacaoUpper.includes('SUSPENSA') || situacaoUpper.includes('BLOQUEADO'))
            return 'B';
        if (situacaoUpper.includes('BAIXADA') || situacaoUpper.includes('CANCELADA') || situacaoUpper.includes('INATIVO'))
            return 'I';
        return 'A';
    }
    isMicroEmpresa(porte) {
        if (!porte)
            return 'N';
        const porteUpper = porte.toUpperCase();
        if (porteUpper.includes('MICRO') || porteUpper.includes('PEQUENO'))
            return 'S';
        return 'N';
    }
}
exports.AtakService = AtakService;
//# sourceMappingURL=atakService.js.map