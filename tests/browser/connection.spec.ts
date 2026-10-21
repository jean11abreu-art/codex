import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-21T15:00:00Z'));
  if (process.env.NEXO_STANDALONE_TEST === '1') {
    const html = await readFile(fileURLToPath(new URL('../../painel.html', import.meta.url)), 'utf8');
    await page.route('**/portable-dashboard', route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto('/portable-dashboard');
  } else await page.goto('/');
});

test('configuração pendente orienta sem solicitar a chave da API', async ({ page }) => {
  await page.route('**/api/session', route => route.fulfill({ json: { configured: false, authenticated: false } }));
  await page.getByRole('button', { name: 'Acessar dados reais', exact: true }).click();
  await expect(page.getByText(/Crie a variável secreta/)).toBeVisible();
  await expect(page.locator('input')).toHaveCount(0);
  await page.screenshot({ path: '/tmp/premium-flex-access.png' });
});

test('login, dados reais parciais, erro sem fallback, troca de período e saída', async ({ page }) => {
  let signedIn = false; let fail = false; const financeQueries: URLSearchParams[] = [];
  await page.route('**/api/session', async route => {
    const method = route.request().method();
    if (method === 'POST') { expect(route.request().postDataJSON()).toEqual({ password: 'senha-apenas-do-teste' }); signedIn = true; }
    if (method === 'DELETE') signedIn = false;
    await route.fulfill({ json: { configured: true, authenticated: signedIn } });
  });
  await page.route('**/api/finance?*', async route => {
    const params = new URL(route.request().url()).searchParams; financeQueries.push(params);
    if (fail) { await route.fulfill({ status: 502, json: { error: 'O Maxiprod recusou o acesso.', code: 'UPSTREAM_AUTH' } }); return; }
    await route.fulfill({ json: {
      companies: [{ id: '1', name: 'Empresa de teste' }], company: { id: '1', name: 'Empresa de teste' },
      today: '2026-10-21', month: { start: '2026-10-01', end: '2026-10-31' }, range: { start: params.get('start'), end: params.get('end') },
      entries: [{ id: 'out-7', description: 'Frete real de teste', company: 'Transportadora de teste', direction: 'out', category: 'Despesa de transporte', accountId: '3', amountCents: 10000, outstandingCents: 6000, paidCents: 4000, dueDate: '2026-10-21', status: 'pending', boleto: true }],
      accounts: [{ id: '3', code: '3.1', name: 'Despesa de transporte' }], bankBalanceCents: null, projectionCents: null,
      daily: { incomingCents: 1234, outgoingCents: 4000, incomingCount: 1, outgoingCount: 1 },
      warnings: ['Saldo inicial pendente.'], fetchedAt: '2026-10-21T15:00:00Z',
    } });
  });
  await page.getByRole('button', { name: 'Acessar dados reais', exact: true }).click();
  await page.getByLabel('Senha de acesso').fill('senha-apenas-do-teste');
  await page.getByRole('button', { name: 'Entrar no painel' }).click();
  await expect(page.getByText('Maxiprod · acesso protegido', { exact: true })).toBeVisible();
  await expect(page.getByTestId('bank-balance')).toHaveText('A configurar');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText('Parcial');
  await expect(page.locator('tbody tr')).toContainText('Em aberto: R$ 60,00');
  await expect(page.getByRole('button', { name: /Contas a pagar.*período selecionado/ })).toContainText('R$ 60,00');
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByLabel('Contas de Frete', { exact: true }).selectOption(['3']);
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  await expect(page.locator('.cost-row').first()).toContainText('R$ 100,00');
  await page.getByRole('button', { name: 'Diário', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Diário', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(financeQueries.at(-1)?.get('start')).toEqual('2026-10-21');
  fail = true;
  await page.getByRole('button', { name: 'Atualizar Maxiprod' }).click();
  await expect(page.getByRole('alert')).toContainText('O Maxiprod recusou o acesso.');
  await expect(page.locator('tbody')).toHaveCount(0);
  await expect(page.getByText('Modo demonstração')).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page.getByText('Modo demonstração')).toBeVisible();
  expect(signedIn).toBe(false);
  const storage = await page.evaluate(() => JSON.stringify(localStorage));
  expect(storage).not.toContain('senha-apenas'); expect(storage).not.toContain('Transportadora de teste');
});

test('acesso em celular pequeno permanece dentro da tela', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.route('**/api/session', route => route.fulfill({ json: { configured: true, authenticated: false } }));
  await page.getByRole('button', { name: 'Acessar dados reais', exact: true }).click();
  await expect(page.getByLabel('Senha de acesso')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});
