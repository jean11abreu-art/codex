import { requireSession } from '../lib/auth.mjs';
import { checkConnection } from '../lib/connection-check.mjs';
import { failure, json, sameOrigin } from '../lib/http.mjs';

export default async function handler(request) {
  try {
    requireSession(request);
    if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405, { Allow: 'POST' });
    sameOrigin(request);
    return json(await checkConnection());
  } catch (error) { return failure(error); }
}

/** @type {import('@netlify/functions').Config} */
export const config = { path: '/api/connection-check', rateLimit: { windowLimit: 5, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
