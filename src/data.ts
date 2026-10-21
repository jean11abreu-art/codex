import { dateKey } from './finance.mjs';

export type Entry = {
  id: string;
  description: string;
  company: string;
  direction: 'in' | 'out';
  category: string;
  amountCents: number;
  dueDate: string;
  settledDate?: string;
  status: 'paid' | 'pending';
  boleto: boolean;
};

export const OPENING_BALANCE_CENTS = 8250000;

export function createDemoEntries(now: Date): Entry[] {
  const today = dateKey(now);
  const rows: Entry[] = [];
  const clients = ['Horizonte Indústria', 'Grupo Nova Era', 'Atlas Comercial', 'Vértice Soluções', 'Prisma Distribuidora', 'Lumina Comércio'];
  for (let month = 0; month < 12; month++) {
    for (let index = 0; index < 18; index++) {
      const day = Math.min(2 + Math.floor(index * 1.6), new Date(now.getFullYear(), month + 1, 0).getDate());
      const dueDate = dateKey(new Date(now.getFullYear(), month, day));
      const direction = index % 3 === 0 ? 'out' : 'in';
      const status = dueDate <= today && !(month === now.getMonth() && index === 5) ? 'paid' : 'pending';
      const category = direction === 'in' ? 'Vendas' : ['Frete', 'Salários', 'Financiamento'][Math.floor(index / 3) % 3];
      rows.push({ id: `${month}-${index}`, description: direction === 'in' ? `Venda de produtos · NF ${4200 + month * 20 + index}` : { Frete: 'Frete e distribuição', Salários: 'Folha de pagamento', Financiamento: 'Parcela de financiamento' }[category]!, company: direction === 'in' ? clients[index % clients.length] : { Frete: 'Translog Transportes', Salários: 'Equipe e colaboradores', Financiamento: 'Banco Itaú' }[category]!, direction, category, amountCents: direction === 'in' ? 258000 + ((index * 1793 + month * 839) % 470000) : category === 'Salários' ? 1245000 : category === 'Financiamento' ? 437500 : 185000 + ((index * 2141 + month * 127) % 160000), dueDate, settledDate: status === 'paid' ? dueDate : undefined, status, boleto: direction === 'in' && index % 2 === 0 });
    }
  }
  // A representative receipt and payment for the current day, even on days without scheduled titles.
  rows.push({ id: 'today-receipt', description: 'Recebimento de venda · NF 4892', company: 'Horizonte Indústria', direction: 'in', category: 'Vendas', amountCents: 1285000, dueDate: today, settledDate: today, status: 'paid', boleto: true });
  rows.push({ id: 'today-payment', description: 'Coleta e transporte de mercadorias', company: 'Translog Transportes', direction: 'out', category: 'Frete', amountCents: 237500, dueDate: today, settledDate: today, status: 'paid', boleto: false });
  return rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
