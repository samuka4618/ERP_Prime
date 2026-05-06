import { Logger } from './logger';

describe('Logger sanitizeForLog', () => {
  it('redacts sensitive keys recursively', () => {
    const input = {
      email: 'user@company.com',
      password: '123',
      nested: {
        token: 'secret-token',
        profile: {
          cnpj: '00.000.000/0001-00',
          regular: 'ok'
        }
      }
    };

    const sanitized = Logger.sanitizeForLog(input) as any;

    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.nested.token).toBe('[REDACTED]');
    expect(sanitized.nested.profile.cnpj).toBe('[REDACTED]');
    expect(sanitized.nested.profile.regular).toBe('ok');
    expect(sanitized.email).toBe('user@company.com');
  });
});
