import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ENCRYPTION_PREFIX = 'enc:v1:';

function getKey() {
  const keySource = process.env.CERT_ENCRYPTION_KEY;
  if (!keySource) throw new Error('CERT_ENCRYPTION_KEY is required');
  return createHash('sha256').update(keySource).digest();
}

export function encryptAtRest(value) {
  if (!value) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTION_PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptAtRest(value) {
  if (!value || typeof value !== 'string' || !value.startsWith(ENCRYPTION_PREFIX)) return value;
  const payload = value.slice(ENCRYPTION_PREFIX.length).split(':');
  if (payload.length !== 3) throw new Error('Invalid encrypted payload');
  const [ivB64, tagB64, encryptedB64] = payload;
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedB64, 'base64url')), decipher.final()]);
  return decrypted.toString('utf8');
}
