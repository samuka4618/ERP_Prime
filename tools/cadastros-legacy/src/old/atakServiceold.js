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
    isTokenError(errorMsg) {
        if (typeof errorMsg !== 'string')
            return false;
        const tokenErrors = [
            'Token inválido para o request',
            'TOKEN_INVALIDO_USUARIO_EM_TERMINAL_DIFERENTE',
            'Verifique se o mesmo usuário não está sendo utilizado em um terminal diferente',
            'Unauthorized'
        ];
        return tokenErrors.some(msg => errorMsg.includes(msg));
    }
    async getValidToken(autoReauth = false) {
        let token = await (0, atakAuth_1.getAtakToken)();
        if (!token && autoReauth) {
            console.log('🔐 Token não encontrado. Autenticando...');
            token = await (0, atakAuth_1.authenticateAtak)();
        }
        return token;
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
                        console.warn('⚠️ Erro ao buscar valores do banco, usando valores fornecidos ou padrões:', error);
                    }
                }
                const token = await this.getValidToken(triedReauth);
                if (!token) {
                    return { success: false, error: 'Não foi possível obter token de autenticação' };
                }
                const updatePayload = {
                    Financeiro: {
                        CodigoDaListaDePreco: 0,
                        CodigoDaCarteira: codigoCarteiraFinal || parseInt(process.env.ATAK_CODIGO_CARTEIRA || '101'),
                        CodigoFormaDeCobranca: codigoFormaCobrancaFinal || parseInt(process.env.ATAK_CODIGO_FORMA_COBRANCA || '1'),
                        CodigoDoVendedor: 0,
                    }
                };
                if (condicaoPagamentoId) {
                    updatePayload.Financeiro.idDaCondicaoDePagamento = condicaoPagamentoId;
                }
                if (limiteCredito !== undefined && limiteCredito !== null) {
                    updatePayload.Financeiro.ValorDoLimiteDeCredito = limiteCredito;
                }
                console.log('📤 Payload de atualização:', JSON.stringify(updatePayload, null, 2));
                const response = await api.put(`/servico/integracaoterceiros/AtualizarCadastroGeral/${atakClienteId}`, updatePayload, {
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
                    console.log('⚠️ Endpoint de atualização retornou erro. Tentando método alternativo...');
                    const errorMsg = response.data?.Content || response.data?.ReasonPhrase || `Erro ${response.status}`;
                    return {
                        success: false,
                        error: `Não foi possível atualizar: ${errorMsg}. Verifique se o endpoint de atualização está disponível na API do Atak.`
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
        let triedReauth = false;
        const api = createAtakAxios();
        while (true) {
            try {
                const token = await this.getValidToken(triedReauth);
                if (!token) {
                    return { success: false, error: 'Não foi possível obter token de autenticação' };
                }
                console.log('🔍 Buscando condições de pagamento no Atak...');
                const possibleEndpoints = [
                    '/servico/integracaoterceiros/ObterCondicoesPagamento',
                    '/servico/integracaoterceiros/ListarCondicoesPagamento',
                    '/servico/integracaoterceiros/ObterCondicaoPagamento',
                    '/servico/integracaoterceiros/ListarCondicaoPagamento',
                    '/servico/integracaoterceiros/CondicoesPagamento',
                    '/servico/integracaoterceiros/CondicaoPagamento',
                    '/servico/integracaoterceiros/GetCondicoesPagamento',
                    '/servico/integracaoterceiros/GetCondicaoPagamento'
                ];
                for (const endpoint of possibleEndpoints) {
                    try {
                        console.log(`   Tentando endpoint: ${endpoint}`);
                        const response = await api.get(endpoint, {
                            headers: {
                                'Authorization': `Bearer ${token}`,
                            },
                            validateStatus: () => true
                        });
                        console.log(`   Resposta do endpoint ${endpoint}:`, {
                            status: response.status,
                            hasData: !!response.data,
                            contentType: typeof response.data?.Content
                        });
                        if (response.status === 200 && response.data) {
                            const content = response.data.Content || response.data;
                            let condicoes = [];
                            if (Array.isArray(content)) {
                                console.log(`   ✅ Content é um array com ${content.length} itens`);
                                condicoes = content.map((item) => ({
                                    id: item.Id || item.ID || item.id || item.Codigo || item.codigo || item.IdCondicaoPagamento || String(item),
                                    nome: item.Nome || item.nome || item.Descricao || item.descricao || item.NomeCondicaoPagamento || String(item),
                                    descricao: item.Descricao || item.descricao || item.Nome || item.nome || item.NomeCondicaoPagamento
                                }));
                            }
                            else if (content && typeof content === 'object') {
                                console.log(`   Content é um objeto, procurando array nas propriedades...`);
                                const arrayKey = Object.keys(content).find(key => Array.isArray(content[key]));
                                if (arrayKey) {
                                    console.log(`   ✅ Array encontrado na propriedade: ${arrayKey}`);
                                    condicoes = content[arrayKey].map((item) => ({
                                        id: item.Id || item.ID || item.id || item.Codigo || item.codigo || item.IdCondicaoPagamento || String(item),
                                        nome: item.Nome || item.nome || item.Descricao || item.descricao || item.NomeCondicaoPagamento || String(item),
                                        descricao: item.Descricao || item.descricao || item.Nome || item.nome || item.NomeCondicaoPagamento
                                    }));
                                }
                                else {
                                    console.log(`   ⚠️ Objeto encontrado mas sem array. Propriedades:`, Object.keys(content));
                                    if (content.Id || content.ID || content.id || content.IdCondicaoPagamento) {
                                        condicoes = [{
                                                id: String(content.Id || content.ID || content.id || content.IdCondicaoPagamento),
                                                nome: content.Nome || content.nome || content.Descricao || content.descricao || content.NomeCondicaoPagamento || '',
                                                descricao: content.Descricao || content.descricao || content.Nome || content.nome || content.NomeCondicaoPagamento
                                            }];
                                    }
                                }
                            }
                            if (condicoes.length > 0) {
                                console.log(`✅ ${condicoes.length} condições de pagamento encontradas no Atak via endpoint: ${endpoint}`);
                                console.log(`   Primeira condição:`, condicoes[0]);
                                return { success: true, data: condicoes };
                            }
                            else {
                                console.log(`   ⚠️ Endpoint ${endpoint} retornou 200 mas sem dados extraídos`);
                            }
                        }
                        else {
                            console.log(`   ⚠️ Endpoint ${endpoint} retornou status ${response.status}`);
                        }
                    }
                    catch (endpointError) {
                        const errorMsg = endpointError?.response?.data || endpointError?.message || 'Erro desconhecido';
                        console.log(`   ❌ Erro no endpoint ${endpoint}:`, {
                            status: endpointError?.response?.status,
                            message: typeof errorMsg === 'string' ? errorMsg.substring(0, 100) : 'Erro não textual'
                        });
                        continue;
                    }
                }
                return {
                    success: false,
                    error: 'Não foi possível encontrar endpoint de condições de pagamento no Atak. Verifique a documentação da API.'
                };
            }
            catch (error) {
                console.error('❌ Erro ao buscar condições de pagamento no Atak');
                let errorMsg = '';
                if (error?.response) {
                    errorMsg = error.response.data?.Content || error.response.data?.ReasonPhrase || `Erro ${error.response.status}`;
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