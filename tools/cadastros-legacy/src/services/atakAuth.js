"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAtakConfigured = exports.isTokenValid = exports.getAtakToken = exports.authenticateAtak = void 0;
const axios_1 = __importDefault(require("axios"));
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const dotenv_1 = __importDefault(require("dotenv"));
if (!process.env.ATAK_USERNAME && !process.env.ATAK_PASSWORD && !process.env.ATAK_BASE_URL) {
    const fsSync = require('fs');
    const possiblePaths = [
        node_path_1.default.resolve(process.cwd(), '.env'),
        node_path_1.default.resolve(__dirname, '../../../.env'),
        node_path_1.default.resolve(__dirname, '../../../../.env'),
    ];
    for (const envPath of possiblePaths) {
        try {
            if (fsSync.existsSync(envPath)) {
                dotenv_1.default.config({ path: envPath, override: false });
                console.log('✅ [ATAK-AUTH] .env carregado de:', envPath);
                break;
            }
        }
        catch (err) {
        }
    }
}
const authenticateAtak = async () => {
    try {
        console.log('🔍 [ATAK-AUTH] Verificando variáveis de ambiente...');
        console.log('   ATAK_USERNAME existe?', !!process.env.ATAK_USERNAME);
        console.log('   ATAK_PASSWORD existe?', !!process.env.ATAK_PASSWORD);
        console.log('   ATAK_BASE_URL existe?', !!process.env.ATAK_BASE_URL);
        console.log('   ATAK_BASE_URL valor:', process.env.ATAK_BASE_URL || '(vazio)');
        console.log('   CWD:', process.cwd());
        console.log('   __dirname:', __dirname);
        const config = {
            username: process.env.ATAK_USERNAME || '',
            password: process.env.ATAK_PASSWORD || '',
            baseUrl: process.env.ATAK_BASE_URL || ''
        };
        console.log('🔐 [ATAK-AUTH] Iniciando autenticação...');
        console.log('📋 [ATAK-AUTH] Configurações:', {
            hasUsername: !!config.username,
            hasPassword: !!config.password,
            baseUrl: config.baseUrl,
            usernameLength: config.username.length
        });
        if (!config.username || !config.password || !config.baseUrl) {
            const missing = [];
            if (!config.username)
                missing.push('ATAK_USERNAME');
            if (!config.password)
                missing.push('ATAK_PASSWORD');
            if (!config.baseUrl)
                missing.push('ATAK_BASE_URL');
            const errorMsg = `Configurações do Atak não encontradas. Verifique as seguintes variáveis no arquivo .env: ${missing.join(', ')}`;
            console.error('❌ [ATAK-AUTH]', errorMsg);
            throw new Error(errorMsg);
        }
        const authUrl = `${config.baseUrl}/auth-integracao.axd`;
        console.log('🌐 [ATAK-AUTH] URL de autenticação:', authUrl);
        console.log('📤 [ATAK-AUTH] Enviando requisição...');
        const response = await axios_1.default.post(authUrl, {
            usuario: config.username,
            senha: config.password,
            idDispositivo: null,
            idAplicativo: 0,
        }, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000,
            validateStatus: () => true
        });
        console.log('📥 [ATAK-AUTH] Resposta recebida:', {
            status: response.status,
            statusText: response.statusText,
            hasData: !!response.data,
            dataType: typeof response.data,
            dataLength: typeof response.data === 'string' ? response.data.length : 'N/A'
        });
        if (response.status !== 200) {
            const errorMsg = `Erro HTTP ${response.status}: ${response.statusText}. Resposta: ${JSON.stringify(response.data)}`;
            console.error('❌ [ATAK-AUTH]', errorMsg);
            throw new Error(errorMsg);
        }
        const token = response.data;
        if (!token) {
            const errorMsg = `Token não encontrado na resposta. Resposta completa: ${JSON.stringify(response.data)}`;
            console.error('❌ [ATAK-AUTH]', errorMsg);
            throw new Error(errorMsg);
        }
        if (typeof token !== 'string' || token.trim().length === 0) {
            const errorMsg = `Token inválido ou vazio. Tipo: ${typeof token}, Valor: ${token}`;
            console.error('❌ [ATAK-AUTH]', errorMsg);
            throw new Error(errorMsg);
        }
        console.log('✅ [ATAK-AUTH] Autenticado com sucesso! Token obtido (tamanho:', token.length, 'caracteres)');
        console.log('💾 [ATAK-AUTH] Atualizando token no arquivo .env...');
        try {
            await updateEnvFile(token);
            console.log('✅ [ATAK-AUTH] Token atualizado com sucesso no arquivo .env');
        }
        catch (updateError) {
            console.error('⚠️ [ATAK-AUTH] Erro ao atualizar .env, mas token foi obtido:', updateError.message);
        }
        return token;
    }
    catch (error) {
        console.error('❌ [ATAK-AUTH] Erro detalhado ao autenticar no Atak:');
        if (error.response) {
            console.error('   📊 Status:', error.response.status);
            console.error('   📊 Status Text:', error.response.statusText);
            console.error('   📊 Headers:', JSON.stringify(error.response.headers, null, 2));
            console.error('   📊 Data:', JSON.stringify(error.response.data, null, 2));
            throw new Error(`Erro na autenticação do Atak (${error.response.status}): ${JSON.stringify(error.response.data)}`);
        }
        else if (error.request) {
            console.error('   🌐 Request:', {
                url: error.config?.url,
                method: error.config?.method,
                timeout: error.config?.timeout
            });
            console.error('   ⚠️ Sem resposta do servidor. Verifique se o servidor está acessível.');
            throw new Error(`Não foi possível conectar ao servidor Atak. URL: ${error.config?.url || 'N/A'}. Verifique se ATAK_BASE_URL está correto.`);
        }
        else {
            console.error('   ⚠️ Erro ao configurar requisição:', error.message);
            console.error('   📋 Stack:', error.stack);
            throw error;
        }
    }
};
exports.authenticateAtak = authenticateAtak;
async function updateEnvFile(token) {
    try {
        const envPath = node_path_1.default.resolve(process.cwd(), '.env');
        let envContent = '';
        try {
            envContent = await promises_1.default.readFile(envPath, 'utf-8');
        }
        catch (error) {
            console.log('⚠️ Arquivo .env não encontrado. Criando novo arquivo...');
        }
        const tokenRegex = /^ATAK_TOKEN=.*$/m;
        if (tokenRegex.test(envContent)) {
            envContent = envContent.replace(tokenRegex, `ATAK_TOKEN=${token}`);
        }
        else {
            envContent += `\nATAK_TOKEN=${token}`;
        }
        await promises_1.default.writeFile(envPath, envContent, 'utf-8');
    }
    catch (error) {
        console.error('❌ Erro ao atualizar o arquivo .env:', error);
        throw error;
    }
}
const getAtakToken = async () => {
    try {
        const envPath = node_path_1.default.resolve(process.cwd(), '.env');
        const envContent = await promises_1.default.readFile(envPath, 'utf-8');
        const tokenMatch = envContent.match(/^ATAK_TOKEN=(.+)$/m);
        return tokenMatch ? tokenMatch[1].trim() : null;
    }
    catch (error) {
        console.error('❌ Erro ao ler token do arquivo .env:', error);
        return null;
    }
};
exports.getAtakToken = getAtakToken;
const isTokenValid = async () => {
    const token = await (0, exports.getAtakToken)();
    return !!token && token.length > 0;
};
exports.isTokenValid = isTokenValid;
const isAtakConfigured = () => {
    if (!process.env.ATAK_USERNAME && !process.env.ATAK_PASSWORD && !process.env.ATAK_BASE_URL) {
        const fsSync = require('fs');
        const possiblePaths = [
            node_path_1.default.resolve(process.cwd(), '.env'),
            node_path_1.default.resolve(process.cwd(), 'cadastros/.env'),
            node_path_1.default.resolve(__dirname, '../../../.env'),
            node_path_1.default.resolve(__dirname, '../../../../.env'),
            node_path_1.default.resolve(__dirname, '../../.env'),
            node_path_1.default.resolve(__dirname, '../.env'),
        ];
        for (const envPath of possiblePaths) {
            try {
                if (fsSync.existsSync(envPath)) {
                    const result = dotenv_1.default.config({ path: envPath, override: true });
                    console.log('🔍 [IS-ATAK-CONFIGURED] .env carregado de:', envPath);
                    if (result.error) {
                        console.error('❌ [IS-ATAK-CONFIGURED] Erro ao carregar .env:', result.error);
                    }
                    if (process.env.ATAK_USERNAME || process.env.ATAK_PASSWORD || process.env.ATAK_BASE_URL) {
                        break;
                    }
                }
            }
            catch (err) {
            }
        }
    }
    const hasUsername = !!(process.env.ATAK_USERNAME && process.env.ATAK_USERNAME.trim().length > 0);
    const hasPassword = !!(process.env.ATAK_PASSWORD && process.env.ATAK_PASSWORD.trim().length > 0);
    const hasBaseUrl = !!(process.env.ATAK_BASE_URL && process.env.ATAK_BASE_URL.trim().length > 0);
    if (!hasUsername || !hasPassword || !hasBaseUrl) {
        console.log('🔍 [IS-ATAK-CONFIGURED] Verificação de configurações:');
        console.log('   ATAK_USERNAME:', hasUsername ? '✓' : '✗', process.env.ATAK_USERNAME ? '(configurado)' : '(não encontrado)');
        console.log('   ATAK_PASSWORD:', hasPassword ? '✓' : '✗', process.env.ATAK_PASSWORD ? '(configurado)' : '(não encontrado)');
        console.log('   ATAK_BASE_URL:', hasBaseUrl ? '✓' : '✗', process.env.ATAK_BASE_URL || '(não encontrado)');
    }
    return hasUsername && hasPassword && hasBaseUrl;
};
exports.isAtakConfigured = isAtakConfigured;
//# sourceMappingURL=atakAuth.js.map