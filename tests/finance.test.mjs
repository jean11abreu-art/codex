import test from 'node:test';
import assert from 'node:assert/strict';
import { actualBalance, aggregate, csv, dateKey, inRange, monthRange, projectedBalance, total } from '../src/finance.mjs';

const entries = [
  { description: 'Recebimento', direction: 'in', amountCents: 10000, dueDate: '2026-10-01', settledDate: '2026-10-01', status: 'paid' },
  { direction: 'out', amountCents: 4000, dueDate: '2026-10-05', settledDate: '2026-10-05', status: 'paid' },
  { direction: 'out', amountCents: 12000, dueDate: '2026-10-10', status: 'pending' },
  { direction: 'in', amountCents: 3000, dueDate: '2026-10-31', status: 'pending' },
  { direction: 'out', amountCents: 50000, dueDate: '2026-11-01', status: 'pending' },
];

test('saldo considera somente liquidações até a data consultada', () => {
  assert.equal(actualBalance(entries, 1000, '2026-10-03'), 11000);
  assert.equal(actualBalance(entries, 1000, '2026-10-21'), 7000);
});
test('projeção inclui atrasados, exclui próximo mês e permite saldo negativo', () => {
  assert.equal(projectedBalance(entries, 1000, '2026-10-21', '2026-10-31'), -2000);
});
test('intervalo inclusivo e totais em centavos', () => {
  const selected = inRange(entries, '2026-10-01', '2026-10-31');
  assert.equal(selected.length, 4);
  assert.equal(total(selected, 'in'), 13000);
  assert.equal(total(selected, 'out', 'pending'), 12000);
  assert.equal(total([]), 0);
});
test('agrupamentos diário e anual preservam totais e intervalos vazios', () => {
  const points = aggregate(entries, '2026-10-01', '2026-10-31', 'month');
  assert.equal(points.reduce((sum, point) => sum + point.incoming, 0), 13000);
  assert.equal(points.reduce((sum, point) => sum + point.outgoing, 0), 16000);
  assert.equal(aggregate(entries, '2026-01-01', '2026-12-31', 'year').length, 12);
  assert.equal(aggregate([], '2026-10-21', '2026-10-21', 'day')[0].incoming, 0);
});
test('datas locais e fim de mês bissexto', () => {
  assert.equal(dateKey(new Date(2026, 9, 21)), '2026-10-21');
  assert.deepEqual(monthRange(new Date(2028, 1, 10)), { start: '2028-02-01', end: '2028-02-29' });
});
test('CSV mantém valores brasileiros e escapa aspas e fórmulas', () => {
  const output = csv([{ ...entries[0], description: '=HYPERLINK("x")', category: 'Vendas' }]);
  assert.ok(output.startsWith('\uFEFF'));
  assert.ok(output.includes("\"'=HYPERLINK(\"\"x\"\")\""));
  assert.ok(output.includes('"100,00"'));
});
