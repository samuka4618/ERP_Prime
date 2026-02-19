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
dotenv_1.default.config();
const authenticateAtak = async () => {
    try {
        const config = {
            username: process.env.ATAK_USERNAME || '',
            password: process.env.ATAK_PASSWORD || '',
            baseUrl: process.env.ATAK_BASE_URL || ''
        };
        if (!config.username || !config.password || !config.baseUrl) {
            throw new Error('Configurações do Atak não encontradas. Verifique ATAK_USERNAME, ATAK_PASSWORD e ATAK_BASE_URL no arquivo .env');
        }
        console.log('🔐 Autenticando no sistema Atak...');
        const response = await axios_1.default.post(`${config.baseUrl}/auth-integracao.axd`, {
            usuario: config.username,
            senha: config.password,
            idDispositivo: null,
            idAplicativo: 0,
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        const token = response.data;
        if (!token) {
            throw new Error('Token não encontrado na resposta');
        }
        console.log('✅ Autenticado com sucesso! Token obtido.');
        console.log('💾 Atualizando token no arquivo .env...');
        await updateEnvFile(token);
        console.log('✅ Token atualizado com sucesso no arquivo .env');
        return token;
    }
    catch (error) {
        console.error('❌ Erro ao autenticar no Atak:', error.response?.data || error.message);
        throw error;
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
/**
 * Verifica se as configurações do Atak estão disponíveis
 */
const isAtakConfigured = () => {
    // Tentar carregar .env se as variáveis não estiverem disponíveis
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
                    // Verificar se as variáveis foram carregadas após o dotenv.config
                    if (process.env.ATAK_USERNAME || process.env.ATAK_PASSWORD || process.env.ATAK_BASE_URL) {
                        break; // Se encontrou alguma variável, parar
                    }
                }
            }
            catch (err) {
                // Continuar tentando
            }
        }
    }
    const hasUsername = !!(process.env.ATAK_USERNAME && process.env.ATAK_USERNAME.trim().length > 0);
    const hasPassword = !!(process.env.ATAK_PASSWORD && process.env.ATAK_PASSWORD.trim().length > 0);
    const hasBaseUrl = !!(process.env.ATAK_BASE_URL && process.env.ATAK_BASE_URL.trim().length > 0);
    // Debug: mostrar o que foi encontrado
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