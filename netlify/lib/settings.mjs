import { getStore } from '@netlify/blobs';
import { PublicError } from './http.mjs';
import { validDate } from './maxiprod.mjs';

export const COST_CATEGORIES = ['Frete', 'Salários', 'Financiamento'];
export const emptyCosts = () => Object.fromEntries(COST_CATEGORIES.map(category => [category, []]));
export const todayInBrazil = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
const keyFor = companyId => `company-${companyId}`;
const storageError = () => new PublicError(503, 'SETTINGS_STORAGE', 'Não foi possível acessar as configurações salvas. Tente novamente; o saldo e a projeção ficam pausados até a leitura ser restabelecida.');
function store() { return getStore({ name: 'premium-flex-finance-settings', consistency: 'strong' }); }

export function validateSettings(value, today = todayInBrazil(), accountIds) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PublicError(400, 'SETTINGS_INVALID', 'Informe as configurações financeiras.');
  const mapping = value.costMapping;
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping) || Object.keys(mapping).length !== 3 || COST_CATEGORIES.some(category => !Object.hasOwn(mapping, category))) {
    throw new PublicError(400, 'COST_MAPPING', 'Informe as três categorias de custo.');
  }
  const seen = new Set(); const costMapping = emptyCosts();
  for (const category of COST_CATEGORIES) {
    if (!Array.isArray(mapping[category]) || mapping[category].length > 100) throw new PublicError(400, 'COST_MAPPING', 'Selecione até 100 contas por categoria.');
    for (const accountId of mapping[category]) {
      if (typeof accountId !== 'string' || !/^[1-9]\d{0,15}$/.test(accountId) || !Number.isSafeInteger(Number(accountId))) throw new PublicError(400, 'COST_MAPPING', 'Selecione contas válidas do plano de contas.');
      if (seen.has(accountId)) throw new PublicError(400, 'COST_DUPLICATE', 'Uma conta pode pertencer a somente uma categoria. Revise a seleção.');
      if (accountIds && !accountIds.has(accountId)) throw new PublicError(400, 'COST_ACCOUNT_MISSING', 'Uma conta selecionada não está mais disponível. Recarregue as configurações.');
      seen.add(accountId); costMapping[category].push(accountId);
    }
  }
  let opening = null;
  if (value.opening !== null) {
    const candidate = value.opening;
    if (!candidate || !validDate(candidate.date) || candidate.date > today || !Number.isSafeInteger(candidate.cents) || Math.abs(candidate.cents) > 100_000_000_000) {
      throw new PublicError(400, 'OPENING_INVALID', 'Informe uma data válida até hoje e um saldo de até R$ 1 bilhão, em centavos inteiros.');
    }
    opening = { date: candidate.date, cents: candidate.cents };
  }
  return { costMapping, opening };
}

export function environmentOpening(companyId, env = process.env, today = todayInBrazil()) {
  if (!env.MAXIPROD_OPENING_BALANCES) return null;
  let values; try { values = JSON.parse(env.MAXIPROD_OPENING_BALANCES); } catch { throw new PublicError(503, 'BALANCE_CONFIG', 'Revise o JSON de MAXIPROD_OPENING_BALANCES no Netlify.'); }
  const opening = values?.[companyId] ?? null;
  try { return validateSettings({ costMapping: emptyCosts(), opening }, today).opening; }
  catch { throw new PublicError(503, 'BALANCE_CONFIG', 'Revise a data e o valor do saldo inicial configurado no Netlify.'); }
}

export async function readSettings(companyId, { env = process.env, today = todayInBrazil(), storage } = {}) {
  let record;
  try { record = await (storage || store()).getWithMetadata(keyFor(companyId), { type: 'json', consistency: 'strong' }); }
  catch { throw storageError(); }
  if (!record) return { settings: { costMapping: emptyCosts(), opening: environmentOpening(companyId, env, today) }, version: null, source: env.MAXIPROD_OPENING_BALANCES ? 'environment' : 'empty', savedAt: null };
  try {
    if (record.data?.format !== 1 || typeof record.etag !== 'string' || !record.etag) throw new Error('Invalid record');
    return { settings: validateSettings(record.data.settings, today), version: record.etag, source: 'saved', savedAt: record.data.savedAt };
  } catch { throw storageError(); }
}

export async function saveSettings(companyId, settings, expectedVersion, { storage, now = new Date() } = {}) {
  if (expectedVersion !== null && (typeof expectedVersion !== 'string' || !expectedVersion || expectedVersion.length > 256 || /[\r\n]/.test(expectedVersion))) {
    throw new PublicError(400, 'SETTINGS_VERSION', 'Recarregue as configurações antes de salvar.');
  }
  const savedAt = now.toISOString(); let result;
  try {
    result = await (storage || store()).setJSON(keyFor(companyId), { format: 1, settings, savedAt }, expectedVersion === null ? { onlyIfNew: true } : { onlyIfMatch: expectedVersion });
  } catch { throw storageError(); }
  if (!result.modified) throw new PublicError(409, 'SETTINGS_CONFLICT', 'Outra pessoa alterou estas configurações. Recarregue antes de salvar novamente.');
  if (!result.etag) throw storageError();
  return { settings, version: result.etag, source: 'saved', savedAt };
}
