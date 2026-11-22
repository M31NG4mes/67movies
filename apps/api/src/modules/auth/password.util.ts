import * as crypto from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

/**
 * Hashes a plaintext password using scrypt with a unique 16-byte random salt.
 * Output format: `scrypt$<saltHex>$<derivedKeyHex>`
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

/**
 * Verifies a plaintext password against a stored scrypt hash using constant-time comparison.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash || !storedHash.startsWith('scrypt$')) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 3) return false;

  const [, salt, keyHex] = parts;
  const storedKey = Buffer.from(keyHex, 'hex');
  const derived = (await scryptAsync(password, salt, storedKey.length)) as Buffer;

  if (storedKey.length !== derived.length) return false;
  return crypto.timingSafeEqual(storedKey, derived);
}

/**
 * Generates a cryptographically strong opaque refresh token.
 */
export function generateOpaqueToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/**
 * Hashes a refresh token with SHA-256 before storing in the database.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
