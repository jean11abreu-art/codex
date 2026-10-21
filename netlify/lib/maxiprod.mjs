import { queries, roots } from './queries.mjs';
import { PublicError } from './http.mjs';

export const ENDPOINT = 'https://api.maxiprod.com.br/graphql/';
export function validDate(value) {
  return typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function validateRange(start, end) {
  if (!validDate(start) || !validDate(end) || start > end || (Date.parse(end) - Date.parse(start)) / 86400000 > 366) {
    throw new PublicError(400, 'INVALID_RANGE', 'Selecione datas válidas e um período de até 366 dias, entre 2000 e 2099.');
  }
}
export function cents(value) {
  // Decimal -> integer cents without binary floating-point rounding errors.
  const match = String(value).match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) throw new PublicError(502, 'INVALID_AMOUNT', 'O Maxiprod retornou um valor monetário inválido.');
  const fraction = (match[3] || '').padEnd(3, '0');
  let amount = BigInt(match[2]) * 100n + BigInt(fraction.slice(0, 2));
  if (Number(fraction[2]) >= 5) amount += 1n;
  if (match[1]) amount = -amount;
  if (amount > BigInt(Number.MAX_SAFE_INTEGER) || amount < BigInt(Number.MIN_SAFE_INTEGER)) throw new PublicError(502, 'AMOUNT_OVERFLOW', 'Valor acima do limite seguro de cálculo.');
  return Number(amount);
}
export function safeSum(values) {
  return values.reduce((sum, value) => {
    if (!Number.isSafeInteger(sum + value)) throw new PublicError(502, 'AMOUNT_OVERFLOW', 'Total acima do limite seguro de cálculo.');
    return sum + value;
  }, 0);
}
export function id(value) {
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) throw new PublicError(502, 'INVALID_ID', 'O Maxiprod retornou um identificador inválido.');
  return String(value);
}
export async function allPages(name, variables = {}, { env = process.env, fetcher = fetch, signal, maxItems = 10000 } = {}) {
  if (!env.MAXIPROD_API_KEY) throw new PublicError(503, 'KEY_MISSING', 'Configure MAXIPROD_API_KEY no Netlify.');
  // Bearer is an explicit integration setting; its validity still needs the first authenticated read.
  // No arbitrary URL, GraphQL operation, header name or mutation can be supplied by the browser.
  const scheme = env.MAXIPROD_AUTH_SCHEME || 'Bearer';
  if (!['Bearer', 'Raw'].includes(scheme)) throw new PublicError(503, 'AUTH_CONFIG', 'MAXIPROD_AUTH_SCHEME deve ser Bearer ou Raw, conforme a documentação do Maxiprod.');
  const rows = []; const seen = new Set(); let expectedCount;
  for (let skip = 0; skip < maxItems;) {
    let response;
    try {
      response = await fetcher(ENDPOINT, { method: 'POST', signal, redirect: 'error', headers: {
        'Content-Type': 'application/json', Accept: 'application/json',
        Authorization: scheme === 'Raw' ? env.MAXIPROD_API_KEY : `Bearer ${env.MAXIPROD_API_KEY}`,
      }, body: JSON.stringify({ query: queries[name], variables: { ...variables, skip, take: 100 } }) });
    } catch { throw new PublicError(502, 'UPSTREAM_UNAVAILABLE', 'Não foi possível acessar o Maxiprod. Tente novamente.'); }
    if ([401, 403].includes(response.status)) throw new PublicError(502, 'UPSTREAM_AUTH', 'O Maxiprod recusou o acesso. Confira a chave, o formato de autenticação e as permissões financeiras.');
    if (response.status === 429) throw new PublicError(503, 'UPSTREAM_RATE_LIMIT', 'Limite de consultas do Maxiprod atingido. Aguarde e atualize.');
    if (!response.ok) throw new PublicError(502, 'UPSTREAM_ERROR', 'O Maxiprod não concluiu a consulta.');
    let body; try { body = await response.json(); } catch { throw new PublicError(502, 'UPSTREAM_FORMAT', 'O Maxiprod retornou uma resposta inesperada.'); }
    if (body.errors?.length) throw new PublicError(502, 'UPSTREAM_GRAPHQL', 'O Maxiprod recusou uma consulta. Verifique a autenticação e as permissões do token para o financeiro.');
    const segment = body.data?.[roots[name]];
    if (!segment || !Array.isArray(segment.items) || typeof segment.pageInfo?.hasNextPage !== 'boolean' || !Number.isInteger(segment.totalCount) || segment.totalCount < 0) {
      throw new PublicError(502, 'UPSTREAM_FORMAT', 'A resposta do Maxiprod está incompleta. Nenhum total foi calculado.');
    }
    expectedCount ??= segment.totalCount;
    if (expectedCount !== segment.totalCount) throw new PublicError(409, 'DATA_CHANGED', 'Os lançamentos mudaram durante a consulta. Atualize para obter novos totais.');
    for (const row of segment.items) {
      const rowId = id(row.id);
      if (seen.has(rowId)) throw new PublicError(409, 'DATA_CHANGED', 'A paginação mudou durante a consulta. Atualize novamente.');
      seen.add(rowId); rows.push(row);
    }
    if (rows.length > maxItems) break;
    if (!segment.pageInfo.hasNextPage) {
      if (rows.length !== expectedCount) throw new PublicError(502, 'INCOMPLETE_DATA', 'Faltam páginas na resposta do Maxiprod. Nenhum total parcial será exibido.');
      return rows;
    }
    if (segment.items.length === 0) throw new PublicError(502, 'INCOMPLETE_DATA', 'A paginação do Maxiprod está incompleta.');
    skip += segment.items.length;
  }
  throw new PublicError(422, 'TOO_MANY_RECORDS', 'A consulta ultrapassou 10 mil registros. Reduza o período ou revise o saldo inicial.');
}

