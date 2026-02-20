/**
 * Modo "só formulário": quem entra pelo link do formulário/acompanhamento
 * fica restrito a essas telas e não pode acessar login, dashboard, etc.
 */

export const PUBLIC_FORM_ONLY_KEY = 'erp_public_form_only';
export const PUBLIC_FORM_RETURN_URL_KEY = 'erp_public_form_return_url';

const PUBLIC_PATH_PREFIXES = [
  '/descarregamento/formulario/',
  '/descarregamento/formulario-publico',
  '/descarregamento/acompanhamento/',
  '/descarregamento/restrito'
];

export function isPublicPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, '') || '/';
  return PUBLIC_PATH_PREFIXES.some(prefix => {
    const withSlash = prefix.endsWith('/') ? prefix : prefix + '/';
    return normalized === prefix || normalized.startsWith(withSlash);
  });
}

export function setPublicFormOnly(returnUrl: string): void {
  try {
    sessionStorage.setItem(PUBLIC_FORM_ONLY_KEY, '1');
    sessionStorage.setItem(PUBLIC_FORM_RETURN_URL_KEY, returnUrl);
  } catch {
    // ignore
  }
}

export function getPublicFormOnly(): boolean {
  try {
    return sessionStorage.getItem(PUBLIC_FORM_ONLY_KEY) === '1';
  } catch {
    return false;
  }
}

export function getPublicFormReturnUrl(): string | null {
  try {
    return sessionStorage.getItem(PUBLIC_FORM_RETURN_URL_KEY);
  } catch {
    return null;
  }
}

export function clearPublicFormOnly(): void {
  try {
    sessionStorage.removeItem(PUBLIC_FORM_ONLY_KEY);
    sessionStorage.removeItem(PUBLIC_FORM_RETURN_URL_KEY);
  } catch {
    // ignore
  }
}
