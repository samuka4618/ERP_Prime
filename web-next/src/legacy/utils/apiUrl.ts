/**
 * URL base da API (mesmo domínio com Express ou backend separado).
 * Variáveis Next: NEXT_PUBLIC_API_URL (origem do backend, ex. https://api.exemplo.com),
 * NEXT_PUBLIC_BACKEND_ORIGIN (ex. http://127.0.0.1:3000 quando `next dev` corre noutra porta).
 * Sem variáveis: em browser usa-se o mesmo origin e base `/api` (monólito ERP_UI=next no Express).
 */

function normalizeOrigin(raw: string): string {
  let url = raw.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

function explicitBackendOrigin(): string | null {
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || '').trim();
  if (apiUrl) {
    return normalizeOrigin(apiUrl);
  }
  const backend = (process.env.NEXT_PUBLIC_BACKEND_ORIGIN || '').trim();
  if (backend) {
    return normalizeOrigin(backend);
  }
  return null;
}

function getApiOrigin(): string {
  const explicit = explicitBackendOrigin();
  if (explicit) {
    return explicit;
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:3000';
}

/**
 * URL base para axios (inclui /api).
 */
export function getApiBaseUrl(): string {
  const explicit = explicitBackendOrigin();
  if (explicit) {
    return `${explicit}/api`;
  }
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const hasPublicApi = !!(process.env.NEXT_PUBLIC_API_URL || '').trim();
    if (!hasPublicApi && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      console.warn(
        '[ERP Prime] NEXT_PUBLIC_API_URL / NEXT_PUBLIC_BACKEND_ORIGIN não definidos; a API é assumida no mesmo host (path /api). Em front separado da API, defina NEXT_PUBLIC_API_URL.'
      );
    }
  }
  return '/api';
}

/**
 * Origem do backend (sem path). SSE, WebSocket, health.
 */
export function getApiOriginUrl(): string {
  return getApiOrigin();
}

/**
 * URL do WebSocket (ws ou wss conforme origem).
 */
export function getWsUrl(): string {
  const origin = getApiOrigin();
  return origin.replace(/^http/, 'ws');
}

/**
 * Monta a URL completa para um path da API.
 */
export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const p = path.startsWith('/') ? path.slice(1) : path;
  if (base.startsWith('/')) {
    return `${base.replace(/\/+$/, '')}/${p}`;
  }
  return base.endsWith('/') ? `${base}${p}` : `${base}/${p}`;
}
