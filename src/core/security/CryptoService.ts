import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 16;

function getKeyBuffer(): Buffer {
  const hex = process.env.SUBSCRIPTION_ENCRYPTION_KEY;
  if (!hex || typeof hex !== 'string' || hex.length !== 64) {
    throw new Error(
      'SUBSCRIPTION_ENCRYPTION_KEY ausente ou inválida. Defina 64 caracteres hex (32 bytes). Ex.: openssl rand -hex 32'
    );
  }
  try {
    return Buffer.from(hex, 'hex');
  } catch {
    throw new Error('SUBSCRIPTION_ENCRYPTION_KEY deve ser uma string hexadecimal válida');
  }
}

/** Valida chave no startup — obrigatória para criptografar credenciais de assinaturas. */
export function assertSubscriptionEncryptionKeyConfigured(): void {
  const k = getKeyBuffer();
  if (k.length !== 32) {
    throw new Error('SUBSCRIPTION_ENCRYPTION_KEY deve decodificar para exatamente 32 bytes');
  }
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export const CryptoService = {
  encrypt(plain: string): EncryptedPayload {
    const key = getKeyBuffer();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      ciphertext: enc.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64')
    };
  },

  decrypt(payload: EncryptedPayload): string {
    const key = getKeyBuffer();
    const iv = Buffer.from(payload.iv, 'base64');
    const authTag = Buffer.from(payload.authTag, 'base64');
    const ciphertext = Buffer.from(payload.ciphertext, 'base64');
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(authTag);
    const dec = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return dec.toString('utf8');
  }
};
