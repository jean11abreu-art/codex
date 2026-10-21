import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSchema, parse, validate } from 'graphql';
import { checkConnection, diagnosticQueries } from '../netlify/lib/connection-check.mjs';
import handler from '../netlify/functions/connection-check.mjs';

const env = { MAXIPROD_API_KEY: 'fake-token-never-output' };
const passed = query => Response.json(query.includes('__typename') ? { data: { __typename: 'GraphQLQuery' } } : { data: { empresas: { items: [{ id: 123, apelido: 'private-company-name' }] } } });
const denied = () => Response.json({ errors: [{ message: 'private-company-name', extensions: { private: 'private-stack-and-token' } }] });

test('consultas de diagnóstico correspondem ao esquema e não têm mutações', () => {
  const schema = buildSchema(readFileSync(new URL('../docs/maxiprod/schema.graphql', import.meta.url), 'utf8'));
  for (const query of Object.values(diagnosticQueries)) {
    const parsed = parse(query);
    assert.equal(parsed.definitions[0].operation, 'query');
    assert.deepEqual(validate(schema, parsed).map(error => error.message), []);
  }
});
test('diagnóstico é protegido antes de consultar o Maxiprod', async () => {
  const result = await handler(new Request('https://example.test/api/connection-check', { method: 'POST' }));
  assert.equal(result.status, 401);
  assert.match(result.headers.get('cache-control'), /no-store/);
});
test('falha genérica para ambos os formatos é inconclusiva e não expõe dados', async () => {
  let calls = 0;
  const result = await checkConnection({ env, fetcher: async (url, init) => {
    calls++; assert.equal(url, 'https://api.maxiprod.com.br/graphql/');
    assert.equal(init.method, 'POST'); assert.equal(init.redirect, 'error');
    return denied();
  } });
  assert.equal(calls, 3); assert.equal(result.reference, 'MP-CHECK-ACCESS-UNCONFIRMED');
  for (const secret of [env.MAXIPROD_API_KEY, 'private-company-name', 'private-stack-and-token', '123']) assert.ok(!JSON.stringify(result).includes(secret));
});
test('detecta formato sem prefixo sem modificar variáveis ou a chave', async () => {
  const original = { MAXIPROD_API_KEY: 'Bearer fake-token-never-output', MAXIPROD_AUTH_SCHEME: 'Bearer' };
  const result = await checkConnection({ env: original, fetcher: async (_url, init) => {
    const { query } = JSON.parse(init.body);
    return init.headers.Authorization === 'fake-token-never-output' ? passed(query) : denied();
  } });
  assert.equal(result.reference, 'MP-CHECK-USE-RAW');
  assert.equal(original.MAXIPROD_API_KEY, 'Bearer fake-token-never-output');
  assert.match(result.action, /MAXIPROD_AUTH_SCHEME=Raw/);
});
test('API básica disponível e empresas recusadas não são tratadas como token confirmado inválido', async () => {
  const result = await checkConnection({ env, fetcher: async (_url, init) => {
    const { query } = JSON.parse(init.body); return query.includes('__typename') ? passed(query) : denied();
  } });
  assert.equal(result.reference, 'MP-CHECK-COMPANIES-DENIED');
});
test('isola filtro, ordenação, paginação e tamanho da página em consultas pequenas', async () => {
  for (const [stage, reference] of [['filtered', 'FILTER'], ['sorted', 'SORT'], ['page', 'PAGINATION'], ['size', 'PAGE-SIZE']]) {
    const result = await checkConnection({ env, fetcher: async (_url, init) => {
      const { query, variables } = JSON.parse(init.body);
      const fail = stage === 'page' ? query === diagnosticQueries.full && variables.take === 1
        : stage === 'size' ? query === diagnosticQueries.full && variables.take === 100 : query === diagnosticQueries[stage];
      return fail ? denied() : passed(query);
    } });
    assert.equal(result.reference, 'MP-CHECK-' + reference);
  }
});
test('sucesso no cadastro de empresas não é apresentado como sucesso das finanças', async () => {
  const result = await checkConnection({ env, fetcher: async (_url, init) => {
    assert.equal(init.headers.Authorization, env.MAXIPROD_API_KEY);
    return passed(JSON.parse(init.body).query);
  } });
  assert.equal(result.reference, 'MP-CHECK-COMPANIES-OK');
  assert.equal(result.steps.length, 6);
  assert.match(result.action, /dados financeiros ainda precisam/);
  assert.ok(!JSON.stringify(result).includes('private-company-name'));
});
