import { useState } from 'react';
import { X, LockKeyhole, ArrowRight } from 'lucide-react';
import CommercialApp, {type CommercialLive} from './CommercialApp';
import { PremiumFlexLogo } from './Brand';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date());
const yearAgo=()=>{const d=new Date(today()+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-365);return d.toISOString().slice(0,10);};
async function responseJSON(response:Response){let body;try{body=await response.json();}catch{throw new Error('A API não está disponível neste endereço. Execute as funções no Netlify para conectar os dados reais.');}if(!response.ok)throw new Error(body.error||'Não foi possível concluir a consulta.');return body;}
export default function CommercialPortal({apiEnabled=true}:{apiEnabled?:boolean}={}){
 const [live,setLive]=useState<CommercialLive>();const [dialog,setDialog]=useState(false);const [password,setPassword]=useState('');
 const [start,setStart]=useState(yearAgo);const [end,setEnd]=useState(today);const [company,setCompany]=useState('');const [companies,setCompanies]=useState<{id:string;name:string}[]>([]);
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function connect(){if(!apiEnabled)return;setBusy(true);setError('');try{
  if(!start||!end||start>end||(Date.parse(end)-Date.parse(start))/86400000>366)throw new Error('Selecione um período válido de até 366 dias.');
  const session=await responseJSON(await fetch('/api/session',{credentials:'same-origin',cache:'no-store'}));
  if(!session.configured)throw new Error('Configure MAXIPROD_API_KEY e DASHBOARD_PASSWORD no servidor Netlify para conectar. Não informe a chave neste formulário.');
  if(!session.authenticated){if(!password)throw new Error('Informe a senha de acesso ao painel.');await responseJSON(await fetch('/api/session',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})}));setPassword('');}
  const query=new URLSearchParams({start,end});if(company)query.set('company',company);
  const data=await responseJSON(await fetch('/api/commercial?'+query,{credentials:'same-origin',cache:'no-store'})) as CommercialLive;
  if(!Array.isArray(data.clients)||!Array.isArray(data.companies))throw new Error('A API retornou um formato inesperado.');
  setCompanies(data.companies);
  if(!data.company){setDialog(true);if(!data.companies.length)throw new Error('Nenhuma empresa foi disponibilizada pela API.');setError('Selecione a empresa e clique em Consultar API.');return;}
  setLive(data);setCompany(data.company.id);setDialog(false);
 }catch(e){setError(e instanceof Error?e.message:'Falha na conexão.');setDialog(true);}finally{setBusy(false);}}
 async function logout(){setBusy(true);try{await responseJSON(await fetch('/api/session',{method:'DELETE',credentials:'same-origin'}));setLive(undefined);setCompany('');setCompanies([]);setError('');setPassword('');setDialog(false);}catch{setError('Não foi possível encerrar a sessão. Tente novamente.');setDialog(true);}finally{setBusy(false);}}
 return <><CommercialApp key={live?`${live.company?.id}-${live.fetchedAt}`:'demo'} live={live} apiEnabled={apiEnabled} onConnect={()=>{setError('');setDialog(true);}} onRefresh={connect} onDemo={()=>setLive(undefined)} onLogout={logout}/>{dialog&&<div className="pc-modal-backdrop"><section className="pc-connect-modal" role="dialog" aria-modal="true" aria-labelledby="pc-connect-title"><div className="pc-modal-brand"><PremiumFlexLogo/><button onClick={()=>{if(!busy){setDialog(false);setPassword('');}}} aria-label="Fechar conexão" disabled={busy}><X size={18}/></button></div><span className="pc-eyebrow">INTEGRAÇÃO MAXIPROD</span><h2 id="pc-connect-title">Seus dados, com acesso protegido.</h2><p>Use a senha já configurada no painel financeiro. A chave do Maxiprod fica somente no servidor.</p>{live&&<p>Os dados exibidos atrás desta janela pertencem à última consulta concluída. Se a atualização falhar, eles não serão substituídos por dados fictícios.</p>}<form onSubmit={e=>{e.preventDefault();void connect();}}><label>Senha de acesso<input autoFocus type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Senha do painel" maxLength={256} disabled={busy}/></label><div className="pc-connect-dates"><label>Início<input type="date" value={start} onChange={e=>setStart(e.target.value)} disabled={busy}/></label><label>Fim<input type="date" value={end} onChange={e=>setEnd(e.target.value)} disabled={busy}/></label></div>{companies.length>0&&<label>Empresa<select value={company} onChange={e=>setCompany(e.target.value)} disabled={busy}><option value="">Selecione</option>{companies.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>}{error&&<div role="alert" className="pc-connect-error">{error}</div>}<button className="pc-primary" type="submit" disabled={busy}>{busy?'Consultando…':<>Consultar API <ArrowRight size={16}/></>}</button></form><small><LockKeyhole size={12}/> Consultas de leitura · Sem gravações no Maxiprod</small></section></div>}</>;
}
