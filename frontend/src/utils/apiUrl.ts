/**
 * URL base da API para deploy com front e backend separados (ex.: Vercel + Render).
 * Use VITE_API_URL no .env do frontend (ex.: https://seu-backend.onrender.com).
 * Se não definido, mantém comportamento local: /api em localhost ou hostname:port em rede.
 */

function getApiOrigin(): string {
  const fromEnv = import.meta.env.VITE_API_URL as string | undefined;
  if (fromEnv && fromEnv.trim()) {
    const url = fromEnv.trim().replace(/\/+$/, '');
    try {
      return new URL(url).origin;
    } catch {
      return url;
    }
  }
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const backendPort = (import.meta.env.VITE_BACKEND_PORT as string) || '3004';
    return `${protocol}//localhost:${backendPort}`;
  }
  const port = typeof window !== 'undefined' ? (window.location.port || '3004') : '3004';
  return `${protocol}//${hostname}:${port}`;
}

/**
 * URL base para chamadas à API (axios baseURL). Inclui /api.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const fromEnv = import.meta.env.VITE_API_URL as string | undefined;
    if (!fromEnv?.trim() && (hostname === 'localhost' || hostname === '127.0.0.1')) {
      return '/api';
    }
  }
  return `${getApiOrigin()}/api`;
}

/**
 * Origem do backend (sem path). Usado para SSE, WebSocket e health.
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
 * Monta a URL completa para um path da API (ex.: '/tickets', '/system/backup').
 * Use em fetch() quando não estiver usando apiService.
 */
export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const p = path.startsWith('/') ? path.slice(1) : path;
  return base.endsWith('/') ? `${base}${p}` : `${base}/${p}`;
}
