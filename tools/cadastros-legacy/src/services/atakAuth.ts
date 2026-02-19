import axios from 'axios';
import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';

// O dotenv.config() já deve ter sido chamado no backend principal
// Mas vamos garantir que está carregado se ainda não foi
if (!process.env.ATAK_USERNAME && !process.env.ATAK_PASSWORD && !process.env.ATAK_BASE_URL) {
  // Tentar carregar se as variáveis não estão disponíveis
  const fsSync = require('fs');
  const possiblePaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../../.env'),
    path.resolve(__dirname, '../../../../.env'),
  ];

  for (const envPath of possiblePaths) {
    try {
      if (fsSync.existsSync(envPath)) {
        dotenv.config({ path: envPath, override: false });
        console.log('✅ [ATAK-AUTH] .env carregado de:', envPath);
        break;
      }
    } catch (err) {
      // Continuar tentando
    }
  }
}

export interface AtakAuthConfig {
  username: string;
  password: string;
  baseUrl: string;
}

/**
 * Autentica no sistema Atak e salva o token no arquivo .env
 */
export const authenticateAtak = async (): Promise<string | null> => {
  try {
    // Debug: verificar variáveis de ambiente
    console.log('🔍 [ATAK-AUTH] Verificando variáveis de ambiente...');
    console.log('   ATAK_USERNAME existe?', !!process.env.ATAK_USERNAME);
    console.log('   ATAK_PASSWORD existe?', !!process.env.ATAK_PASSWORD);
    console.log('   ATAK_BASE_URL existe?', !!process.env.ATAK_BASE_URL);
    console.log('   ATAK_BASE_URL valor:', process.env.ATAK_BASE_URL || '(vazio)');
    console.log('   CWD:', process.cwd());
    console.log('   __dirname:', __dirname);
    
    const config: AtakAuthConfig = {
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
      if (!config.username) missing.push('ATAK_USERNAME');
      if (!config.password) missing.push('ATAK_PASSWORD');
      if (!config.baseUrl) missing.push('ATAK_BASE_URL');
      const errorMsg = `Configurações do Atak não encontradas. Verifique as seguintes variáveis no arquivo .env: ${missing.join(', ')}`;
      console.error('❌ [ATAK-AUTH]', errorMsg);
      throw new Error(errorMsg);
    }

    const authUrl = `${config.baseUrl}/auth-integracao.axd`;
    console.log('🌐 [ATAK-AUTH] URL de autenticação:', authUrl);
    console.log('📤 [ATAK-AUTH] Enviando requisição...');

    const response = await axios.post(
      authUrl,
      {
        usuario: config.username,
        senha: config.password,
        idDispositivo: null,
        idAplicativo: 0,
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000, // 30 segundos
        validateStatus: () => true // Aceitar qualquer status para capturar a resposta
      }
    );

    console.log('📥 [ATAK-AUTH] Resposta recebida:', {
      status: response.status,
      statusText: response.statusText,
      hasData: !!response.data,
      dataType: typeof response.data,
      dataLength: typeof response.data === 'string' ? response.data.length : 'N/A'
    });

    // Verificar se houve erro HTTP (Atak pode retornar 200 OK ou 201 Created com o token)
    if (response.status !== 200 && response.status !== 201) {
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
    } catch (updateError: any) {
      console.error('⚠️ [ATAK-AUTH] Erro ao atualizar .env, mas token foi obtido:', updateError.message);
      // Não falhar se o token foi obtido, apenas logar o aviso
    }
    
    return token;

  } catch (error: any) {
    console.error('❌ [ATAK-AUTH] Erro detalhado ao autenticar no Atak:');
    
    if (error.response) {
      // Erro da resposta do servidor
      console.error('   📊 Status:', error.response.status);
      console.error('   📊 Status Text:', error.response.statusText);
      console.error('   📊 Headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('   📊 Data:', JSON.stringify(error.response.data, null, 2));
      throw new Error(`Erro na autenticação do Atak (${error.response.status}): ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      // Requisição foi feita mas não houve resposta
      console.error('   🌐 Request:', {
        url: error.config?.url,
        method: error.config?.method,
        timeout: error.config?.timeout
      });
      console.error('   ⚠️ Sem resposta do servidor. Verifique se o servidor está acessível.');
      throw new Error(`Não foi possível conectar ao servidor Atak. URL: ${error.config?.url || 'N/A'}. Verifique se ATAK_BASE_URL está correto.`);
    } else {
      // Erro ao configurar a requisição
      console.error('   ⚠️ Erro ao configurar requisição:', error.message);
      console.error('   📋 Stack:', error.stack);
      throw error;
    }
  }
};

/**
 * Atualiza o token no arquivo .env
 */
async function updateEnvFile(token: string): Promise<void> {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    let envContent = '';

    try {
      envContent = await fs.readFile(envPath, 'utf-8');
    } catch (error) {
      console.log('⚠️ Arquivo .env não encontrado. Criando novo arquivo...');
    }

    const tokenRegex = /^ATAK_TOKEN=.*$/m;
    if (tokenRegex.test(envContent)) {
      envContent = envContent.replace(tokenRegex, `ATAK_TOKEN=${token}`);
    } else {
      envContent += `\nATAK_TOKEN=${token}`;
    }

    await fs.writeFile(envPath, envContent, 'utf-8');
    
  } catch (error) {
    console.error('❌ Erro ao atualizar o arquivo .env:', error);
    throw error;
  }
}

/**
 * Obtém o token do arquivo .env
 */
export const getAtakToken = async (): Promise<string | null> => {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    const envContent = await fs.readFile(envPath, 'utf-8');
    
    const tokenMatch = envContent.match(/^ATAK_TOKEN=(.+)$/m);
    return tokenMatch ? tokenMatch[1].trim() : null;
    
  } catch (error) {
    console.error('❌ Erro ao ler token do arquivo .env:', error);
    return null;
  }
};

/**
 * Verifica se o token existe e é válido
 */
export const isTokenValid = async (): Promise<boolean> => {
  const token = await getAtakToken();
  return !!token && token.length > 0;
};

/**
 * Verifica se as configurações do Atak estão disponíveis.
 * Considera configurado se:
 * - (ATAK_USERNAME + ATAK_PASSWORD + ATAK_BASE_URL) para login, ou
 * - (ATAK_TOKEN + ATAK_BASE_URL) para uso com token fixo.
 */
export const isAtakConfigured = (): boolean => {
  // Tentar carregar .env se as variáveis não estiverem disponíveis
  if (!process.env.ATAK_USERNAME && !process.env.ATAK_PASSWORD && !process.env.ATAK_BASE_URL && !process.env.ATAK_TOKEN) {
    const fsSync = require('fs');
    const possiblePaths = [
      path.resolve(process.cwd(), '.env'),
      path.resolve(process.cwd(), 'cadastros/.env'),
      path.resolve(__dirname, '../../../.env'),
      path.resolve(__dirname, '../../../../.env'),
      path.resolve(__dirname, '../../.env'),
      path.resolve(__dirname, '../.env'),
    ];

    for (const envPath of possiblePaths) {
      try {
        if (fsSync.existsSync(envPath)) {
          const result = dotenv.config({ path: envPath, override: true });
          console.log('🔍 [IS-ATAK-CONFIGURED] .env carregado de:', envPath);
          if (result.error) {
            console.error('❌ [IS-ATAK-CONFIGURED] Erro ao carregar .env:', result.error);
          }
          if (process.env.ATAK_USERNAME || process.env.ATAK_PASSWORD || process.env.ATAK_BASE_URL || process.env.ATAK_TOKEN) {
            break;
          }
        }
      } catch (err) {
        // Continuar tentando
      }
    }
  }

  const hasUsername = !!(process.env.ATAK_USERNAME && process.env.ATAK_USERNAME.trim().length > 0);
  const hasPassword = !!(process.env.ATAK_PASSWORD && process.env.ATAK_PASSWORD.trim().length > 0);
  const hasBaseUrl = !!(process.env.ATAK_BASE_URL && process.env.ATAK_BASE_URL.trim().length > 0);
  const hasToken = !!(process.env.ATAK_TOKEN && process.env.ATAK_TOKEN.trim().length > 0);

  const configuredByLogin = hasUsername && hasPassword && hasBaseUrl;
  const configuredByToken = hasToken && hasBaseUrl;

  if (!configuredByLogin && !configuredByToken) {
    console.log('🔍 [IS-ATAK-CONFIGURED] Verificação de configurações:');
    console.log('   ATAK_USERNAME:', hasUsername ? '✓' : '✗', hasUsername ? '(configurado)' : '(não encontrado)');
    console.log('   ATAK_PASSWORD:', hasPassword ? '✓' : '✗', hasPassword ? '(configurado)' : '(não encontrado)');
    console.log('   ATAK_BASE_URL:', hasBaseUrl ? '✓' : '✗', process.env.ATAK_BASE_URL || '(não encontrado)');
    console.log('   ATAK_TOKEN:', hasToken ? '✓' : '✗', hasToken ? '(configurado)' : '(não encontrado)');
  }

  return configuredByLogin || configuredByToken;
};

