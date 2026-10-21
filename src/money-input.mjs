export function parseRealInput(value) {
  // Brazilian notation: 1.234,56, 1234,56, 1234 and negative balances.
  const text = value.trim();
  if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text)) throw new Error('Informe o saldo em reais, usando vírgula para os centavos.');
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace(/^-/, '').replaceAll('.', '').split(',');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents > 100_000_000_000n) throw new Error('Informe um saldo de até R$ 1 bilhão.');
  return Number(cents) * (negative ? -1 : 1);
}
