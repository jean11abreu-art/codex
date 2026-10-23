import {allPages,cents,id,safeSum,validateRange} from './maxiprod.mjs';
import {PublicError} from './http.mjs';
import {evaluateCall} from '../../src/call-outcomes.mjs';
const segment='pageInfo { hasNextPage } totalCount';
const representative='representanteOuVendedor1 {id apelido}';
export const funnelQueries={
 sent:`query FunnelProposals($skip:Int!,$take:Int!,$where:PropostaDeVendaFilterInput!){propostasDeVenda(skip:$skip,take:$take,where:$where,order:[{id:ASC}]){${segment} items{id clienteId emissaoData estado valorTotal ${representative}}}}`,
 approved:`query FunnelApproved($skip:Int!,$take:Int!,$where:PedidoDeVendaFilterInput!){pedidosDeVenda(skip:$skip,take:$take,where:$where,order:[{id:ASC}]){${segment} items{id clienteId aprovacaoData estado valorTotal ${representative}}}}`,
 billed:`query FunnelInvoices($skip:Int!,$take:Int!,$where:NotaFiscalFilterInput!){notasFiscais(skip:$skip,take:$take,where:$where,order:[{id:ASC}]){${segment} items{id destinatarioOuRemetenteId emissaoData estado valorTotal ${representative}}}}`,
 invoiceItems:`query FunnelInvoiceItems($skip:Int!,$take:Int!,$where:NotaFiscalItemFilterInput!){itensDasNotasFiscais(skip:$skip,take:$take,where:$where,order:[{id:ASC}]){${segment} items{id notaFiscalId itemDoPedidoDeVenda{pedidoDeVendaId}}}}`,
 calls:`query FunnelCalls($skip:Int!,$take:Int!,$where:TarefaOuAnotacaoFilterInput!){tarefasOuAnotacoes(skip:$skip,take:$take,where:$where,order:[{id:ASC}]){${segment} items{id empresaId tipo descricao criacaoData criacaoUsuario{id apelido empresaRepresentante{id apelido}}}}}`,
};
export const funnelRoots={sent:'propostasDeVenda',approved:'pedidosDeVenda',billed:'notasFiscais',invoiceItems:'itensDasNotasFiscais',calls:'tarefasOuAnotacoes'};
export function eventDay(value){if(typeof value!=='string')throw new PublicError(502,'FUNNEL_DATE','Data ausente na API.');const date=value.includes('T')?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date(value)):value;if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new PublicError(502,'FUNNEL_DATE','Data inválida na API.');return date;}
const rep=row=>row?{representativeId:'rep:'+id(row.id),representative:row.apelido||'Representante sem nome'}:{representativeId:'none',representative:'Sem representante'};
export function normalizeFunnel({sent=[],approved=[],billed=[],invoiceItems=[],calls=[],start,end}){
 const invoiceIds=new Set(billed.map(row=>id(row.id)));const orderLinks=new Map();
 for(const item of invoiceItems){const invoiceId=id(item.notaFiscalId);if(!invoiceIds.has(invoiceId))throw new PublicError(502,'FUNNEL_INVOICE','Os itens fiscais não correspondem às notas consultadas.');if(item.itemDoPedidoDeVenda){const links=orderLinks.get(invoiceId)||new Set();links.add(id(item.itemDoPedidoDeVenda.pedidoDeVendaId));orderLinks.set(invoiceId,links);}}
 const events=[];
 function add(kind,row,date,amount,customerId,extra={}){date=eventDay(date);if(date<start||date>end)throw new PublicError(502,'FUNNEL_RANGE','A API retornou eventos fora do período solicitado.');const amountCents=amount===null?0:cents(amount);if(amountCents<0)throw new PublicError(502,'FUNNEL_AMOUNT','Valor negativo não esperado no funil.');events.push({id:`${kind}:${id(row.id)}`,kind,date,amountCents,customerId:customerId?String(customerId):null,...rep(row.representanteOuVendedor1),...extra});}
 for(const row of sent){if(!['EMITIDA','CONCLUIDA'].includes(row.estado))throw new PublicError(502,'FUNNEL_STATE','Proposta fora do filtro solicitado.');add('proposal',row,row.emissaoData,row.valorTotal,row.clienteId);}
 for(const row of approved){if(!['APROVADO','FATURADO','FATURADO_ENTREGA_FUTURA'].includes(row.estado))throw new PublicError(502,'FUNNEL_STATE','Pedido fora do filtro solicitado.');add('approved',row,row.aprovacaoData,row.valorTotal,row.clienteId);}
 for(const row of billed){if(row.estado!=='EMITIDA')throw new PublicError(502,'FUNNEL_STATE','Nota fiscal fora do filtro solicitado.');add('invoice',row,row.emissaoData,row.valorTotal,row.destinatarioOuRemetenteId,{orderIds:[...(orderLinks.get(id(row.id))||[])]});}
 for(const row of calls){if(row.tipo!=='ANOTACAO')throw new PublicError(502,'FUNNEL_CALL','A API retornou um registro fora do filtro de comentários.');if(!row.descricao?.trim())continue;const author=row.criacaoUsuario;const representative=author?.empresaRepresentante;const identity=representative?rep(representative):author?{representativeId:'user:'+id(author.id),representative:(author.apelido||'Autor do comentário')+' (sem vínculo de representante)'}:rep(null);const assessment=evaluateCall({text:row.descricao});add('call',row,row.criacaoData,null,row.empresaId,{...identity,callOutcome:assessment.outcome,outcomeReason:assessment.reason,commentText:row.descricao});}
 safeSum(events.filter(e=>e.kind==='invoice').map(e=>e.amountCents));return events.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
}
export async function funnelData({start,end,companyId},{env=process.env,fetcher=fetch}={}){
 validateRange(start,end);const options={env,fetcher,signal:AbortSignal.timeout(24000)};
 const companies=(await allPages('companies',{},options)).map(row=>({id:id(row.id),name:row.apelido||'Empresa'}));const company=companies.find(c=>c.id===companyId);if(!company)throw new PublicError(400,'FUNNEL_COMPANY','Selecione uma empresa disponível no painel.');

 const dates={gte:start+'T00:00:00-03:00',lt:new Date(Date.parse(end+'T00:00:00-03:00')+86400000).toISOString()};
 const mine={minhaEmpresaId:{eq:Number(company.id)}};
 const invoiceWhere={...mine,emissaoData:{gte:start,lte:end},estado:{eq:'EMITIDA'},operacaoFiscal:{tipo:{eq:'FATURAMENTO'}}};
 const opts={...options,queryMap:funnelQueries,rootMap:funnelRoots};
 const [sent,approved,billed,invoiceItems,tasks]=await Promise.all([
 allPages('sent',{where:{...mine,emissaoData:{gte:start,lte:end},estado:{in:['EMITIDA','CONCLUIDA']}}},opts),
 allPages('approved',{where:{...mine,aprovacaoData:dates,estado:{in:['APROVADO','FATURADO','FATURADO_ENTREGA_FUTURA']}}},opts),
 allPages('billed',{where:invoiceWhere},opts),allPages('invoiceItems',{where:{notaFiscal:invoiceWhere}},opts),
 allPages('calls',{where:{tipo:{eq:'ANOTACAO'},criacaoData:dates,empresa:{cliente:{eq:true}}}},opts),
 ]);
 const calls=tasks;
 return {company,range:{start,end},callsAvailable:true,events:normalizeFunnel({sent,approved,billed,invoiceItems,calls,start,end}),fetchedAt:new Date().toISOString(),notes:[
 'Propostas enviadas: propostas EMITIDA ou CONCLUIDA pela data de emissão; o esquema não fornece confirmação de envio por e-mail. Canceladas e rascunhos ficam fora.',
 'Pedidos aprovados: data de aprovação, incluindo pedidos que já foram faturados. Não é uma coorte de conversão entre etapas.',
 'Pedidos faturados: pedidos distintos vinculados às notas EMITIDA de operação FATURAMENTO pela data da nota. Faturamento parcial não duplica o pedido no mesmo período. Notas sem pedido entram no valor, mas não na contagem de pedidos.',
 'Faturamento bruto pela data de emissão da NF, incluindo frete e impostos no valorTotal. Não deduz devoluções; valide a cobertura das operações fiscais com a contabilidade.',
 'Ligações: cada comentário ANOTACAO não vazio conta uma ligação, pela data de criação, conforme a regra comercial definida. Isso não comprova que um telefonema ocorreu. Leads únicos são contados separadamente. Sucesso é sugerido por regras de texto e fica a avaliar quando ambíguo.',
 'Ligações usam a empresa representante vinculada ao autor do comentário no CRM. Usuários sem vínculo ficam separados no ranking. O CRM pode ser compartilhado entre empresas permitidas pela chave.',
 ]};
}
