/**
 * URL base da API para deploy com front e backend separados (ex.: Vercel + Render).
 * Use VITE_API_URL no .env do frontend (ex.: https://seu-backend.onrender.com).
 * Se não definido, mantém comportamento local: /api em localhost ou hostname:port em rede.
 */

function getApiOrigin(): string {
  const fromEnv = import.meta.env.VITE_API_URL as string | undefined;
  if (fromEnv && fromEnv.trim()) {
    let url = fromEnv.trim().replace(/\/+$/, '');
    // Se não tiver protocolo, o axios trata como path relativo (ex.: request vai para a Vercel)
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
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
 * Em localhost, usa sempre a origem do backend (ex.: http://localhost:3004) para evitar
 * que as requisições caiam no servidor do frontend (Vite) e retornem HTML em vez de JSON.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const fromEnv = import.meta.env.VITE_API_URL as string | undefined;
    // Aviso quando em produção/rede e VITE_API_URL não definida (requisições podem ir para o front e retornar HTML)
    if (!fromEnv?.trim() && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      const origin = getApiOrigin();
      const currentOrigin = window.location.origin;
      if (origin !== currentOrigin) {
        console.warn(
          '[ERP Prime] VITE_API_URL não está definida. As requisições estão indo para o mesmo servidor do frontend (respostas em HTML). Defina VITE_API_URL com a URL da API no build (ex.: no Railway, variável de ambiente VITE_API_URL=https://api.seudominio.com) e faça um novo deploy.'
        );
      }
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
