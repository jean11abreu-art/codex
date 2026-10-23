/** @typedef {{id:string,kind:'call'|'proposal'|'approved'|'invoice',date:string,amountCents:number,customerId:string|null,representativeId:string,representative:string,orderIds?:string[]}} FunnelEvent */
/** @param {FunnelEvent[]} events @param {boolean} [callsAvailable] */
export function summarizeFunnel(events,callsAvailable=true){
 const orders=new Set();const leads=new Set();let calls=0,proposals=0,approved=0,invoices=0,revenue=0;
 for(const event of events){if(event.kind==='call'){calls++;if(event.customerId)leads.add(event.customerId);}if(event.kind==='proposal')proposals++;if(event.kind==='approved')approved++;if(event.kind==='invoice'){invoices++;revenue+=event.amountCents;if(!Number.isSafeInteger(revenue))throw new Error('Faturamento acima do limite seguro.');for(const id of event.orderIds||[])orders.add(id);}}
 return {calls:callsAvailable?calls:null,leads:callsAvailable?leads.size:null,proposals,approved,orders:orders.size,invoices,revenue};
}
/** @param {FunnelEvent[]} events @param {boolean} [callsAvailable] */
export function rankRepresentatives(events,callsAvailable=true){
 /** @type {Map<string,{id:string,name:string,events:FunnelEvent[]}>} */const reps=new Map();
 for(const event of events){const rep=reps.get(event.representativeId)||{id:event.representativeId,name:event.representative,events:[]};rep.events.push(event);reps.set(rep.id,rep);}
 return [...reps.values()].map(rep=>({id:rep.id,name:rep.name,...summarizeFunnel(rep.events,callsAvailable)})).sort((a,b)=>b.revenue-a.revenue||b.approved-a.approved||b.proposals-a.proposals||(b.calls||0)-(a.calls||0)||a.name.localeCompare(b.name));
}
/** @param {FunnelEvent[]} events @param {string} start @param {string} end @param {'day'|'month'} grain @param {boolean} [callsAvailable] */
export function groupFunnel(events,start,end,grain,callsAvailable=true){
 /** @type {Map<string,FunnelEvent[]>} */const buckets=new Map();
 if(start>end)return [];
 const cursor=new Date(start+'T12:00:00Z');if(grain==='month')cursor.setUTCDate(1);
 while(cursor.toISOString().slice(0,10)<=end){buckets.set(cursor.toISOString().slice(0,grain==='day'?10:7),[]);if(grain==='day')cursor.setUTCDate(cursor.getUTCDate()+1);else cursor.setUTCMonth(cursor.getUTCMonth()+1);}
 for(const event of events){if(event.date<start||event.date>end)continue;const key=event.date.slice(0,grain==='day'?10:7);buckets.get(key)?.push(event);}
 return [...buckets].map(([date,rows])=>({date,...summarizeFunnel(rows,callsAvailable)}));
}
/** Dados fictícios e determinísticos, somente para a demonstração. @returns {FunnelEvent[]} */
export function demoFunnel(year,today){
 const events=[];const end=year===Number(today.slice(0,4))?today:`${year}-12-31`;let date=new Date(`${year}-01-01T12:00:00Z`);let index=0;
 const reps=['Jean','Marina','Lucas'];
 while(date.toISOString().slice(0,10)<=end){const day=date.toISOString().slice(0,10);const weekday=date.getUTCDay();const active=weekday!==0&&weekday!==6;
 const calls=active?22+(index*7)%24:0;
 const proposals=active?2+index%5:0;const approved=active?1+index%3:0;const invoices=active?1+index%4:0;
 for(const [kind,count] of [['call',calls],['proposal',proposals],['approved',approved],['invoice',invoices]])for(let n=0;n<count;n++){const repIndex=(index+n)%3;const id=`demo-${kind}-${day}-${n}`;events.push({id,kind,date:day,amountCents:kind==='invoice'?180000+(index*11317+n*17431)%620000:0,customerId:`demo-client-${n%15}`,representativeId:`demo-rep-${repIndex}`,representative:reps[repIndex],...(kind==='invoice'?{orderIds:[`demo-order-${day}-${n}`]}:{})});}
 date.setUTCDate(date.getUTCDate()+1);index++;
 }
 return events;
}
