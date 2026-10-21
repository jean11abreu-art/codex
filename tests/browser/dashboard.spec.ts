import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-21T15:00:00Z'));
  if (process.env.NEXO_STANDALONE_TEST === '1') {
    const html = await readFile(fileURLToPath(new URL('../../painel.html', import.meta.url)), 'utf8');
    await page.route('**/portable-dashboard', route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto('/portable-dashboard');
  } else {
    await page.goto('/');
  }
});

test('painel, gráfico, períodos e datas inválidas', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await expect(page.getByRole('heading', { name: 'Seu financeiro, em perspectiva.' })).toBeVisible();
  await expect(page.getByText('Modo demonstração')).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(5);
  await page.getByRole('button', { name: 'Diário', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await page.getByRole('button', { name: 'Anual', exact: true }).click();
  await expect(page.getByText('218 lançamentos', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mensal', exact: true }).click();
  await page.getByRole('button', { name: 'Resultado', exact: true }).click();
  await expect(page.getByRole('img', { name: /resultado acumulado/ })).toBeVisible();
  await page.getByLabel('Data início', { exact: true }).fill('2026-11-01');
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('período válido');
  await page.getByLabel('Data fim', { exact: true }).fill('2026-11-30');
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('18 lançamentos', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('busca, abas, paginação e exportação', async ({ page }) => {
  const first = await page.locator('tbody tr').first().innerText();
  await page.getByRole('button', { name: 'Próxima página' }).click();
  expect(await page.locator('tbody tr').first().innerText()).not.toEqual(first);
  await page.getByLabel('Buscar lançamento').fill('Horizonte');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'Limpar busca' }).click();
  await page.getByRole('button', { name: 'A receber', exact: true }).click();
  await expect(page.locator('tbody tr').first()).toContainText('Entrada');
  await page.getByRole('button', { name: 'Filtros', exact: true }).click();
  await page.getByLabel('Situação do lançamento').selectOption('pending');
  await expect(page.locator('tbody tr').first()).toContainText(/Em atraso|Em aberto/);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar relatório' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toEqual('nexo-financeiro-2026-10-01-2026-10-31.csv');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const data = Buffer.concat(chunks).toString('utf8');
  expect(data).toContain('Receber');
  expect(data).not.toContain('Pagar');
  expect(data).not.toContain('Liquidado');
});

test('saldo inicial, projeção negativa e persistência', async ({ page }) => {
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByLabel('Saldo inicial em reais').fill('-900000');
  await page.getByRole('button', { name: 'Salvar saldo inicial' }).click();
  await expect(page.getByText('Saldo negativo', { exact: true })).toBeVisible();
  const value = await page.getByTestId('bank-balance').innerText();
  await page.reload();
  await expect(page.getByTestId('bank-balance')).toHaveText(value!);
  await page.getByRole('button', { name: 'Integração Maxiprod' }).click();
  await expect(page.getByRole('dialog')).toContainText('Aguardando configuração da API');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('período vazio e captura desktop', async ({ page }) => {
  await page.screenshot({ path: '/tmp/nexo-desktop.png', fullPage: true, animations: 'disabled' });
  await page.getByLabel('Data início', { exact: true }).fill('2027-01-01');
  await page.getByLabel('Data fim', { exact: true }).fill('2027-01-31');
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(page.getByText('Nenhum lançamento encontrado')).toBeVisible();
  await expect(page.locator('.chart-summary')).toContainText('0,00');
  await expect(page.getByRole('button', { name: 'Próxima página' })).toBeDisabled();
});

test('celular sem transbordamento e navegação', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await page.getByRole('button', { name: 'Contas a receber', exact: true }).click();
  await expect(page.getByRole('button', { name: /A receber/, exact: false }).last()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.sidebar')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, -235, 0)');
  await page.screenshot({ path: '/tmp/nexo-mobile.png', fullPage: true, animations: 'disabled' });
});
