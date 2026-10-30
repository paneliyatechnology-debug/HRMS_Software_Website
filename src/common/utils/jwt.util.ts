import { createHmac, timingSafeEqual } from 'crypto';

const SECRET = process.env.JWT_SECRET || 'hrms-dev-jwt-secret-change-me';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

function toBase64Url(value: string): string {
  return Buffer.from(value).toString('base64url');
}

export function signAccessToken(userId: string): string {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = toBase64Url(
    JSON.stringify({ sub: userId, iat: now, exp: now + TOKEN_TTL_SECONDS }),
  );
  const data = `${header}.${payload}`;
  const signature = createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

export function verifyAccessToken(token: string): { sub: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const data = `${parts[0]}.${parts[1]}`;
  const expected = createHmac('sha256', SECRET).update(data).digest('base64url');
  const actualBuf = Buffer.from(parts[2]);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!payload?.sub || typeof payload.sub !== 'string') return null;
    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return { sub: payload.sub };
  } catch {
    return null;
  }
}
