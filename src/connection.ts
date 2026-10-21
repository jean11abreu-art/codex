import type { Entry } from './data';
export type Range = { start: string; end: string };
export type Company = { id: string; name: string };
export type FinancialSettingsData = { costMapping: CostMapping; opening: { date: string; cents: number } | null };
export type Account = { id: string; code: string; name: string; purpose?: string | null };
export type LiveData = {
  companies: Company[]; company: Company; today: string; month: Range; range: Range;
  entries: Entry[]; accounts: Account[];
  bankBalanceCents: number | null; projectionCents: number | null;
  daily: { incomingCents: number; outgoingCents: number; incomingCount: number; outgoingCount: number };
  warnings: string[]; fetchedAt: string;
  settings?: FinancialSettingsData; settingsAvailable?: boolean;
};
export type CostMapping = Record<'Frete' | 'Salários' | 'Financiamento', string[]>;
export const emptyMapping: CostMapping = { Frete: [], 'Salários': [], Financiamento: [] };

export async function api(path: string, options?: RequestInit) {
  const response = await fetch(path, { ...options, credentials: 'same-origin', cache: 'no-store', redirect: 'error' });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('A conexão segura precisa ser publicada pelo GitHub no Netlify.');
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || 'Falha ao consultar o servidor.') as Error & { code?: string };
    error.code = result.code;
    throw error;
  }
  return result;
}
