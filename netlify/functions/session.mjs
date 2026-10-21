import { authenticated, clearCookie, configured, passwordMatches, sessionCookie } from '../lib/auth.mjs';
import { failure, json, PublicError, sameOrigin } from '../lib/http.mjs';

// Extra per-instance protection. This is not a distributed rate limiter; use a long,
// unique password. Accounts/MFA require a dedicated identity provider.
const attempts = new Map();
export default async function handler(request, context = {}) {
  try {
    if (request.method === 'GET') return json({ configured: configured(), authenticated: authenticated(request) });
    if (!['POST', 'DELETE'].includes(request.method)) return json({ error: 'Método não permitido.' }, 405, { Allow: 'GET, POST, DELETE' });
    sameOrigin(request);
    if (request.method === 'DELETE') return json({ authenticated: false }, 200, { 'Set-Cookie': clearCookie() });
    const ip = context.ip || 'unknown'; const now = Date.now();
    if (attempts.size > 1000) for (const [entry, value] of attempts) if (value.until <= now) attempts.delete(entry);
    const current = attempts.get(ip);
    if (current?.until > now && current.count >= 5) throw new PublicError(429, 'RATE_LIMIT', 'Aguarde um minuto antes de tentar novamente.');
    attempts.set(ip, { until: current?.until > now ? current.until : now + 60000, count: current?.until > now ? current.count + 1 : 1 });
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new PublicError(415, 'JSON_REQUIRED', 'Formato de solicitação inválido.');
    if (Number(request.headers.get('content-length') || 0) > 2048) throw new PublicError(413, 'BODY_SIZE', 'Solicitação muito grande.');
    const text = await request.text();
    if (Buffer.byteLength(text) > 2048) throw new PublicError(413, 'BODY_SIZE', 'Solicitação muito grande.');
    let body; try { body = JSON.parse(text); } catch { throw new PublicError(400, 'INVALID_JSON', 'Solicitação inválida.'); }
    if (!passwordMatches(body?.password)) throw new PublicError(401, 'INVALID_PASSWORD', 'Senha incorreta.');
    attempts.delete(ip);
    return json({ authenticated: true }, 200, { 'Set-Cookie': sessionCookie() });
  } catch (error) { return failure(error); }
}

/** @type {import('@netlify/functions').Config} */
export const config = { path: '/api/session', rateLimit: { windowLimit: 12, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
