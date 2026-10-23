import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildSchema,parse,validate,coerceInputValue} from 'graphql';
import {eventDay,funnelQueries,funnelData,normalizeFunnel} from '../netlify/lib/commercial-funnel.mjs';
import {summarizeFunnel,groupFunnel,rankRepresentatives} from '../src/funnel-model.mjs';
import handler from '../netlify/functions/commercial-funnel.mjs';
const schema=buildSchema(readFileSync(new URL('../docs/maxiprod/schema.graphql',import.meta.url),'utf8'));
const rep={id:10,apelido:'Jean'};
const invoice=(id,date,amount)=>({id,emissaoData:date,valorTotal:amount,estado:'EMITIDA',destinatarioOuRemetenteId:1,representanteOuVendedor1:rep});
test('consultas do funil são fixas, somente leitura e válidas no esquema fornecido',()=>{
 for(const query of Object.values(funnelQueries)){const document=parse(query);assert.deepEqual(validate(schema,document),[]);assert(document.definitions.every(d=>d.operation==='query'));}
});
test('notas parciais somam valores e não duplicam o mesmo pedido no período',()=>{
 const events=normalizeFunnel({start:'2026-10-01',end:'2026-10-31',billed:[invoice(1,'2026-10-02','100.01'),invoice(2,'2026-10-03','50.02')],invoiceItems:[{id:11,notaFiscalId:1,itemDoPedidoDeVenda:{pedidoDeVendaId:8}},{id:12,notaFiscalId:1,itemDoPedidoDeVenda:{pedidoDeVendaId:8}},{id:13,notaFiscalId:2,itemDoPedidoDeVenda:{pedidoDeVendaId:8}}]});
 assert.equal(summarizeFunnel(events).orders,1);assert.equal(summarizeFunnel(events).invoices,2);assert.equal(summarizeFunnel(events).revenue,15003);
 const grouped=groupFunnel(events,'2026-10-01','2026-10-03','day');assert.equal(grouped.length,3);assert.equal(grouped[0].revenue,0);assert.equal(grouped[1].orders,1);assert.equal(grouped[2].orders,1);
});
test('ligações usam conclusão em São Paulo e o representante vinculado ao responsável',()=>{
 const events=normalizeFunnel({start:'2026-10-01',end:'2026-10-31',callSubjectId:'7',calls:[{id:1,empresaId:55,assuntoId:7,tipo:'TAREFA',tarefaEstado:'FINALIZADA',conclusaoData:'2026-10-03T01:00:00Z',responsavel:{id:8,apelido:'Usuário Jean',empresaRepresentante:rep}},{id:2,empresaId:55,assuntoId:7,tipo:'TAREFA',tarefaEstado:'FINALIZADA',conclusaoData:'2026-10-03T02:00:00Z',responsavel:{id:8,apelido:'Usuário Jean',empresaRepresentante:rep}}]});
 assert.equal(eventDay('2026-10-03T01:00:00Z'),'2026-10-02');assert.equal(events[0].date,'2026-10-02');assert.equal(events[0].representativeId,'rep:10');assert.equal(summarizeFunnel(events).calls,2);assert.equal(summarizeFunnel(events).leads,1);assert.equal(summarizeFunnel(events,false).calls,null);
});
test('não presume aprovação ou faturamento a partir da emissão do pedido',()=>{
 assert.throws(()=>normalizeFunnel({start:'2026-10-01',end:'2026-10-31',approved:[{id:1,estado:'APROVADO',emissaoData:'2026-10-01',valorTotal:'100'}]}));
 assert.throws(()=>normalizeFunnel({start:'2026-10-01',end:'2026-10-31',billed:[invoice(1,'2026-09-01','100')]}));
 assert.throws(()=>normalizeFunnel({start:'2026-10-01',end:'2026-10-31',invoiceItems:[{id:1,notaFiscalId:999}]}));
});
test('ranking ordena faturamento e filtra períodos sem perder dias vazios',()=>{
 const events=normalizeFunnel({start:'2026-01-01',end:'2026-12-31',billed:[invoice(1,'2026-01-02','100.01'),{...invoice(2,'2026-02-03','200.02'),representanteOuVendedor1:{id:11,apelido:'Marina'}}]});
 const rank=rankRepresentatives(events);assert.equal(rank[0].name,'Marina');assert.equal(rank[0].revenue,20002);const months=groupFunnel(events,'2026-01-01','2026-12-31','month');assert.equal(months.length,12);assert.equal(months[2].revenue,0);assert.equal(months[0].revenue,10001);
});
test('funil exige sessão e não expõe dados ou cache público',async()=>{
 const response=await handler(new Request('https://premiumflex.example/api/commercial-funnel'));assert.equal(response.status,401);assert.equal(response.headers.get('cache-control'),'private, no-store');
});
test('filtros fiscais e de CRM são aceitos pelo esquema; assunto ausente não vira zero presumido',async()=>{
 const requests=[];const fetcher=async(_url,request)=>{const body=JSON.parse(request.body);requests.push(body);let root,items=[];
 if(body.query.includes('DashboardCompanies')){root='empresas';items=[{id:9,apelido:'Empresa'}];}
 else if(body.query.includes('FunnelProposals'))root='propostasDeVenda';
 else if(body.query.includes('FunnelApproved'))root='pedidosDeVenda';
 else if(body.query.includes('FunnelInvoiceItems'))root='itensDasNotasFiscais';
 else if(body.query.includes('FunnelInvoices'))root='notasFiscais';
 else{root='tarefasOuAnotacoes';items=[{id:1,empresaId:55,assuntoId:7,assunto:{id:7,descricao:'Ligação comercial'},tipo:'TAREFA',tarefaEstado:'FINALIZADA',conclusaoData:'2026-10-03T14:00:00Z',responsavel:{id:8,empresaRepresentante:rep}}];}
 if(body.variables.where){const operation=parse(body.query).definitions[0];const variable=operation.variableDefinitions.find(v=>v.variable.name.value==='where');const errors=[];coerceInputValue(body.variables.where,schema.getType(variable.type.type.name.value),(path,value,error)=>errors.push(error.message));assert.deepEqual(errors,[]);}
 return new Response(JSON.stringify({data:{[root]:{pageInfo:{hasNextPage:false},totalCount:items.length,items}}}));};
 const options={env:{MAXIPROD_API_KEY:'token-ficticio'},fetcher};
 const result=await funnelData({start:'2026-10-01',end:'2026-10-31',companyId:'9'},options);assert.equal(result.callsAvailable,false);assert.equal(result.events.length,0);assert.equal(result.callSubjects[0].id,'7');
 const configured=await funnelData({start:'2026-10-01',end:'2026-10-31',companyId:'9',callSubject:'7'},options);assert.equal(configured.callsAvailable,true);assert.equal(configured.events.length,1);
 const approved=requests.find(r=>r.query.includes('FunnelApproved'));assert(approved.variables.where.aprovacaoData);assert(!approved.variables.where.emissaoData);
});
