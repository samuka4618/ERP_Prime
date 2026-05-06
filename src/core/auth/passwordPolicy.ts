import type { SystemConfig } from '../../shared/types';

/** Comprimento mínimo absoluto no modo simples (recomendações NIST/OWASP). */
export const WEAK_PASSWORD_ABS_MIN_LENGTH = 8;

/** Comprimento mínimo no modo forte (maiúscula, minúscula, número, especial). */
export const STRONG_PASSWORD_MIN_LENGTH = 12;

export type PasswordExpiredReason = 'admin' | 'max_age' | null;

export interface EffectivePasswordPolicy {
  password_max_age_days: number;
  requireStrong: boolean;
  /** Quando modo simples está ativo. */
  minLengthWeak: number;
}

export function resolveEffectivePasswordPolicy(cfg: Partial<SystemConfig>): EffectivePasswordPolicy {
  const rawMax = cfg.password_max_age_days ?? 0;
  const maxAge =
    typeof rawMax === 'number' && !Number.isNaN(rawMax) ? Math.max(0, Math.min(730, Math.floor(rawMax))) : 0;
  const requireStrong = cfg.password_require_strong !== false;
  const rawWeakLen = cfg.password_min_length_weak ?? WEAK_PASSWORD_ABS_MIN_LENGTH;
  const minLengthWeak =
    typeof rawWeakLen === 'number' && !Number.isNaN(rawWeakLen)
      ? Math.max(WEAK_PASSWORD_ABS_MIN_LENGTH, Math.min(128, Math.floor(rawWeakLen)))
      : WEAK_PASSWORD_ABS_MIN_LENGTH;
  return { password_max_age_days: maxAge, requireStrong, minLengthWeak };
}

export function validatePasswordAgainstPolicy(password: string, policy: EffectivePasswordPolicy): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (policy.requireStrong) {
    const minLen = Math.max(STRONG_PASSWORD_MIN_LENGTH, policy.minLengthWeak);
    if (password.length < minLen) {
      errors.push(`Senha deve ter pelo menos ${minLen} caracteres (política forte)`);
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Senha deve conter pelo menos uma letra maiúscula');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Senha deve conter pelo menos uma letra minúscula');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Senha deve conter pelo menos um número');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};:,.<>?/\\|`~]/.test(password)) {
      errors.push('Senha deve conter pelo menos um carácter especial (!@#$%…)');
    }
  } else if (password.length < policy.minLengthWeak) {
    errors.push(`Senha deve ter pelo menos ${policy.minLengthWeak} caracteres`);
  }

  return { isValid: errors.length === 0, errors };
}

export function isPasswordExpiredByPolicy(
  passwordChangedAt: Date | string | null | undefined,
  maxAgeDays: number
): boolean {
  if (maxAgeDays <= 0) return false;
  if (passwordChangedAt == null) return true;
  const changed = typeof passwordChangedAt === 'string' ? new Date(passwordChangedAt) : passwordChangedAt;
  if (Number.isNaN(changed.getTime())) return true;
  const expiresAt = changed.getTime() + maxAgeDays * 86400000;
  return Date.now() > expiresAt;
}

export function computePasswordChangeRequirement(
  user: {
    must_change_password?: boolean | null;
    password_changed_at?: Date | string | null;
  },
  systemConfig: Partial<SystemConfig>
): { requiresPasswordChange: boolean; passwordExpiredReason: PasswordExpiredReason } {
  const policy = resolveEffectivePasswordPolicy(systemConfig);
  if (user.must_change_password) {
    return { requiresPasswordChange: true, passwordExpiredReason: 'admin' };
  }
  if (isPasswordExpiredByPolicy(user.password_changed_at ?? undefined, policy.password_max_age_days)) {
    return { requiresPasswordChange: true, passwordExpiredReason: 'max_age' };
  }
  return { requiresPasswordChange: false, passwordExpiredReason: null };
}
