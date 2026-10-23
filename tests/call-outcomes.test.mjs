import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateCall,commentCallEvents} from '../src/call-outcomes.mjs';
import {summarizeFunnel} from '../src/funnel-model.mjs';

test('avalia sucesso de contato com regras conservadoras e trata negações',()=>{
 for(const [text,expected] of [
 ['Não atendeu, tentar novamente.','failure'],['Falei com o comprador e confirmei os itens.','success'],['Não consegui falar com o comprador.','failure'],['Sem retorno do cliente.','failure'],['Não houve retorno positivo.','failure'],['Não falei com o comprador ainda.','failure'],['Conversei com o cliente, mas ele não tem interesse na compra.','success'],['Vou tentar contato amanhã.','review'],['Proposta em análise.','review'],['Ontem não atendeu; hoje falei com o comprador.','review'],['','review']
 ])assert.equal(evaluateCall({text}).outcome,expected,text);
});
test('revisão manual prevalece sobre sugestão e pode ser removida',()=>{
 assert.equal(evaluateCall({text:'Falei com o cliente.',outcome:'failure'}).outcome,'failure');assert.equal(evaluateCall({text:'Falei com o cliente.',outcome:'failure'}).source,'manual');assert.equal(evaluateCall({text:'Falei com o cliente.',outcome:undefined}).outcome,'success');
});
test('conta um comentário por ligação, separa leads únicos e deduplica a origem',()=>{
 const clients=[{id:'a',comments:[{id:'1',date:'2026-10-23',text:'Falei com o cliente.',author:'Jean'},{id:'2',date:'2026-10-23',text:'Não atendeu.',author:'Jean'},{id:'2',date:'2026-10-23',text:'Não atendeu.',author:'Jean'},{id:'3',date:'2026-10-23',text:' ',author:'Jean'}]},{id:'b',comments:[{id:'1',date:'2026-10-23',text:'Aguardando análise.',author:'Marina'}]}];
 const events=commentCallEvents(clients,[{representativeId:'rep:1',representative:'Jean'}]);const result=summarizeFunnel(events);
 assert.equal(result.calls,3);assert.equal(result.leads,2);assert.equal(result.callSuccess,1);assert.equal(result.callFailure,1);assert.equal(result.callReview,1);assert.equal(events[0].representativeId,'rep:1');
});
