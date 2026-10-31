/**
 * Normalizes a phone/mobile number by trimming leading and trailing whitespace.
 */
export function normalizePhone(phone?: string | null): string {
  if (!phone || typeof phone !== 'string') {
    return '';
  }
  return phone.trim().replace(/\s+/g, ' ');
}

/**
 * Extracts comparable core digits from a phone number.
 * For standard 10-digit mobile numbers (with or without country code +91 / +1 / 0 prefix),
 * extracts the last 10 digits for accurate equivalence matching.
 */
export function extractComparablePhoneDigits(phone?: string | null): string {
  if (!phone || typeof phone !== 'string') {
    return '';
  }
  const digits = phone.replace(/\D/g, '');
  if (!digits) {
    return '';
  }
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

/**
 * Checks if two phone numbers are equivalent.
 * Returns true if both are non-empty and match in cleaned digits or exact representation.
 */
export function arePhoneNumbersEqual(p1?: string | null, p2?: string | null): boolean {
  if (!p1 || !p2 || typeof p1 !== 'string' || typeof p2 !== 'string') {
    return false;
  }
  const clean1 = p1.trim().replace(/[\s\-\(\)\.]/g, '');
  const clean2 = p2.trim().replace(/[\s\-\(\)\.]/g, '');
  if (!clean1 || !clean2) {
    return false;
  }
  if (clean1.toLowerCase() === clean2.toLowerCase()) {
    return true;
  }
  const d1 = extractComparablePhoneDigits(p1);
  const d2 = extractComparablePhoneDigits(p2);
  if (d1 && d2 && d1 === d2) {
    return true;
  }
  return false;
}

/**
 * Standard enterprise conflict message for duplicate phone/mobile number registrations.
 */
export const PHONE_ALREADY_REGISTERED_MESSAGE =
  'This phone/mobile number is already registered. Please use another phone number.';
