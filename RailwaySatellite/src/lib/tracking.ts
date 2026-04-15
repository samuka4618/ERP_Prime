import crypto from 'crypto';

export function generateTrackingToken(): string {
  const a = crypto.randomBytes(6).toString('hex').toUpperCase();
  const b = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${a}-${b}`;
}
