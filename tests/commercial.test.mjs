import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildSchema,parse,validate} from 'graphql';
import {commercialQueries,normalizeCommercial,commercialData} from '../netlify/lib/commercial.mjs';
import handler from '../netlify/functions/commercial.mjs';

test('consultas comerciais fixas são válidas no esquema Maxiprod e somente leitura',()=>{
 const schema=buildSchema(readFileSync(new URL('../docs/maxiprod/schema.graphql',import.meta.url),'utf8'));
 for(const query of Object.values(commercialQueries)){const document=parse(query);assert.deepEqual(validate(schema,document),[]);assert(document.definitions.every(d=>d.operation==='query'));}
});
const customer={id:1,apelido:'Cliente teste',ativo:true,crmUltimaLigacaoData:'2026-10-01T12:00:00Z',endereco:{municipio:{descricao:'Canoas',uf:{sigla:'RS'}}}};
test('propostas e faturamento parcial são somados em centavos sem deduzir um do outro',()=>{
 const clients=normalizeCommercial([customer],[{id:4,clienteId:1,estado:'EMITIDA',valorTotal:'10.01'},{id:5,clienteId:1,estado:'EMITIDA',valorTotal:'20.02'}],[{id:6,clienteId:1,estado:'APROVADO',valorFaturado:'7.03'},{id:7,clienteId:1,estado:'FATURADO',valorFaturado:'2.01'}],[{id:8,empresaId:1,descricao:'Conversa comercial',criacaoData:'2026-10-03T13:00:00Z',criacaoUsuario:{apelido:'Jean'}}]);
 assert.equal(clients[0].quoted,3003);assert.equal(clients[0].invoiced,904);assert.equal(clients[0].quotes,2);assert.equal(clients[0].invoices,2);assert.equal(clients[0].last,'2026-10-03');assert.equal(clients[0].comments[0].text,'Conversa comercial');
});
test('não presume interação a partir de emissão do pedido e mantém ausência de histórico',()=>{
 const result=normalizeCommercial([{id:1,apelido:'Sem histórico',ativo:false}],[],[{id:6,clienteId:1,estado:'FATURADO',valorFaturado:'10.00',emissaoData:'2026-10-22'}],[])[0];assert.equal(result.last,'');assert.deepEqual(result.comments,[]);assert.equal(result.active,false);
});
test('recusa resultados parciais de clientes desconhecidos e estados fora do filtro',()=>{
 assert.throws(()=>normalizeCommercial([customer],[{clienteId:99,estado:'EMITIDA',valorTotal:'1'}],[],[]));
 assert.throws(()=>normalizeCommercial([customer],[{clienteId:1,estado:'CANCELADA',valorTotal:'1'}],[],[]));
 assert.throws(()=>normalizeCommercial([customer],[],[{clienteId:1,estado:'FATURADO',valorFaturado:'-1'}],[]));
});
test('API exige sessão e não devolve dados privados para visitante',async()=>{
 const response=await handler(new Request('https://premiumflex.example/api/commercial?start=2026-01-01&end=2026-10-22'));assert.equal(response.status,401);assert.equal(response.headers.get('Cache-Control'),'private, no-store');const body=await response.json();assert.equal(body.code,'LOGIN_REQUIRED');assert(!body.clients);
});
test('período inválido é rejeitado antes de consultar a API',async()=>{
 let called=false;await assert.rejects(()=>commercialData({start:'2024-01-01',end:'2026-10-22'},{fetcher:()=>{called=true;}}));assert.equal(called,false);
});

test('consulta paginada usa propostas e pedidos da empresa selecionada e verifica contagens',async()=>{
 const calls=[];
 const fetcher=async(_url,request)=>{const body=JSON.parse(request.body);calls.push(body);let root,items;
  if(body.query.includes('DashboardCompanies')){root='empresas';items=[{id:9,apelido:'Empresa autorizada'}];}
  else if(body.query.includes('CommercialClients')){root='empresas';items=[customer];}
  else if(body.query.includes('CommercialProposals')){root='propostasDeVenda';items=[{id:2,clienteId:1,estado:'EMITIDA',valorTotal:'30.03'}];}
  else if(body.query.includes('CommercialOrders')){root='pedidosDeVenda';items=[{id:3,clienteId:1,estado:'APROVADO',valorFaturado:'10.01'}];}
  else{root='tarefasOuAnotacoes';items=[];}
  return new Response(JSON.stringify({data:{[root]:{pageInfo:{hasNextPage:false},totalCount:items.length,items}}}),{status:200});
 };
 const result=await commercialData({start:'2026-01-01',end:'2026-10-23',companyId:'9'},{env:{MAXIPROD_API_KEY:'token-ficticio-de-teste'},fetcher});
 assert.equal(result.company.id,'9');assert.equal(result.clients[0].invoiced,1001);assert.equal(calls.length,5);
 const proposals=calls.find(c=>c.query.includes('CommercialProposals'));assert.deepEqual(proposals.variables.where.minhaEmpresaId,{eq:9});assert.deepEqual(proposals.variables.where.estado,{eq:'EMITIDA'});
 const truncated=async(url,request)=>{const response=await fetcher(url,request);const body=await response.json();const segment=Object.values(body.data)[0];if(JSON.parse(request.body).query.includes('CommercialOrders'))segment.totalCount=10;return new Response(JSON.stringify(body));};
 await assert.rejects(()=>commercialData({start:'2026-01-01',end:'2026-10-23',companyId:'9'},{env:{MAXIPROD_API_KEY:'token-ficticio-de-teste'},fetcher:truncated}),error=>error.code==='INCOMPLETE_DATA');
});


test('recupera cadastro vinculado à proposta mesmo sem a marcação de cliente',async()=>{
 let linkedCalls=0;
 const fetcher=async(_url,request)=>{
  const {query,variables}=JSON.parse(request.body);let root='empresas',items=[];
  if(query.includes('DashboardCompanies'))items=[{id:9,apelido:'Empresa autorizada'}];
  else if(query.includes('CommercialLinkedClients')){linkedCalls++;assert.deepEqual(variables.where,{id:{in:[99]}});items=[{id:99,apelido:'Cadastro vinculado',ativo:false}];}
  else if(query.includes('CommercialClients'))items=[customer];
  else if(query.includes('CommercialProposals')){root='propostasDeVenda';items=[{id:2,clienteId:99,estado:'EMITIDA',valorTotal:'30.03'}];}
  else if(query.includes('CommercialOrders'))root='pedidosDeVenda';
  else root='tarefasOuAnotacoes';
  return new Response(JSON.stringify({data:{[root]:{pageInfo:{hasNextPage:false},totalCount:items.length,items}}}));
 };
 const result=await commercialData({start:'2026-10-01',end:'2026-10-24',companyId:'9'},{env:{MAXIPROD_API_KEY:'teste'},fetcher});
 assert.equal(linkedCalls,1);const linked=result.clients.find(c=>c.id==='99');assert.equal(linked.name,'Cadastro vinculado');assert.equal(linked.quoted,3003);assert.equal(linked.active,false);
});
