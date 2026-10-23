/** @typedef {'success'|'failure'|'review'} CallOutcome */
const normalized=value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
/** Heurística conservadora e revisável. Sucesso significa contato efetivo, não venda fechada. */
/** @returns {{outcome:CallOutcome,source:'manual'|'rules',reason:string}} */
export function evaluateCall(comment){
 if(['success','failure','review'].includes(comment.outcome))return {outcome:comment.outcome,source:'manual',reason:'Resultado definido manualmente.'};
 const text=normalized(comment.text||comment.descricao);
 if(!text)return {outcome:'review',source:'rules',reason:'Comentário sem evidência suficiente para avaliar o contato.'};
 const negative=/\b(?:nao (?:atendeu|atende|retornou|consegui(?:mos)? (?:falar|contato)|foi possivel (?:falar|contato)|tive retorno|houve retorno|tivemos retorno|recebi retorno|recebemos retorno|falei com|conversei com)|ninguem atendeu|sem (?:retorno|resposta|sucesso)|caixa postal|numero (?:invalido|inexistente)|chamada (?:caiu|nao completou)|telefone ocupado|linha ocupada)\b/g;
 const failure=negative.test(text);
 // Retire trechos negados antes de procurar expressões positivas.
 negative.lastIndex=0;
 const remaining=text.replace(negative,' ');
 const success=/\b(?:falei com|conversei com|consegui(?:mos)? (?:falar|contato)|ligacao atendida|cliente atendeu|contato (?:realizado|efetuado|com sucesso)|ligacao com sucesso|retorno positivo|cliente demonstrou interesse|cliente confirmou|confirmou (?:interesse|o pedido)|visita agendada|reuniao agendada|proposta aceita|vamos fechar|pedido aprovado)\b/.test(remaining);
 if(success&&failure)return {outcome:'review',source:'rules',reason:'O texto contém sinais de contato com e sem sucesso; revise o resultado.'};
 if(failure)return {outcome:'failure',source:'rules',reason:'O comentário informa falta de atendimento, retorno ou conclusão do contato.'};
 if(success)return {outcome:'success',source:'rules',reason:'O comentário informa contato efetivo ou retorno positivo; isso não comprova venda.'};
 return {outcome:'review',source:'rules',reason:'Não há evidência clara de atendimento ou falha. Avaliação necessária.'};
}
/** Cada comentário não vazio corresponde a uma ligação, conforme a regra comercial definida. */
/** @returns {import('./funnel-model.mjs').FunnelEvent[]} */
export function commentCallEvents(clients,representatives=[]){
 const map=new Map(representatives.map(r=>[normalized(r.representative),{representativeId:r.representativeId,representative:r.representative}]));
 const seen=new Set();const events=[];
 for(const client of clients)for(const comment of client.comments||[]){
  if(!String(comment.text||'').trim()||!/^\d{4}-\d{2}-\d{2}$/.test(comment.date))continue;
  const key=JSON.stringify([client.id,comment.id]);if(seen.has(key))continue;seen.add(key);
  const author=String(comment.author||'Sem responsável').trim();
  const rep=map.get(normalized(author))||{representativeId:'comment-author:'+normalized(author),representative:author};
  const evaluation=evaluateCall(comment);
  events.push({id:'comment:'+key,kind:'call',date:comment.date,amountCents:0,customerId:String(client.id),...rep,callOutcome:evaluation.outcome,outcomeReason:evaluation.reason,commentText:comment.text});
 }
 return events;
}
