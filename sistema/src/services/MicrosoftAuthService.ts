/**
 * Serviço de autenticação e integração com Microsoft Entra ID (Azure AD).
 * - Geração de URL de autorização e troca de code por tokens (login usuário).
 * - Listagem de usuários do tenant via Microsoft Graph (client credentials).
 * Segurança: state CSRF, validação iss/aud, credenciais apenas em .env.
 */

import { ConfidentialClientApplication } from '@azure/msal-node';
import { config } from '../config/database';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const SCOPES_LOGIN = ['openid', 'profile', 'email', 'User.Read'];
const SCOPES_GRAPH = ['https://graph.microsoft.com/.default'];
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutos

/** Perfil do usuário retornado após login Microsoft (ID token + Graph /me). */
export interface MicrosoftProfile {
  sub: string;           // id no Entra (microsoft_id)
  email: string;
  name: string;
  jobTitle?: string | null;
  avatarUrl?: string | null; // nossa URL de avatar (proxy) ou null
}

/** Usuário listado do Entra ID para o admin importar. */
export interface EntraUserListItem {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  jobTitle: string | null;
  alreadyImported: boolean;
}

/** Cache em memória para state OAuth (CSRF). */
const stateStore = new Map<string, { createdAt: number }>();

function getMsalConfidentialClient(): ConfidentialClientApplication {
  const { clientId, tenantId, clientSecret } = config.microsoft;
  const authority = `https://login.microsoftonline.com/${tenantId}`;
  return new ConfidentialClientApplication({
    auth: {
      clientId,
      authority,
      clientSecret
    }
  });
}

/**
 * Gera state aleatório e guarda no cache. Retorna o state para enviar na URL.
 */
export function createAndStoreState(): string {
  const state = crypto.randomBytes(24).toString('base64url');
  stateStore.set(state, { createdAt: Date.now() });
  // Limpar states expirados
  for (const [k, v] of stateStore.entries()) {
    if (Date.now() - v.createdAt > STATE_TTL_MS) stateStore.delete(k);
  }
  return state;
}

/**
 * Valida o state e remove do cache (one-time use).
 */
export function consumeState(state: string): boolean {
  const entry = stateStore.get(state);
  if (!entry) return false;
  if (Date.now() - entry.createdAt > STATE_TTL_MS) {
    stateStore.delete(state);
    return false;
  }
  stateStore.delete(state);
  return true;
}

/**
 * Retorna a URL para o usuário ser redirecionado ao login Microsoft.
 */
export async function getAuthorizationUrl(state: string): Promise<string> {
  const { clientId, tenantId, redirectUri } = config.microsoft;
  if (!redirectUri) {
    throw new Error('AZURE_REDIRECT_URI não configurado');
  }

  const client = getMsalConfidentialClient();
  const url = await client.getAuthCodeUrl({
    scopes: SCOPES_LOGIN,
    redirectUri,
    state,
    responseMode: 'query',
    prompt: 'select_account'
  });
  if (!url) {
    throw new Error('Falha ao gerar URL de autorização Microsoft.');
  }
  return url;
}

/**
 * Troca o authorization code por tokens e obtém o perfil (Graph /me).
 * Valida state antes de chamar a Microsoft.
 */
export async function handleCallback(
  code: string,
  state: string,
  redirectUri: string
): Promise<MicrosoftProfile> {
  if (!consumeState(state)) {
    logger.warn('State OAuth inválido ou expirado', { state: state?.substring(0, 8) }, 'MICROSOFT_AUTH');
    throw new Error('State inválido ou expirado. Tente novamente.');
  }

  const client = getMsalConfidentialClient();
  let result;
  try {
    result = await client.acquireTokenByCode({
      code,
      scopes: SCOPES_LOGIN,
      redirectUri
    });
  } catch (err) {
    logger.error('Erro ao trocar code por token Microsoft', {
      error: err instanceof Error ? err.message : 'Unknown'
    }, 'MICROSOFT_AUTH');
    throw new Error('Falha ao autenticar com a Microsoft.');
  }

  const idToken = result.idTokenClaims as Record<string, any> | undefined;
  const sub = idToken?.sub ?? (result.account?.homeAccountId?.split('.')[0]);
  const name = idToken?.name ?? result.account?.name ?? '';
  const email = idToken?.preferred_username ?? idToken?.email ?? result.account?.username ?? '';

  if (!sub || !email) {
    logger.warn('Perfil Microsoft sem sub ou email', { sub, email }, 'MICROSOFT_AUTH');
    throw new Error('Perfil Microsoft incompleto.');
  }

  // Validar issuer e audience (tenant)
  const iss = idToken?.iss;
  const aud = idToken?.aud;
  const expectedIss = `https://login.microsoftonline.com/${config.microsoft.tenantId}/v2.0`;
  if (iss && iss !== expectedIss) {
    logger.warn('Token de outro tenant', { iss, expectedIss }, 'MICROSOFT_AUTH');
    throw new Error('Token de tenant não autorizado.');
  }
  if (aud && aud !== config.microsoft.clientId) {
    logger.warn('Token para outro client', { aud, clientId: config.microsoft.clientId }, 'MICROSOFT_AUTH');
    throw new Error('Token inválido para esta aplicação.');
  }

  // Obter jobTitle (e opcionalmente foto) do Graph
  let jobTitle: string | null = null;
  const accessToken = result.accessToken;
  if (accessToken) {
    try {
      const res = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName,jobTitle', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (res.ok) {
        const me = (await res.json()) as { jobTitle?: string };
        jobTitle = me.jobTitle ?? null;
      }
    } catch (e) {
      logger.debug('Graph /me falhou (opcional)', { error: e instanceof Error ? e.message : '' }, 'MICROSOFT_AUTH');
    }
  }

  return {
    sub,
    email: email.trim(),
    name: (name || email).trim(),
    jobTitle: jobTitle ?? null,
    avatarUrl: null // preenchido pelo backend com nossa URL de avatar (proxy) se necessário
  };
}

