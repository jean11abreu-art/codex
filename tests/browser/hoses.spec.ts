import { test, expect } from '@playwright/test';

test('salva, reabre e altera uma ordem sem duplicar o contador', async ({ page }) => {
 await page.goto('/');
 await expect(page.getByRole('heading', {name:'Montagem de mangueiras hidráulicas',exact:true})).toBeVisible();
 await expect(page.locator('.hose-sheet tbody tr')).toHaveCount(10);
 await page.getByLabel('Cliente',{exact:true}).fill('Cliente de teste');
 await page.getByLabel('Pedido de venda',{exact:true}).fill('PV-123');
 await page.getByLabel('hose item 1',{exact:true}).fill('SAE 100 R2');
 await page.getByRole('button',{name:'Acrescentar item'}).click();
 await expect(page.locator('.hose-sheet tbody tr')).toHaveCount(11);
 await page.getByRole('button',{name:'Salvar ordem'}).click();
 await expect(page.getByRole('status')).toContainText('Ordem 0001 salva');
 await page.reload();
 await page.getByRole('button',{name:/0001 · Cliente de teste/}).click();
 await expect(page.getByLabel('Pedido de venda',{exact:true})).toHaveValue('PV-123');
 await expect(page.locator('.hose-sheet tbody tr')).toHaveCount(11);
 await page.getByLabel('Nome do equipamento',{exact:true}).fill('Escavadeira');
 await page.getByRole('button',{name:'Salvar ordem'}).click();
 await expect(page.locator('.hose-stats strong').first()).toHaveText('01');
 await page.emulateMedia({media:'print'});
 await expect(page.locator('.hose-sidebar')).toBeHidden();
 await expect(page.locator('.hose-sheet')).toBeVisible();
 await page.pdf({path:'/tmp/premium-plus-ordem.pdf',format:'A4',preferCSSPageSize:true});
});

test('pesquisas mantêm mangueiras e terminais em catálogos separados',async ({page})=>{
 await page.goto('/');
 await page.getByLabel('Mangueiras (36)',{exact:false}).setInputFiles({name:'mangueiras.csv',mimeType:'text/csv',buffer:Buffer.from('SAE 100 R1\nSAE 100 R2')});
 await page.getByLabel('Terminais hidráulicos (386)',{exact:false}).setInputFiles({name:'terminais.csv',mimeType:'text/csv',buffer:Buffer.from('Terminal JIC 90\nTerminal BSP reto')});
 await expect(page.locator('#hose-catalog option')).toHaveCount(2);
 await expect(page.locator('#terminal-catalog option')).toHaveCount(2);
 await expect(page.locator('#hose-catalog')).not.toContainText('Terminal');
 await expect(page.getByLabel('a item 1',{exact:true})).toHaveAttribute('list','terminal-catalog');
 await expect(page.getByLabel('hose item 1',{exact:true})).toHaveAttribute('list','hose-catalog');
 await page.reload();
 await expect(page.locator('#terminal-catalog option')).toHaveCount(2);
});

 test('carrega os catálogos reais e pesquisa capas separadamente', async ({page})=>{
 await page.goto('/');
 await expect(page.locator('#hose-catalog option')).toHaveCount(36);
 await expect(page.locator('#terminal-catalog option')).toHaveCount(386);
 await expect(page.locator('#cover-catalog option')).toHaveCount(22);
 await expect(page.locator('#terminal-catalog option').first()).toHaveAttribute('value','3294 — TERMINAL  BANJO 18 X 3/8 PR');
 await expect(page.getByLabel('capa item 1',{exact:true})).toHaveAttribute('list','cover-catalog');
 await page.getByLabel('hose item 1',{exact:true}).fill('MANGUEIRA SAE 100R1AT- 1/4"-04');
 await page.getByLabel('a item 1',{exact:true}).fill('3294 — TERMINAL  BANJO 18 X 3/8 PR');
 await page.getByLabel('Cliente',{exact:true}).fill('Teste catálogo');
 await page.getByRole('button',{name:'Salvar ordem'}).click();
 await page.reload();
 await page.getByRole('button',{name:/0001 · Teste catálogo/}).click();
 await expect(page.getByLabel('a item 1',{exact:true})).toHaveValue('3294 — TERMINAL  BANJO 18 X 3/8 PR');
 });

test('agrupa montagens, soma materiais e preserva posições diferentes',async ({page})=>{
 await page.goto('/');
 await page.getByLabel('Cliente',{exact:true}).fill('Agrupamento');
 for(const [index,quantity,position] of [[1,'2','90º'],[2,'3','90º'],[3,'1','180º']] as const){
  await page.getByLabel(`hose item ${index}`,{exact:true}).fill('Mangueira R2');
  await page.getByLabel(`capa item ${index}`,{exact:true}).fill('Capa R2');
  await page.getByLabel(`a item ${index}`,{exact:true}).fill('Terminal JIC');
  await page.getByLabel(`b item ${index}`,{exact:true}).fill('Terminal JIC');
  await page.getByLabel(`length item ${index}`,{exact:true}).fill('1500');
  await page.getByLabel(`quantity item ${index}`,{exact:true}).fill(quantity);
  await page.getByLabel(`Posição item ${index}`,{exact:true}).selectOption(position);
 }
 await expect(page.locator('.grouped-table tbody tr')).toHaveCount(2);
 await expect(page.locator('.grouped-table tbody tr').first().locator('td').last()).toHaveText('5');
 await expect(page.locator('.materials-table tbody tr').filter({hasText:'Terminal JIC'})).toContainText('12 un.');
 await expect(page.locator('.materials-table tbody tr').filter({hasText:'Capa R2'})).toContainText('12 un.');
 await expect(page.locator('.materials-table tbody tr').filter({hasText:'Mangueira R2'})).toContainText('9 m');
 await page.getByRole('button',{name:'Salvar ordem'}).click();
 await page.reload();
 await page.getByRole('button',{name:/0001 · Agrupamento/}).click();
 await expect(page.getByLabel('Posição item 3',{exact:true})).toHaveValue('180º');
 await expect(page.locator('.grouped-table tbody tr')).toHaveCount(2);
 await page.getByLabel('quantity item 1',{exact:true}).fill('0');
 await expect(page.getByRole('alert')).toContainText('Corrija as quantidades');
 await expect(page.locator('.grouped-table')).toHaveCount(0);
});
