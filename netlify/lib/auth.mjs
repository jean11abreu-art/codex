import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { PublicError } from './http.mjs';

const COOKIE = '__Host-pf_session';
const TTL = 8 * 60 * 60;
export function configured(env = process.env) {
  return typeof env.DASHBOARD_PASSWORD === 'string' && env.DASHBOARD_PASSWORD.length >= 20
    && env.DASHBOARD_PASSWORD.length <= 256 && Boolean(env.MAXIPROD_API_KEY);
}
function key(env) {
  if (!configured(env)) throw new PublicError(503, 'SETUP_REQUIRED', 'Configure DASHBOARD_PASSWORD com pelo menos 20 caracteres no Netlify e publique novamente.');
  // Domain separation: rotating either server secret invalidates every existing session.
  return createHmac('sha256', env.MAXIPROD_API_KEY).update('premium-flex-session-v1\0' + env.DASHBOARD_PASSWORD).digest();
}
function equal(a, b) {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function passwordMatches(value, env = process.env) {
  const signingKey = key(env);
  const digest = text => createHmac('sha256', signingKey).update(text).digest();
  return typeof value === 'string' && value.length <= 256 && equal(digest(value), digest(env.DASHBOARD_PASSWORD));
}
export function sessionCookie(env = process.env, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ expires: Math.floor(now / 1000) + TTL, nonce: randomBytes(24).toString('base64url') })).toString('base64url');
  const signature = createHmac('sha256', key(env)).update(payload).digest('base64url');
  return `${COOKIE}=${payload}.${signature}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${TTL}`;
}
export function clearCookie() { return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`; }
export function authenticated(request, env = process.env, now = Date.now()) {
  if (!configured(env)) return false;
  const value = request.headers.get('cookie')?.split(';').map(item => item.trim()).find(item => item.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  if (!value || value.length > 1024) return false;
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra) return false;
  const expected = createHmac('sha256', key(env)).update(payload).digest('base64url');
  if (!equal(signature, expected)) return false;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString());
    const seconds = Math.floor(now / 1000);
    return Number.isInteger(session.expires) && session.expires > seconds && session.expires <= seconds + TTL && typeof session.nonce === 'string';
  } catch { return false; }
}
export function requireSession(request, env = process.env) {
  if (!authenticated(request, env)) throw new PublicError(401, 'LOGIN_REQUIRED', 'Entre novamente para consultar o financeiro.');
}
