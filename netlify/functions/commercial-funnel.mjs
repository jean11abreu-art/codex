import {requireSession} from '../lib/auth.mjs';
import {json,failure} from '../lib/http.mjs';
import {funnelData} from '../lib/commercial-funnel.mjs';
export default async function handler(request){try{if(request.method!=='GET')return json({error:'Método não permitido.'},405,{Allow:'GET'});requireSession(request);const url=new URL(request.url);return json(await funnelData({start:url.searchParams.get('start'),end:url.searchParams.get('end'),companyId:url.searchParams.get('company')}));}catch(error){return failure(error);}}
export const config={path:'/api/commercial-funnel',rateLimit:{windowLimit:12,windowSize:60,aggregateBy:['ip','domain']}};
