export function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function monthRange(date) {
  return { start: dateKey(new Date(date.getFullYear(), date.getMonth(), 1)), end: dateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0)) };
}

export function inRange(items, start, end) {
  return items.filter(item => item.dueDate >= start && item.dueDate <= end);
}

export function total(items, direction, status) {
  return items.filter(item => !direction || item.direction === direction).reduce((sum, item) => {
    if (status === 'pending' && item.outstandingCents !== undefined) return sum + item.outstandingCents;
    if (status === 'paid' && item.paidCents !== undefined) return sum + item.paidCents;
    return sum + (!status || item.status === status ? item.amountCents : 0);
  }, 0);
}

export function actualBalance(items, openingCents, today) {
  const settled = items.filter(item => item.status === 'paid' && item.settledDate <= today);
  return openingCents + total(settled, 'in') - total(settled, 'out');
}

export function projectedBalance(items, openingCents, today, end) {
  // Include overdue open titles: they remain cash obligations even after their due date.
  const outstanding = items.filter(item => item.status === 'pending' && item.dueDate <= end);
  return actualBalance(items, openingCents, today) + total(outstanding, 'in') - total(outstanding, 'out');
}

export function aggregate(items, start, end, mode) {
  const groups = new Map();
  const cursor = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  const monthly = mode === 'year' || (last - cursor) / 86400000 > 62;
  const weekly = !monthly && (last - cursor) / 86400000 > 14;
  const keyFor = key => monthly ? key.slice(0, 7) : weekly ? `${key.slice(0, 7)}-${String(Math.floor((Number(key.slice(8)) - 1) / 5) * 5 + 1).padStart(2, '0')}` : key;
  for (; cursor <= last; cursor.setDate(cursor.getDate() + 1)) {
    const key = keyFor(dateKey(cursor));
    if (!groups.has(key)) groups.set(key, { key, label: monthly ? new Date(`${key}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') : `${key.slice(8)} ${new Date(`${key.slice(0, 7)}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}`, incoming: 0, outgoing: 0 });
  }
  for (const item of inRange(items, start, end)) {
    const group = groups.get(keyFor(item.dueDate));
    if (group) group[item.direction === 'in' ? 'incoming' : 'outgoing'] += item.amountCents;
  }
  return [...groups.values()];
}

export function csv(items) {
  const escape = value => `"${String(value).replace(/^\s*[=+@\-]/, "'$&").replaceAll('"', '""')}"`;
  const real = items.some(item => item.outstandingCents !== undefined);
  const amount = value => (value / 100).toFixed(2).replace('.', ',');
  const rows = [['Descrição', 'Tipo', 'Categoria', 'Vencimento', 'Situação', 'Valor (R$)', ...(real ? ['Em aberto (R$)', 'Liquidado líquido (R$)'] : [])], ...items.map(item => [item.description, item.direction === 'in' ? 'Receber' : 'Pagar', item.category, item.dueDate, item.status === 'paid' ? 'Liquidado' : item.paidCents > 0 ? 'Parcial' : 'Em aberto', amount(item.amountCents), ...(real ? [amount(item.outstandingCents || 0), amount(item.paidCents || 0)] : [])])];
  return '\uFEFF' + rows.map(row => row.map(escape).join(';')).join('\r\n');
}