export function titleFilter(direction, companyId, range, month) {
  const pendingField = direction === 'in' ? 'valorAReceber' : 'valorAPagar';
  return { and: [
    { minhaEmpresaId: { eq: Number(companyId) } },
    { estado: { in: ['EMITIDO', direction === 'in' ? 'RECEBIDO' : 'PAGO'] } },
    { tipo: { in: ['TITULO', direction === 'in' ? 'RECEITA' : 'DESPESA', 'ADIANTAMENTO'] } },
    { or: [
      { vencimentoData: { gte: range.start, lte: range.end } },
      { vencimentoData: { gte: month.start, lte: month.end } },
      { and: [{ [pendingField]: { gt: 0 } }, { vencimentoData: { lte: month.end } }] },
    ] },
  ] };
}
export function normalizeTitle(row, direction) {
  const outstandingCents = cents(direction === 'in' ? row.valorAReceber : row.valorAPagar);
  const paidCents = cents(direction === 'in' ? row.valorRecebidoLiquido : row.valorPagoLiquido);
  if (outstandingCents < 0 || !validDate(row.vencimentoData)) throw new PublicError(502, 'INVALID_TITLE', 'O Maxiprod retornou um título com saldo ou vencimento inválido.');
  const account = row.contaDeDestino || row.conta;
  return {
    id: `${direction}-${id(row.id)}`, description: (direction === 'in' ? row.descricaoTituloContaReceber : row.descricaoTituloContaPagar)?.descricaoTitulo || row.referenteA || `Título ${row.id}`,
    company: (direction === 'in' ? row.cliente : row.fornecedor)?.apelido || 'Sem favorecido', direction,
    category: account?.descricao || 'Sem classificação', accountId: account ? id(account.id) : null,
    amountCents: cents(row.valorLiquido), outstandingCents, paidCents,
    dueDate: row.vencimentoData, status: outstandingCents > 0 ? 'pending' : 'paid',
    boleto: ['BOLETO_COM_REGISTRO', 'BOLETO_SEM_REGISTRO'].includes(row.formaDeCobranca?.meioDePagamento),
  };
}
