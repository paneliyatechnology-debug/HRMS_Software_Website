import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Hash a plain text password with bcrypt.
 * If already a bcrypt hash, returns as-is to prevent double hashing.
 */
export function hashPassword(plainText?: string): string {
  if (!plainText) return '';
  if (plainText.startsWith('$2a$') || plainText.startsWith('$2b$')) {
    return plainText;
  }
  return bcrypt.hashSync(plainText, SALT_ROUNDS);
}

/**
 * Securely compare plain text password against hashed or plain text password.
 */
export function comparePassword(plainText: string, storedPassword?: string): boolean {
  if (!plainText || !storedPassword) return false;
  if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$')) {
    return bcrypt.compareSync(plainText, storedPassword);
  }
  return plainText === storedPassword;
}
