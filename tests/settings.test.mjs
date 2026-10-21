import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyCosts, readSettings, saveSettings, validateSettings } from '../netlify/lib/settings.mjs';
import handler, { settingsRequest } from '../netlify/functions/settings.mjs';
import { sessionCookie } from '../netlify/lib/auth.mjs';
import { queries, roots } from '../netlify/lib/queries.mjs';
import { parseRealInput } from '../src/money-input.mjs';
import { memorySettingsStore } from './helpers/memory-settings.mjs';

const env = { MAXIPROD_API_KEY: 'fake-settings-token', DASHBOARD_PASSWORD: 'test-only-settings-password-12345' };
const now = new Date('2026-10-21T15:00:00Z'); const today = '2026-10-21';
const settings = () => ({ costMapping: { ...emptyCosts(), Frete: ['3'] }, opening: { date: '2026-10-21', cents: -1050 } });
const request = (body, origin = 'https://example.test', company = '1') => new Request('https://example.test/api/settings?company=' + company, { method: body ? 'PUT' : 'GET', headers: { Cookie: sessionCookie(env), Origin: origin, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
async function fetcher(_url, init) {
  assert.equal(init.headers.Authorization, env.MAXIPROD_API_KEY);
  const { query } = JSON.parse(init.body); const name = Object.keys(queries).find(key => queries[key] === query);
  const items = name === 'companies' ? [{ id: 1, apelido: 'Empresa A' }, { id: 2, apelido: 'Empresa B' }] : [{ id: 3, codigoEstruturado: '3.1', descricao: 'Frete', finalidade: 'DESPESA' }];
  return Response.json({ data: { [roots[name]]: { items, totalCount: items.length, pageInfo: { hasNextPage: false } } } });
}

test('valor brasileiro mantém centavos, zero e negativos sem aceitar formatos ambíguos', () => {
  assert.equal(parseRealInput('1.234,56'), 123456); assert.equal(parseRealInput('-0,01'), -1);
  assert.equal(parseRealInput('0'), 0); assert.equal(parseRealInput('-1.000,50'), -100050);
  for (const value of ['', '1,234', '12.34', 'NaN', '1e8', '1000000001']) assert.throws(() => parseRealInput(value));
});
test('validação recusa datas futuras, centavos fracionários, contas inválidas e categorias sobrepostas', () => {
  assert.deepEqual(validateSettings(settings(), today, new Set(['3'])), settings());
  const zero = { ...settings(), opening: { date: today, cents: 0 } };
  assert.equal(validateSettings(zero, today).opening.cents, 0);
  for (const opening of [{ date: '2026-10-22', cents: 0 }, { date: '2026-02-30', cents: 1 }, { date: today, cents: 1.5 }]) assert.throws(() => validateSettings({ ...settings(), opening }, today));
  assert.throws(() => validateSettings({ ...settings(), costMapping: { ...emptyCosts(), Frete: ['3'], 'Salários': ['3'] } }, today), error => error.code === 'COST_DUPLICATE');
  assert.throws(() => validateSettings(settings(), today, new Set()), error => error.code === 'COST_ACCOUNT_MISSING');
});
test('salvamento persiste entre leitores, isola empresas e impede sobrescrita com versão antiga', async () => {
  const storage = memorySettingsStore(); const options = { storage, env, today };
  assert.equal((await readSettings('1', options)).version, null);
  const first = await saveSettings('1', settings(), null, { storage, now });
  assert.deepEqual((await readSettings('1', options)).settings, settings());
  assert.equal((await readSettings('2', options)).settings.opening, null);
  await assert.rejects(() => saveSettings('1', settings(), null, { storage, now }), error => error.code === 'SETTINGS_CONFLICT');
  const cleared = { costMapping: emptyCosts(), opening: null };
  await saveSettings('1', cleared, first.version, { storage, now });
  await assert.rejects(() => saveSettings('1', settings(), first.version, { storage, now }), error => error.code === 'SETTINGS_CONFLICT');
  assert.deepEqual((await readSettings('1', { ...options, env: { MAXIPROD_OPENING_BALANCES: JSON.stringify({ 1: { date: today, cents: 1000 } }) } })).settings, cleared);
});
test('sem sessão e com origem externa não se acessa ou grava configurações', async () => {
  const result = await handler(new Request('https://example.test/api/settings'));
  assert.equal(result.status, 401); assert.match(result.headers.get('cache-control'), /no-store/);
  await assert.rejects(() => settingsRequest(request({ ...settings(), companyId: '1', expectedVersion: null }, 'https://other.test'), { env, fetcher, now }), error => error.code === 'ORIGIN');
});
test('API autenticada valida empresas e contas antes de salvar e devolve versão atual', async () => {
  const storage = memorySettingsStore(); const options = { env, fetcher, now, storage };
  const initial = await (await settingsRequest(request(), options)).json();
  assert.equal(initial.company.id, '1'); assert.equal(initial.version, null);
  const saved = await (await settingsRequest(request({ ...settings(), companyId: '1', expectedVersion: initial.version }), options)).json();
  assert.ok(saved.version); assert.deepEqual(saved.settings, settings());
  const other = await (await settingsRequest(request(undefined, undefined, '2'), options)).json();
  assert.equal(other.settings.opening, null);
  await assert.rejects(() => settingsRequest(request({ ...settings(), companyId: '999', expectedVersion: null }), options), error => error.code === 'SETTINGS_COMPANY');
  await assert.rejects(() => settingsRequest(request({ ...settings(), costMapping: { ...emptyCosts(), Frete: ['404'] }, companyId: '1', expectedVersion: saved.version }), options), error => error.code === 'COST_ACCOUNT_MISSING');
  assert.ok(!JSON.stringify(saved).includes(env.MAXIPROD_API_KEY));
});
test('falhas do armazenamento não são apresentadas como salvamento ou saldo zero', async () => {
  const storage = { async getWithMetadata() { throw new Error('private-key'); }, async setJSON() { throw new Error('private-key'); } };
  await assert.rejects(() => readSettings('1', { storage }), error => error.code === 'SETTINGS_STORAGE' && !error.message.includes('private-key'));
  await assert.rejects(() => saveSettings('1', settings(), null, { storage }), error => error.code === 'SETTINGS_STORAGE' && !error.message.includes('private-key'));
});
