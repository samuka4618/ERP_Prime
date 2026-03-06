import { AuthService } from '../../src/core/auth/AuthService';

describe('AuthService.validatePassword', () => {
  it('deve aceitar senha válida', () => {
    const result = AuthService.validatePassword('Senha123');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('deve rejeitar senha sem maiúscula', () => {
    const result = AuthService.validatePassword('senha123');
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('maiúscula'))).toBe(true);
  });

  it('deve rejeitar senha curta', () => {
    const result = AuthService.validatePassword('Ab1');
    expect(result.isValid).toBe(false);
  });
});
