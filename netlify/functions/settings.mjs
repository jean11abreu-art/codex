import { requireSession } from '../lib/auth.mjs';
import { allPages, id } from '../lib/maxiprod.mjs';
import { failure, json, PublicError, sameOrigin } from '../lib/http.mjs';
import { readSettings, saveSettings, todayInBrazil, validateSettings } from '../lib/settings.mjs';

export async function settingsRequest(request, { env = process.env, fetcher = fetch, storage, now = new Date() } = {}) {
  requireSession(request, env);
  if (!['GET', 'PUT'].includes(request.method)) return json({ error: 'Método não permitido.' }, 405, { Allow: 'GET, PUT' });
  let body;
  if (request.method === 'PUT') {
    sameOrigin(request);
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new PublicError(415, 'JSON_REQUIRED', 'Envie as configurações pelo formulário.');
    if (Number(request.headers.get('content-length') || 0) > 32768) throw new PublicError(413, 'BODY_SIZE', 'Configurações muito grandes.');
    const text = await request.text();
    if (Buffer.byteLength(text) > 32768) throw new PublicError(413, 'BODY_SIZE', 'Configurações muito grandes.');
    try { body = JSON.parse(text); } catch { throw new PublicError(400, 'INVALID_JSON', 'Solicitação inválida.'); }
    if (!body || typeof body !== 'object' || Object.keys(body).some(key => !['companyId', 'expectedVersion', 'costMapping', 'opening'].includes(key))) throw new PublicError(400, 'SETTINGS_INVALID', 'Revise os campos das configurações.');
  }
  const queryId = request.method === 'PUT' ? body.companyId : new URL(request.url).searchParams.get('company');
  const options = { env, fetcher, signal: AbortSignal.timeout(24000) };
  const companies = (await allPages('companies', {}, options)).map(row => ({ id: id(row.id), name: row.apelido }));
  const company = companies.find(row => row.id === queryId) || (!queryId && companies.length === 1 ? companies[0] : null);
  if (queryId && !company) throw new PublicError(403, 'SETTINGS_COMPANY', 'Esta empresa não está disponível para este acesso.');
  if (!company) {
    if (request.method === 'PUT') throw new PublicError(400, 'SETTINGS_COMPANY', 'Selecione uma empresa.');
    return json({ companies, needsCompany: true });
  }
  const today = todayInBrazil(now);
  const accounts = (await allPages('accounts', {}, options)).map(row => ({ id: id(row.id), code: row.codigoEstruturado, name: row.descricao || 'Sem descrição', purpose: row.finalidade || null }));
  if (request.method === 'GET') return json({ company, companies, accounts, today, ...await readSettings(company.id, { env, today, storage }) });
  const settings = validateSettings(body, today, new Set(accounts.map(account => account.id)));
  return json({ company, ...await saveSettings(company.id, settings, body.expectedVersion, { storage, now }) });
}

export default async function handler(request) {
  try { return await settingsRequest(request); } catch (error) { return failure(error); }
}

/** @type {import('@netlify/functions').Config} */
export const config = { path: '/api/settings', rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
