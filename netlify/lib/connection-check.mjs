import { queries } from './queries.mjs';
import { authorization, graphqlFailure } from './upstream-errors.mjs';

const URL = 'https://api.maxiprod.com.br/graphql/';
const basicQuery = 'query ConnectionCompanies { empresas(take: 1) { items { id } } }';
const filteredQuery = 'query ConnectionOwnCompanies { empresas(take: 1, where: {minhaEmpresa: {eq: true}}) { items { id } } }';
const sortedQuery = 'query ConnectionSortedCompanies { empresas(take: 1, where: {minhaEmpresa: {eq: true}}, order: [{id: ASC}]) { items { id } } }';
export const diagnosticQueries = {
  basic: basicQuery, filtered: filteredQuery, sorted: sortedQuery,
  schema: 'query ConnectionSchema { __typename }', full: queries.companies,
};
const notes = {
  UPSTREAM_AUTH: 'O serviço recusou a autenticação.', UPSTREAM_PERMISSION: 'O serviço informou falta de permissão.',
  UPSTREAM_QUERY: 'O serviço recusou o formato da consulta.', UPSTREAM_LIMIT: 'O serviço informou um limite de complexidade.',
  UPSTREAM_EXECUTION: 'O serviço retornou erro sem informar a causa.',
  FORMAT: 'O serviço retornou um formato inesperado.', NETWORK: 'Não foi possível concluir a comunicação.',
  HTTP: 'O serviço retornou falha HTTP.',
};

export async function checkConnection({ env = process.env, fetcher = fetch } = {}) {
  // This endpoint only returns local labels and booleans. No credential values,
  // claims, customer names/IDs, records, raw errors or extension values escape.
  authorization(env);
  const probeEnv = { ...env, MAXIPROD_API_KEY: env.MAXIPROD_API_KEY.trim().replace(/^Bearer\s+/i, '').trim() };
  const configuredScheme = env.MAXIPROD_AUTH_SCHEME || 'Bearer';
  const steps = [];
  const signal = AbortSignal.timeout(20000);
  async function probe(key, label, scheme, query, variables) {
    let result;
    try {
      const response = await fetcher(URL, {
        method: 'POST', redirect: 'error', signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: authorization({ ...probeEnv, MAXIPROD_AUTH_SCHEME: scheme }) },
        body: JSON.stringify({ query, ...(variables ? { variables } : {}) }),
      });
      if (!response.ok) result = { ok: false, reason: [401, 403].includes(response.status) ? 'UPSTREAM_AUTH' : 'HTTP' };
      else {
        let body; try { body = await response.json(); } catch { body = null; }
        if (Array.isArray(body?.errors) && body.errors.length) result = { ok: false, reason: graphqlFailure('companies', body.errors).code };
        else {
          const success = key === 'schema' ? body?.data?.__typename === 'GraphQLQuery' : Array.isArray(body?.data?.empresas?.items);
          result = { ok: success, reason: success ? null : 'FORMAT' };
        }
      }
    } catch { result = { ok: false, reason: 'NETWORK' }; }
    const step = { key, label, ok: result.ok, note: result.ok ? 'O Maxiprod respondeu à consulta.' : notes[result.reason] || notes.UPSTREAM_EXECUTION };
    steps.push(step);
    return result.ok;
  }
  const report = (reference, summary, action) => ({ reference, summary, action, steps });
  await probe('schema', 'Conexão básica com a API', configuredScheme, diagnosticQueries.schema);
  const basicOk = await probe('basic', `Consulta mínima de empresas (${configuredScheme === 'Bearer' ? 'Bearer' : 'sem prefixo'})`, configuredScheme, basicQuery);
  if (!basicOk) {
    // Both documented integration settings use the same existing credential and
    // HTTPS destination. This is one bounded read-only test, never a config change.
    const other = configuredScheme === 'Bearer' ? 'Raw' : 'Bearer';
    const alternativeOk = await probe('alternative', `Consulta mínima de empresas (${other === 'Bearer' ? 'Bearer' : 'sem prefixo'})`, other, basicQuery);
    if (alternativeOk) return report(`MP-CHECK-USE-${other.toUpperCase()}`, 'A consulta mínima funcionou com outro formato de autenticação.', `Configure MAXIPROD_AUTH_SCHEME=${other} no Netlify e faça uma nova implantação. A chave permanece a mesma.`);
    const apiResponded = steps[0].ok;
    return report(apiResponded ? 'MP-CHECK-COMPANIES-DENIED' : 'MP-CHECK-ACCESS-UNCONFIRMED', apiResponded ? 'A API respondeu à conexão básica, mas recusou a consulta mínima de empresas.' : 'Não foi possível confirmar o acesso à API com a chave cadastrada.', 'Envie este diagnóstico para continuarmos a investigação. Se o Maxiprod não informar a causa, será necessário validar o mesmo acesso no explorador oficial ou com o suporte do Maxiprod.');
  }
  if (!await probe('filtered', 'Consulta das empresas próprias', configuredScheme, filteredQuery)) return report('MP-CHECK-FILTER', 'A consulta mínima funcionou, mas o filtro de empresa própria falhou.', 'A integração precisa ajustar a consulta de empresas. Envie este diagnóstico.');
  if (!await probe('sorted', 'Ordenação das empresas', configuredScheme, sortedQuery)) return report('MP-CHECK-SORT', 'O filtro funcionou, mas a ordenação falhou.', 'A integração precisa ajustar a ordenação. Envie este diagnóstico.');
  if (!await probe('page', 'Paginação e contagem de empresas', configuredScheme, queries.companies, { skip: 0, take: 1 })) return report('MP-CHECK-PAGINATION', 'A consulta ordenada funcionou, mas a paginação ou contagem falhou.', 'A integração precisa ajustar a consulta paginada. Envie este diagnóstico.');
  if (!await probe('size', 'Tamanho da página usado pelo painel', configuredScheme, queries.companies, { skip: 0, take: 100 })) return report('MP-CHECK-PAGE-SIZE', 'A página pequena funcionou, mas o tamanho usado pelo painel falhou.', 'A integração precisa reduzir o tamanho das páginas. Envie este diagnóstico.');
  return report('MP-CHECK-COMPANIES-OK', 'As consultas de empresas funcionaram neste teste.', 'Clique em Tentar novamente. O resultado confirma somente o cadastro de empresas; os dados financeiros ainda precisam ser consultados.');
}
