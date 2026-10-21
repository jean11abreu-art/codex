import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSchema, parse, validate } from 'graphql';
import { queries, roots } from '../netlify/lib/queries.mjs';
import { allPages, cents, normalizeTitle, titleFilter, validateRange } from '../netlify/lib/maxiprod.mjs';
import { authenticated, configured, passwordMatches, sessionCookie } from '../netlify/lib/auth.mjs';
import finance, { loadFinance } from '../netlify/functions/finance.mjs';
import session from '../netlify/functions/session.mjs';
import { total } from '../src/finance.mjs';

const env = { MAXIPROD_API_KEY: 'fake-api-key-for-automated-tests', DASHBOARD_PASSWORD: 'Test-only-long-password-123456' };
const now = new Date('2026-10-21T15:00:00Z');
const request = (cookie = '', url = 'https://example.test/api/finance') => new Request(url, { headers: { Cookie: cookie } });
const response = (name, items, next = false, count = items.length) => Response.json({ data: { [roots[name]]: { items, pageInfo: { hasNextPage: next }, totalCount: count } } });
const title = {
  id: 7, minhaEmpresaId: 1, estado: 'EMITIDO', tipo: 'TITULO', valorLiquido: '100.00', valorAPagar: '60.00', valorPagoLiquido: '40.00',
  vencimentoData: '2026-10-10', fornecedor: { apelido: 'Fornecedor' },
  contaDeDestino: { id: 3, descricao: 'Despesas de frete' }, formaDeCobranca: { meioDePagamento: 'BOLETO_COM_REGISTRO' },
};

test('todas as operações são consultas válidas no esquema fornecido', () => {
  const schema = buildSchema(readFileSync(new URL('../docs/maxiprod/schema.graphql', import.meta.url), 'utf8'));
  for (const operation of Object.values(queries)) {
    const document = parse(operation);
    assert.deepEqual(validate(schema, document).map(error => error.message), []);
    assert.equal(document.definitions[0].operation, 'query');
  }
});
test('sessão assinada expira e é invalidada ao alterar qualquer segredo', () => {
  assert.equal(configured({ ...env, DASHBOARD_PASSWORD: 'curta' }), false);
  assert.equal(passwordMatches(env.DASHBOARD_PASSWORD, env), true);
  assert.equal(passwordMatches('incorreta', env), false);
  const cookie = sessionCookie(env, now.getTime());
  assert.match(cookie, /HttpOnly; Secure; SameSite=Strict/);
  assert.equal(authenticated(request(cookie), env, now.getTime()), true);
  assert.equal(authenticated(request(cookie.replace('session=', 'session=x')), env, now.getTime()), false);
  assert.equal(authenticated(request(cookie), env, now.getTime() + 8 * 3600000), false);
  assert.equal(authenticated(request(cookie), { ...env, DASHBOARD_PASSWORD: env.DASHBOARD_PASSWORD + 'changed' }, now.getTime()), false);
  assert.equal(authenticated(request(cookie), { ...env, MAXIPROD_API_KEY: 'rotated-key' }, now.getTime()), false);
});
test('acesso sem sessão não consulta o financeiro; login externo é recusado', async () => {
  const denied = await finance(request());
  assert.equal(denied.status, 401);
  assert.match(denied.headers.get('cache-control'), /no-store/);
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
  const crossOrigin = await session(new Request('https://example.test/api/session', { method: 'POST', headers: { Origin: 'https://other.test', 'Content-Type': 'application/json' }, body: '{}' }));
  assert.equal(crossOrigin.status, 403);
});
test('valores decimais e datas são validados antes dos totais', () => {
  assert.equal(cents('1.005'), 101);
  assert.equal(cents('-1.005'), -101);
  assert.equal(cents('123456.78'), 12345678);
  assert.throws(() => cents('Infinity'));
  assert.throws(() => cents('900719925474099.12'));
  assert.throws(() => validateRange('2026-02-30', '2026-03-01'));
  assert.throws(() => validateRange('2026-01-01', '2027-02-01'));
  assert.doesNotThrow(() => validateRange('2026-01-01', '2026-12-31'));
});
test('paginação respeita o tamanho real da página e recusa totais parciais ou mutáveis', async () => {
  const seen = [];
  const rows = await allPages('companies', {}, { env, fetcher: async (url, init) => {
    const skip = JSON.parse(init.body).variables.skip; seen.push(skip);
    assert.equal(url, 'https://api.maxiprod.com.br/graphql/');
    assert.equal(init.headers.Authorization, 'Bearer ' + env.MAXIPROD_API_KEY);
    return response('companies', skip === 0 ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }], skip === 0, 3);
  } });
  assert.equal(rows.length, 3); assert.deepEqual(seen, [0, 2]);
  await assert.rejects(() => allPages('companies', {}, { env, fetcher: async () => response('companies', [{ id: 1 }], false, 2) }), error => error.code === 'INCOMPLETE_DATA');
  let calls = 0;
  await assert.rejects(() => allPages('companies', {}, { env, fetcher: async () => response('companies', [{ id: ++calls }], true, calls === 1 ? 2 : 3) }), error => error.code === 'DATA_CHANGED');
  await assert.rejects(() => allPages('companies', {}, { env, maxItems: 2, fetcher: async () => response('companies', [{ id: 1 }, { id: 2 }], true, 3) }), error => error.code === 'TOO_MANY_RECORDS');
});
test('erros GraphQL, dados malformados e autorização nunca viram totais zerados', async () => {
  for (const result of [Response.json({ errors: [{ message: 'private upstream detail' }] }), Response.json({ data: {} }), new Response('secret', { status: 401 })]) {
    await assert.rejects(() => allPages('payable', {}, { env, fetcher: async () => result }), error => !error.message.includes('private upstream detail') && !error.message.includes('secret'));
  }
});
test('saldo parcial usa o valor restante e filtros excluem estados duplicados', () => {
  const entry = normalizeTitle(title, 'out');
  assert.equal(entry.amountCents, 10000); assert.equal(entry.outstandingCents, 6000);
  assert.equal(entry.status, 'pending'); assert.equal(entry.boleto, true);
  assert.equal(total([entry], 'out', 'pending'), 6000);
  assert.equal(total([entry], 'out', 'paid'), 4000);
  const filter = titleFilter('out', '1', { start: '2026-10-01', end: '2026-10-31' }, { start: '2026-10-01', end: '2026-10-31' });
  assert.deepEqual(filter.and[1].estado.in, ['EMITIDO', 'PAGO']);
  assert.ok(filter.and[3].or.some(item => item.and?.[1].vencimentoData.lte === '2026-10-31'));
});

