import { allPages, cents, id, safeSum, validateRange } from './maxiprod.mjs';
import { PublicError } from './http.mjs';
const page='pageInfo { hasNextPage } totalCount';
export const commercialQueries={
 linkedClients:`query CommercialLinkedClients($skip:Int!,$take:Int!,$where:EmpresaFilterInput!){empresas(skip:$skip,take:$take,where:$where,order:[{id:ASC}]){${page} items{id apelido ativo crmUltimaLigacaoData crmUltimaVisitaData endereco{municipio{descricao uf{sigla}}} representanteOuVendedor1Preferencial{apelido}}}}`,
 clients:`query CommercialClients($skip:Int!,$take:Int!){empresas(skip:$skip,take:$take,where:{cliente:{eq:true}},order:[{id:ASC}]){${page} items{id apelido ativo crmUltimaLigacaoData crmUltimaVisitaData endereco{municipio{descricao uf{sigla}}} representanteOuVendedor1Preferencial{apelido}}}}`,
 proposals:`query CommercialProposals($skip:Int!,$take:Int!,$where:PropostaDeVendaFilterInput!){propostasDeVenda(skip:$skip,take:$take,where:$where,order:[{id:ASC}]){${page} items{id clienteId emissaoData estado valorTotal}}}`,
 orders:`query CommercialOrders($skip:Int!,$take:Int!,$where:PedidoDeVendaFilterInput!){pedidosDeVenda(skip:$skip,take:$take,where:$where,order:[{id:ASC}]){${page} items{id clienteId emissaoData estado valorFaturado}}}`,
 notes:`query CommercialNotes($skip:Int!,$take:Int!,$where:TarefaOuAnotacaoFilterInput!){tarefasOuAnotacoes(skip:$skip,take:$take,where:$where,order:[{id:ASC}]){${page} items{id empresaId tipo descricao criacaoData criacaoUsuario{apelido}}}}`,
};
export const commercialRoots={linkedClients:'empresas',clients:'empresas',proposals:'propostasDeVenda',orders:'pedidosDeVenda',notes:'tarefasOuAnotacoes'};
const day=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}/.test(value)?value.slice(0,10):'';
export function normalizeCommercial(clientRows,proposals,orders,notes){
 const clients=new Map(clientRows.map(row=>{const city=row.endereco?.municipio;return [id(row.id),{id:id(row.id),name:row.apelido||'Cliente sem nome',city:city?`${city.descricao}, ${city.uf?.sigla||''}`:'Cidade não informada',representative:row.representanteOuVendedor1Preferencial?.apelido||'Sem representante',active:row.ativo===true,quotes:0,quoted:0,invoices:0,invoiced:0,last:[day(row.crmUltimaLigacaoData),day(row.crmUltimaVisitaData)].sort().at(-1)||'',comments:[]}];}));
 const add=(client,field,amount)=>{if(amount<0)throw new PublicError(502,'COMMERCIAL_AMOUNT','A API retornou um valor comercial negativo. Nenhum total será exibido.');client[field]=safeSum([client[field],amount]);};
 for(const proposal of proposals){const client=clients.get(String(proposal.clienteId));if(!client)throw new PublicError(502,'COMMERCIAL_CLIENT','Uma proposta está vinculada a um cliente fora da base consultada.');if(proposal.estado!=='EMITIDA')throw new PublicError(502,'COMMERCIAL_STATE','A API retornou propostas fora do filtro solicitado.');client.quotes++;add(client,'quoted',cents(proposal.valorTotal));}
 for(const order of orders){const amount=cents(order.valorFaturado);if(amount<0)throw new PublicError(502,'COMMERCIAL_AMOUNT','Valor faturado negativo. Nenhum total foi exibido.');const client=clients.get(String(order.clienteId));if(!client){if(amount>0)throw new PublicError(502,'COMMERCIAL_CLIENT','Um pedido faturado está vinculado a um cliente fora da base consultada.');continue;}if(!['APROVADO','FATURADO','FATURADO_ENTREGA_FUTURA'].includes(order.estado))throw new PublicError(502,'COMMERCIAL_STATE','A API retornou pedidos fora do filtro solicitado.');if(amount>0){client.invoices++;add(client,'invoiced',amount);}}
 for(const note of notes){const client=clients.get(String(note.empresaId));if(!client)continue;const date=day(note.criacaoData);if(!date)throw new PublicError(502,'COMMERCIAL_DATE','A data de uma anotação retornada pela API é inválida.');if(note.descricao){client.comments.push({id:id(note.id),date,text:note.descricao,author:note.criacaoUsuario?.apelido||'Maxiprod'});client.last=[client.last,date].sort().at(-1);}}
 for(const client of clients.values())client.comments.sort((a,b)=>b.date.localeCompare(a.date));
 for(const field of ['quoted','invoiced'])safeSum([...clients.values()].map(c=>c[field]));
 return [...clients.values()].sort((a,b)=>b.last.localeCompare(a.last)||a.name.localeCompare(b.name));
}
export async function commercialData({start,end,companyId},{env=process.env,fetcher=fetch}={}){
 validateRange(start,end);
 const options={env,fetcher,signal:AbortSignal.timeout(24000)};
 const companies=(await allPages('companies',{},options)).map(row=>({id:id(row.id),name:row.apelido||'Empresa'}));
 const company=companyId?companies.find(c=>c.id===companyId):companies.length===1?companies[0]:null;
 if(!company)return {companies,company:null,clients:[],range:{start,end}};
 const common={minhaEmpresaId:{eq:Number(company.id)},emissaoData:{gte:start,lte:end}};
 const commercialOptions={...options,queryMap:commercialQueries,rootMap:commercialRoots};
 const [clients,proposals,orders,notes]=await Promise.all([
  allPages('clients',{},commercialOptions),
  allPages('proposals',{where:{...common,estado:{eq:'EMITIDA'}}},commercialOptions),
  allPages('orders',{where:{...common,estado:{in:['APROVADO','FATURADO','FATURADO_ENTREGA_FUTURA']}}},commercialOptions),
  allPages('notes',{where:{tipo:{eq:'ANOTACAO'},criacaoData:{gte:start+'T00:00:00-03:00',lt:new Date(Date.parse(end+'T00:00:00-03:00')+86400000).toISOString()},empresa:{cliente:{eq:true}}}},commercialOptions),
 ]);
 // Um cadastro pode perder a marcação "cliente" e continuar vinculado a documentos.
 // Recupera apenas os IDs referenciados, mantendo a autorização da API e os mesmos limites.
 const known=new Set(clients.map(row=>id(row.id)));
 const missing=[...new Set([...proposals,...orders].map(row=>id(row.clienteId)))].filter(value=>!known.has(value));
 for(let offset=0;offset<missing.length;offset+=100){
  const linked=await allPages('linkedClients',{where:{id:{in:missing.slice(offset,offset+100).map(Number)}}},commercialOptions);
  for(const row of linked){const value=id(row.id);if(!known.has(value)){clients.push(row);known.add(value);}}
 }
 return {companies,company,range:{start,end},fetchedAt:new Date().toISOString(),clients:normalizeCommercial(clients,proposals,orders,notes),warnings:[
  'Orçamentos: somente propostas EMITIDA, pela emissão no período. Não são todos os pedidos de venda.',
  'Faturado: valorFaturado dos pedidos APROVADO, FATURADO e FATURADO_ENTREGA_FUTURA emitidos no período; inclui faturamento parcial. A contagem é de pedidos com faturamento, não de notas fiscais. Não representa faturamento por data da NF.',
  'Clientes ativos/inativos seguem a situação cadastral. Clientes e anotações de CRM usam a base permitida pela chave; o cadastro pode ser compartilhado entre empresas. Última interação usa ligação, visita e anotações disponíveis; não é inferida da emissão de pedidos.',
  'As anotações usam a data de criação e não substituem um histórico de interações com data informada. Ações e temperatura são heurísticas. A IA e a gravação de comentários no Maxiprod não estão habilitadas.',
 ]};
}
