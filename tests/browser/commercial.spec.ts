import { test,expect } from '@playwright/test';
test('busca e filtros mantêm a seleção do cliente consistente',async({page})=>{
 await page.goto('/comercial');
 await expect(page.getByRole('heading',{name:'Mais contexto. Melhores oportunidades.'})).toBeVisible();
 await expect(page.locator('.pc-client')).toHaveCount(8);
 await page.getByRole('button',{name:'Frios',exact:true}).click();
 await expect(page.locator('.pc-client')).toHaveCount(2);
 await expect(page.locator('.pc-detail h2')).toHaveText('FLORESTAL NOVO CAMINHO');
 await page.getByRole('button',{name:'Limpar filtros',exact:true}).click();
 await page.getByLabel('Buscar cliente').fill('Metalúrgica');
 await expect(page.locator('.pc-client')).toHaveCount(1);
 await expect(page.locator('.pc-detail h2')).toHaveText('METALÚRGICA SERRA AZUL');
 await page.getByLabel('Buscar cliente').fill('inexistente');
 await expect(page.getByText('Nenhum cliente encontrado')).toBeVisible();
});
test('comentários e roteiros demonstrativos persistem ao recarregar',async({page})=>{
 await page.goto('/comercial');
 await page.getByRole('textbox',{name:'Comentário',exact:true}).fill('Retornar com prazo na próxima semana.');
 await page.getByRole('button',{name:'Salvar comentário'}).click();
 await expect(page.locator('.pc-timeline')).toContainText('Retornar com prazo na próxima semana.');
 await page.getByRole('button',{name:'Adicionar ao roteiro'}).click();
 await page.reload();
 await expect(page.locator('.pc-timeline')).toContainText('Retornar com prazo na próxima semana.');
 await page.getByRole('button',{name:'Roteiros',exact:true}).click();
 await expect(page.locator('.pc-routes article')).toHaveCount(1);
 await page.getByRole('button',{name:/Remover INDÚSTRIA/}).click();
 await expect(page.getByText('Seu próximo roteiro começa aqui')).toBeVisible();
});
test('curva ABC, exportação e navegação funcionam',async({page})=>{
 await page.goto('/comercial');
 await page.getByRole('button',{name:'Curva ABC',exact:true}).click();
 await expect(page.locator('tbody tr')).toHaveCount(8);
 await expect(page.locator('tbody tr').last()).toContainText('100,0%');
 const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar ABC'}).click();
 expect((await downloaded).suggestedFilename()).toBe('premiumflex-curva-abc.csv');
 await page.getByRole('button',{name:'Clientes inativos',exact:true}).click();
 await expect(page.locator('.pc-actions-grid article')).toHaveCount(2);
});
test('falha na API é explícita e não apresenta conexão real',async({page})=>{
 await page.route('**/api/session',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({configured:true,authenticated:true})}));
 await page.route('**/api/commercial?**',route=>route.fulfill({status:502,contentType:'application/json',body:JSON.stringify({error:'Maxiprod indisponível no teste.'})}));
 await page.goto('/comercial');await page.getByRole('button',{name:'Conectar Maxiprod'}).click();await page.getByRole('button',{name:'Consultar API'}).click();
 await expect(page.getByRole('alert')).toHaveText('Maxiprod indisponível no teste.');await expect(page.locator('.pc-demo')).toHaveText('DEMONSTRAÇÃO');
});
test('dados reais de teste não são persistidos no armazenamento demonstrativo',async({page})=>{
 await page.route('**/api/session',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({configured:true,authenticated:true})}));
 await page.route('**/api/commercial?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({clients:[{id:'123',name:'Cliente privado de teste',city:'Canoas, RS',representative:'Jean',active:true,quotes:1,quoted:10000,invoices:1,invoiced:5000,last:'',comments:[]}],companies:[{id:'9',name:'Empresa teste'}],company:{id:'9',name:'Empresa teste'},range:{start:'2026-01-01',end:'2026-10-22'},fetchedAt:'2026-10-23T10:00:00Z',warnings:[]})}));
 await page.goto('/comercial');await page.getByRole('button',{name:'Conectar Maxiprod'}).click();await page.getByRole('button',{name:'Consultar API'}).click();
 await expect(page.locator('.pc-demo')).toHaveText('MAXIPROD CONECTADO');await expect(page.locator('.pc-detail h2')).toHaveText('Cliente privado de teste');
 await expect(page.getByRole('button',{name:'Salvar comentário'})).toHaveCount(0);
 await expect(page.locator('.pc-detail-metrics')).toContainText('Sem interação registrada');
 await page.getByRole('button',{name:'Adicionar ao roteiro'}).click();
 expect(await page.evaluate(()=>localStorage.getItem('premiumflex-commercial-demo-v1'))).toBeNull();
});
