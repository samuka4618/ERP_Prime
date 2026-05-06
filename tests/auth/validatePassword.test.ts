import {
  resolveEffectivePasswordPolicy,
  validatePasswordAgainstPolicy,
} from '../../src/core/auth/passwordPolicy';

describe('passwordPolicy (políticas de senha)', () => {
  const strongLike = resolveEffectivePasswordPolicy({
    password_require_strong: true,
    password_min_length_weak: 8,
    password_max_age_days: 0,
  });

  it('política forte: aceita senha com todos os critérios', () => {
    const result = validatePasswordAgainstPolicy('Aa1!Aa1!Aa1!', strongLike);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('política forte: rejeita sem maiúscula', () => {
    const result = validatePasswordAgainstPolicy('a1!a1!a1!a1!a!', strongLike);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('maiúscula'))).toBe(true);
  });

  it('política forte: rejeita sem carácter especial', () => {
    const result = validatePasswordAgainstPolicy('Aa1Aa1Aa1Aa1a', strongLike);
    expect(result.isValid).toBe(false);
  });

  it('política simples: só comprimento mínimo configurável', () => {
    const weak = resolveEffectivePasswordPolicy({
      password_require_strong: false,
      password_min_length_weak: 8,
      password_max_age_days: 0,
    });
    expect(validatePasswordAgainstPolicy('12345678', weak).isValid).toBe(true);
    expect(validatePasswordAgainstPolicy('1234567', weak).isValid).toBe(false);
  });
});