function fixtureFetch(cashRows = []) {
  return async (_url, init) => {
    const { query } = JSON.parse(init.body);
    const name = Object.keys(queries).find(name => queries[name] === query);
    return response(name, ({ companies: [{ id: 1, apelido: 'Empresa teste' }], accounts: [{ id: 3, codigoEstruturado: '3.1', descricao: 'Frete' }], payable: [title], receivable: [], cash: cashRows })[name]);
  };
}
test('consulta sem saldo inicial mantém saldo/projeção indisponíveis e usa liquidações parciais do dia', async () => {
  const result = await loadFinance(new URLSearchParams({ start: '2026-10-01', end: '2026-10-31' }), { env, now, fetcher: fixtureFetch([
    { id: 1, data: '2026-10-21', valor: '40', debitoOuCredito: 'CREDITO', contaAPagar: { id: 7 } },
    { id: 2, data: '2026-10-21', valor: '1000', debitoOuCredito: 'DEBITO' }, // Transfer not a receipt.
  ]) });
  assert.equal(result.bankBalanceCents, null); assert.equal(result.projectionCents, null);
  assert.equal(result.daily.outgoingCents, 4000); assert.equal(result.daily.incomingCents, 0);
  assert.equal(result.entries[0].outstandingCents, 6000);
  assert.ok(!JSON.stringify(result).includes(env.MAXIPROD_API_KEY));
});
test('saldo consolidado e projeção usam abertura da empresa e saldo pendente', async () => {
  const configuredEnv = { ...env, MAXIPROD_OPENING_BALANCES: JSON.stringify({ 1: { date: '2026-10-01', cents: 5000 } }) };
  const result = await loadFinance(new URLSearchParams({ start: '2026-10-01', end: '2026-10-31' }), { env: configuredEnv, now, fetcher: fixtureFetch([
    { id: 1, data: '2026-10-21', valor: '40', debitoOuCredito: 'CREDITO', contaAPagar: { id: 7 } },
    { id: 2, data: '2026-10-20', valor: '10', debitoOuCredito: 'DEBITO', contaAReceber: { id: 8 } },
  ]) });
  assert.equal(result.bankBalanceCents, 2000); assert.equal(result.projectionCents, -4000);
  assert.equal(result.daily.incomingCents, 0);
});
