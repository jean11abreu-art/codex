import { requireSession } from '../lib/auth.mjs';
import { failure, json, PublicError } from '../lib/http.mjs';
import { allPages, cents, id, normalizeTitle, safeSum, titleFilter, validateRange } from '../lib/maxiprod.mjs';
import { emptyCosts, readSettings, todayInBrazil } from '../lib/settings.mjs';

export async function loadFinance(params, { env = process.env, fetcher = fetch, now = new Date(), settingsReader = readSettings } = {}) {
  const start = params.get('start'); const end = params.get('end');
  validateRange(start, end);
  const today = todayInBrazil(now);
  const month = { start: today.slice(0, 7) + '-01', end: new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).toISOString().slice(0, 10) };
  const options = { env, fetcher, signal: AbortSignal.timeout(24000) };
  const companies = (await allPages('companies', {}, options)).map(row => ({ id: id(row.id), name: row.apelido }));
  const requestedCompany = params.get('company');
  const company = companies.find(row => row.id === requestedCompany) || (!requestedCompany && companies.length === 1 ? companies[0] : null);
  if (requestedCompany && !company) throw new PublicError(400, 'COMPANY', 'Selecione uma empresa disponível para este acesso.');
  if (!company) return { companies, needsCompany: true };

  let preferences; let settingsWarning = '';
  try { preferences = await settingsReader(company.id, { env, today }); }
  catch { settingsWarning = 'As configurações salvas não puderam ser lidas. Saldo, projeção e categorias ficam indisponíveis até a leitura ser restabelecida.'; }
  const settings = preferences?.settings || { costMapping: emptyCosts(), opening: null };
  const opening = settings.opening;
  const cashWhere = { and: [
    { minhaEmpresaId: { eq: Number(company.id) } },
    { contaContabil: { finalidade: { eq: 'CAIXA_BANCO' }, analiticaOuSintetica: { eq: 'ANALITICA' } } },
    { tipo: { in: ['CONTABIL_NORMAL', 'NAO_CONTABIL'] } },
    { data: { gte: opening?.date || today, lte: today } },
  ] };
  const [payable, receivable, cash, accountRows] = await Promise.all([
    allPages('payable', { where: titleFilter('out', company.id, { start, end }, month) }, options),
    allPages('receivable', { where: titleFilter('in', company.id, { start, end }, month) }, options),
    allPages('cash', { where: cashWhere }, options),
    allPages('accounts', {}, options),
  ]);
  const entries = [...payable.map(row => normalizeTitle(row, 'out')), ...receivable.map(row => normalizeTitle(row, 'in'))].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
  for (const field of ['amountCents', 'outstandingCents', 'paidCents']) safeSum(entries.map(row => Math.abs(row[field])));
  const signed = row => {
    if (!['DEBITO', 'CREDITO'].includes(row.debitoOuCredito)) throw new PublicError(502, 'CASH_FORMAT', 'Lançamento bancário inválido.');
    return cents(row.valor) * (row.debitoOuCredito === 'DEBITO' ? 1 : -1);
  };
  const bankBalanceCents = opening ? safeSum([opening.cents, ...cash.map(signed)]) : null;
  const outstanding = entries.filter(row => row.dueDate <= month.end);
  const projectionCents = bankBalanceCents === null ? null : safeSum([bankBalanceCents, ...outstanding.map(row => row.outstandingCents * (row.direction === 'in' ? 1 : -1))]);
  const daily = cash.filter(row => row.data === today);
  const incoming = daily.filter(row => row.contaAReceber && !row.contaAPagar);
  const outgoing = daily.filter(row => row.contaAPagar && !row.contaAReceber);
  const warnings = [
    'Fluxo e custos usam o vencimento dos títulos. Recebimentos e pagamentos do dia usam movimentos de caixa/bancos vinculados a títulos; transferências e movimentos sem vínculo ficam fora desses dois indicadores.',
    'Pedidos, cotações, propostas, retenções separadas, títulos em digitação, cancelados, agrupados, parcelados e compensados ficam fora dos totais de títulos. Confira a cobertura com o financeiro antes de usar os totais para decisões.',
  ];
  if (settingsWarning) warnings.unshift(settingsWarning);
  if (!opening) warnings.unshift('Saldo e projeção aguardam um saldo inicial consolidado de caixa/bancos desta empresa. Os valores de demonstração não são utilizados.');
  else warnings.unshift(`Saldo calculado a partir da abertura em ${opening.date}, antes dos movimentos daquele dia. Inclui contas analíticas com finalidade CAIXA_BANCO; confira a conciliação bancária.`);
  return {
    companies, company, today, month, range: { start, end }, entries,
    accounts: accountRows.map(row => ({ id: id(row.id), code: row.codigoEstruturado, name: row.descricao || 'Sem descrição', purpose: row.finalidade || null })),
    settings, settingsAvailable: Boolean(preferences),
    bankBalanceCents, projectionCents,
    daily: { incomingCents: safeSum(incoming.map(signed)), outgoingCents: safeSum(outgoing.map(row => -signed(row))), incomingCount: incoming.length, outgoingCount: outgoing.length },
    fetchedAt: now.toISOString(), warnings,
  };
}

export default async function handler(request) {
  try {
    requireSession(request);
    if (request.method !== 'GET') return json({ error: 'Método não permitido.' }, 405, { Allow: 'GET' });
    return json(await loadFinance(new URL(request.url).searchParams));
  } catch (error) { return failure(error); }
}

/** @type {import('@netlify/functions').Config} */
export const config = { path: '/api/finance', rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
