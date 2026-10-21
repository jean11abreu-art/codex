import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

test('HTML autocontido renderiza sem servidor nem assets externos', async ({ page }) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-10-21T15:00:00Z'));
  const html = await readFile(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf8');
  await page.setContent(html);
  await expect(page.getByRole('heading', { name: 'Seu financeiro, em perspectiva.' })).toBeVisible();
  await page.getByRole('button', { name: 'Diário', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(3);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

test('HTML autocontido funciona em iframe isolado com origem opaca', async ({ page }) => {
  const html = await readFile(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf8');
  const requests: string[] = [];
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  await page.setContent('<iframe title="Prévia financeira" sandbox="allow-scripts allow-downloads" style="width:1200px;height:900px;border:0"></iframe>');
  await page.locator('iframe').evaluate((frame, contents) => { (frame as HTMLIFrameElement).srcdoc = contents; }, html);
  const frame = page.frameLocator('iframe');
  await expect(frame.getByRole('heading', { name: 'Seu financeiro, em perspectiva.' })).toBeVisible();
  await frame.getByRole('button', { name: 'Filtros', exact: true }).click();
  await frame.getByLabel('Situação do lançamento').selectOption('pending');
  await frame.getByRole('button', { name: 'Configurações', exact: true }).click();
  await frame.getByLabel('Saldo inicial em reais').fill('-900000');
  await frame.getByRole('button', { name: 'Salvar saldo inicial' }).click();
  await expect(frame.getByText('Saldo negativo', { exact: true })).toBeVisible();
  expect(requests).toEqual([]);
});

test('painel já mostra os indicadores mesmo sem executar JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    const html = await readFile(fileURLToPath(new URL('../../painel.html', import.meta.url)), 'utf8');
    await page.route('http://nexo-preview.test/', route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto('http://nexo-preview.test/');
    await expect(page.getByRole('heading', { name: 'Seu financeiro, em perspectiva.' })).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(5);
    await expect(page.locator('noscript p')).toBeVisible();
    await expect(page.locator('noscript p')).toContainText('Visualização estática.');
    await page.getByRole('button', { name: 'Diário', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(5);
    await page.screenshot({ path: '/tmp/nexo-static-preview.png', fullPage: true });
  } finally {
    await context.close();
  }
});
