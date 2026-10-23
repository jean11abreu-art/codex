import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date('2026-10-23T15:00:00Z'));});
async function openFunnel(page:import('@playwright/test').Page){await page.goto('/comercial');await page.getByRole('button',{name:'Funil de vendas',exact:true}).click();await expect(page.locator('.pf-stages article')).toHaveCount(4);}

test('aba fica ao lado de Roteiros e apresenta metas e gráficos',async({page})=>{
 await openFunnel(page);
 const nav=await page.locator('.pc-tabs button').allTextContents();expect(nav.slice(-2)).toEqual(['Roteiros','Funil de vendas']);
 await expect(page.locator('.pf-goals')).toContainText('30 ligações por dia');await expect(page.locator('.pf-goals')).toContainText('200.000,00');
 await expect(page.getByRole('img',{name:'Gráfico diário de ligações, propostas e pedidos'})).toBeVisible();await expect(page.getByRole('img',{name:'Gráfico de faturamento mensal com meta'})).toBeVisible();
 await expect(page.locator('.pf-ranking tbody tr')).toHaveCount(4);
 await page.getByLabel('Métrica do gráfico diário').selectOption('revenue');await expect(page.getByRole('img',{name:'Gráfico de faturamento diário'})).toBeVisible();
});
test('filtros de dia, mês, ano e representante recalculam o ranking',async({page})=>{
 await openFunnel(page);
 await page.getByLabel('Filtrar funil por dia').fill('2026-10-18');
 await expect(page.locator('.pf-stage').first().locator('strong')).toHaveText('0');
 await expect(page.locator('.pf-ranking tbody')).toContainText('Nenhum evento no período');
 await page.getByRole('button',{name:'Limpar filtros',exact:true}).click();
 await page.locator('.pf-filters').getByRole('combobox',{name:'Representante',exact:true}).selectOption({label:'Jean'});await expect(page.locator('.pf-ranking tbody tr')).toHaveCount(1);
 await page.locator('.pf-filters').getByRole('combobox',{name:'Ano',exact:true}).selectOption('2025');
 await page.locator('.pf-filters').getByRole('combobox',{name:'Mês',exact:true}).selectOption('02');
 await expect(page.locator('.pf-period-summary')).toContainText('01/02/2025 a 28/02/2025');
});
test('metas editáveis persistem e CSV contém o ranking',async({page})=>{
 await openFunnel(page);await page.getByRole('button',{name:'Metas',exact:true}).click();
 await page.getByLabel('Ligações por dia',{exact:true}).fill('35');await page.getByLabel('Faturamento por mês (R$)',{exact:true}).fill('250000');await page.getByRole('button',{name:'Salvar metas'}).click();
 await expect(page.locator('.pf-goals')).toContainText('35 ligações por dia');await page.reload();await page.getByRole('button',{name:'Funil de vendas',exact:true}).click();await expect(page.locator('.pf-goals')).toContainText('250.000,00');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar',exact:true}).click();expect((await download).suggestedFilename()).toBe('premiumflex-funil.csv');
});
test('erros da leitura do funil não viram demonstração',async({page})=>{
 await page.route('**/api/session',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({configured:true,authenticated:true})}));
 await page.route('**/api/commercial?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({clients:[],companies:[{id:'9',name:'Empresa'}],company:{id:'9',name:'Empresa'},range:{start:'2026-01-01',end:'2026-10-23'},fetchedAt:'2026-10-23T12:00:00Z'})}));
 let fail=false;
 await page.route('**/api/commercial-funnel?**',route=>route.fulfill({status:fail?502:200,contentType:'application/json',body:JSON.stringify(fail?{error:'Falha de teste da API.'}:{events:[],callsAvailable:false,callSubjects:[{id:'7',name:'Ligação comercial'}],range:{start:'2026-01-01',end:'2026-10-23'}})}));
 await page.goto('/comercial');await page.getByRole('button',{name:'Conectar Maxiprod'}).click();await page.getByRole('button',{name:'Consultar API'}).click();await page.getByRole('button',{name:'Funil de vendas',exact:true}).click();
 await expect(page.locator('.pf-stage').first()).toContainText('A configurar');
 fail=true;await page.locator('.pf-title-actions').getByRole('button',{name:'Atualizar',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Falha de teste da API.');await expect(page.locator('.pf-stages')).toHaveCount(0);
});

test('comentários viram ligações com resultado revisável e atualização imediata do funil',async({page})=>{
 await page.goto('/comercial');
 await page.getByRole('textbox',{name:'Comentário',exact:true}).fill('Falei com o comprador e confirmei os itens.');
 await page.getByRole('button',{name:'Salvar comentário'}).click();
 const note=page.locator('.pc-timeline li').first();
 await expect(note.locator('.pc-call-badge')).toHaveText('Com sucesso');
 await page.getByRole('button',{name:'Funil de vendas',exact:true}).click();
 await page.getByLabel('Filtrar funil por dia').fill('2026-10-23');
 await expect(page.locator('.pf-stage').first().locator('strong')).toHaveText('1');
 await expect(page.locator('.pf-call-results .success strong')).toHaveText('1');
 await page.getByRole('button',{name:/Comentários · IA/}).click();
 await page.locator('.pc-timeline li').first().getByRole('combobox').selectOption('failure');
 await expect(page.locator('.pc-timeline li').first().locator('.pc-call-badge')).toHaveText('Sem sucesso');
 await page.getByRole('button',{name:'Funil de vendas',exact:true}).click();
 await page.getByLabel('Filtrar funil por dia').fill('2026-10-23');
 await expect(page.locator('.pf-call-results .failure strong')).toHaveText('1');
 await expect(page.locator('.pf-call-results .success strong')).toHaveText('0');
 await page.reload();await expect(page.locator('.pc-timeline li').first().locator('.pc-call-badge')).toHaveText('Sem sucesso');
});
