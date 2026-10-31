/**
 * Normalizes an email address by removing leading/trailing whitespace
 * and converting all characters to lowercase.
 * Ensures case-insensitive global uniqueness across all roles.
 */
export function normalizeEmail(email?: string): string {
  if (!email || typeof email !== 'string') {
    return '';
  }
  return email.trim().toLowerCase();
}

/**
 * Standard enterprise conflict message for duplicate email registrations.
 */
export const EMAIL_ALREADY_REGISTERED_MESSAGE =
  'This email address is already registered. Please use another email.';