/**
 * Obtém token via client credentials para chamadas à Graph (listar usuários).
 */
async function getGraphClientCredentialsToken(): Promise<string> {
  const client = getMsalConfidentialClient();
  const result = await client.acquireTokenByClientCredential({ scopes: SCOPES_GRAPH });
  if (!result?.accessToken) {
    throw new Error('Não foi possível obter token para Microsoft Graph.');
  }
  return result.accessToken;
}

/**
 * Lista usuários do tenant Entra ID (para admin importar).
 * Requer permissão de aplicação User.Read.All e consentimento admin.
 */
export async function listUsersFromEntra(
  search?: string,
  page: number = 1,
  limit: number = 50
): Promise<{ users: EntraUserListItem[]; nextLink?: string }> {
  const token = await getGraphClientCredentialsToken();
  const skip = (page - 1) * limit;
  const top = Math.min(limit, 999);
  const select = 'id,displayName,mail,userPrincipalName,jobTitle';
  let url = `https://graph.microsoft.com/v1.0/users?$select=${select}&$top=${top}&$orderby=displayName`;
  if (skip > 0) {
    url += `&$skip=${skip}`;
  }
  if (search && search.trim()) {
    const safe = search.trim().replace(/'/g, "''").substring(0, 100);
    const filter = `startswith(displayName,'${safe}') or startswith(mail,'${safe}') or startswith(userPrincipalName,'${safe}')`;
    url += `&$filter=${encodeURIComponent(filter)}`;
  }

  interface GraphUser {
    id: string;
    displayName?: string;
    mail?: string;
    userPrincipalName?: string;
    jobTitle?: string;
  }
  interface GraphUsersResponse {
    value?: GraphUser[];
    '@odata.nextLink'?: string;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!res.ok) {
    const text = await res.text();
    logger.error('Graph list users falhou', { status: res.status, contentType, bodyPreview: text.slice(0, 200) }, 'MICROSOFT_AUTH');
    if (!isJson || text.trim().toLowerCase().startsWith('<!')) {
      throw new Error(
        'A Microsoft retornou uma página em vez de dados. Verifique no Portal Azure: permissão de aplicação "User.Read.All" ou "Directory.Read.All", consentimento admin e credenciais (AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID).'
      );
    }
    try {
      const errBody = JSON.parse(text) as { error?: { message?: string } };
      const msg = errBody?.error?.message || text.slice(0, 200);
      throw new Error(`Entra ID: ${msg}`);
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('Entra ID:')) throw e;
      throw new Error('Não foi possível listar usuários do Entra ID. Verifique permissão User.Read.All e consentimento admin.');
    }
  }

  const bodyText = await res.text();
  let data: GraphUsersResponse;
  try {
    if (!isJson || bodyText.trim().toLowerCase().startsWith('<!')) {
      throw new Error('Resposta não é JSON');
    }
    data = JSON.parse(bodyText) as GraphUsersResponse;
  } catch {
    logger.error('Graph list users: resposta não é JSON', { contentType, bodyPreview: bodyText.slice(0, 200) }, 'MICROSOFT_AUTH');
    throw new Error(
      'A Microsoft retornou uma página em vez de dados. Confira no Azure: permissões de aplicação User.Read.All ou Directory.Read.All e consentimento admin.'
    );
  }

  const rawUsers = data.value || [];

  const users: EntraUserListItem[] = rawUsers.map((u) => ({
    id: u.id,
    displayName: u.displayName ?? '',
    mail: u.mail ?? null,
    userPrincipalName: u.userPrincipalName ?? '',
    jobTitle: u.jobTitle ?? null,
    alreadyImported: false
  }));

  return {
    users,
    nextLink: data['@odata.nextLink'] as string | undefined
  };
}

/**
 * Marca quais usuários da lista já estão importados no sistema (por microsoft_id).
 */
export async function markAlreadyImported(
  users: EntraUserListItem[],
  importedMicrosoftIds: Set<string>
): Promise<void> {
  users.forEach((u) => {
    u.alreadyImported = importedMicrosoftIds.has(u.id);
  });
}

/**
 * Busca a foto do usuário no Graph (binary). Retorna { contentType, body } ou null se não houver foto.
 */
export async function fetchUserPhotoFromGraph(microsoftId: string): Promise<{ contentType: string; body: Buffer } | null> {
  const token = await getGraphClientCredentialsToken();
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${microsoftId}/photo/$value`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await res.arrayBuffer();
  return { contentType, body: Buffer.from(arrayBuffer) };
}
