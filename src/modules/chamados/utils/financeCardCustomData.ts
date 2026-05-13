/** Chaves esperadas pela assinatura digital; também tentamos sinónimos frequentes nos dados já guardados. */
const PLATFORM_KEYS = ['plataforma', 'servico', 'serviço', 'platform', 'nome_servico', 'servico_online'];
const LOGIN_KEYS = ['login_plataforma', 'usuario_plataforma', 'email_na_plataforma', 'usuario_login', 'login'];
const PASSWORD_KEYS = ['senha_plataforma', 'senha_servico', 'credential_password'];

function pickString(cd: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(cd, k)) continue;
    const v = cd[k];
    const s = v == null ? '' : String(v).trim();
    if (s !== '') return s;
  }
  return '';
}

export function extractFinanceCardCredentials(cd: Record<string, unknown> | undefined | null): {
  platform: string;
  login_username: string;
  password: string;
} | null {
  if (!cd || typeof cd !== 'object' || Array.isArray(cd)) return null;
  const platform = pickString(cd, PLATFORM_KEYS);
  const login_username = pickString(cd, LOGIN_KEYS);
  const password = pickString(cd, PASSWORD_KEYS);
  if (!platform || !login_username || !password) return null;
  return { platform, login_username, password };
}
