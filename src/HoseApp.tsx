import { useState } from 'react';
import { PremiumFlexLogo } from './Brand';
import { Plus, Save, Printer, ClipboardList, Download, Upload, Search } from 'lucide-react';
import './hoses.css';
import defaultCatalog from './catalogs/premium-plus.json';

type Item = { cj: string; capa: string; hose: string; a: string; b: string; quantity: string; length: string };
type Order = { id: string; number: number; date: string; client: string; sale: string; assembly: string; representative: string; equipment: string; notes: string; items: Item[] };
type Catalog = { hoses: string[]; terminals: string[]; covers: string[] };
const key = 'premium-plus-orders-v1';
const today = () => new Intl.DateTimeFormat('en-CA', {timeZone:'America/Sao_Paulo'}).format(new Date());
const blankItem = (): Item => ({ cj:'', capa:'', hose:'', a:'', b:'', quantity:'1', length:'' });
const newOrder = (): Order => ({ id:crypto.randomUUID(), number:0, date:today(), client:'', sale:'', assembly:'', representative:'', equipment:'', notes:'', items:Array.from({length:10}, blankItem) });
function read<T,>(name: string, fallback: T): T { try { return JSON.parse(localStorage.getItem(name) || 'null') ?? fallback; } catch { return fallback; } }
export default function HoseApp() {
 const [orders,setOrders] = useState<Order[]>(()=>read(key,[]));
 const [order,setOrder] = useState<Order>(newOrder);
 const [catalog,setCatalog] = useState<Catalog>(()=>{
  const saved = read<Partial<Catalog>>('premium-plus-catalog',{});
  return Object.fromEntries((['hoses','terminals','covers'] as const).map(type=>[type, Array.isArray(saved[type]) && saved[type]!.length ? saved[type] : defaultCatalog[type]])) as Catalog;
 });
 const [logo,setLogo] = useState<string>(()=>read('premium-plus-logo',''));
 const [message,setMessage] = useState('');
 const [search,setSearch] = useState('');
 const [dirty,setDirty] = useState(false);
 function change(p:Partial<Order>) {setOrder({...order,...p});setDirty(true);}
 function save() {
  if (!order.client.trim()) {setMessage('Preencha o cliente antes de salvar.');return;}
  const saved = {...order,number:order.number || Math.max(0,...orders.map(o=>o.number))+1};
  const next = [...orders.filter(o=>o.id!==saved.id),saved];
  try {localStorage.setItem(key,JSON.stringify(next));setOrders(next);setOrder(saved);setDirty(false);setMessage(`Ordem ${String(saved.number).padStart(4,'0')} salva neste navegador.`);} catch {setMessage('Não foi possível salvar. Exporte uma cópia e confira o espaço disponível no navegador.');}
 }
 function navigate(next:Order) {if(dirty && !confirm('Há alterações não salvas. Deseja descartá-las?'))return;setOrder(next);setDirty(false);setMessage('');}
 function item(index:number,field:keyof Item,value:string) {change({items:order.items.map((row,i)=>i===index?{...row,[field]:value}:row)});}
 async function importCatalog(file:File|undefined,type:keyof Catalog) {
  if(!file)return;
  const rows = (await file.text()).replace(/^\uFEFF/,'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  if(!rows.length){setMessage('O arquivo está vazio.');return;}
  const next={...catalog,[type]:[...new Set(rows)]};
  try {localStorage.setItem('premium-plus-catalog',JSON.stringify(next));setCatalog(next);setMessage(`${rows.length} linhas importadas. Use CSV com um produto por linha, sem cabeçalho.`);}catch{setMessage('Não foi possível salvar o catálogo.');}
 }
 function exportOrders() {const url=URL.createObjectURL(new Blob([JSON.stringify(orders,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='premium-plus-ordens.json';a.click();URL.revokeObjectURL(url);}
 return <div className="hose-app">
  <aside className="hose-sidebar no-print"><div className="hose-wordmark"><PremiumFlexLogo /></div><div className="side-section">PRODUÇÃO</div><div className="side-active"><ClipboardList size={19}/> Ordens de montagem</div><div className="side-bottom">Precisão em cada conexão.<br/><small>Gestão de montagem hidráulica</small><a href="/financeiro">Abrir painel financeiro ↗</a></div></aside>
  <main className="hose-main"><header className="hose-top"><div><span className="eyebrow">PREMIUM PLUS / PRODUÇÃO</span><h1>Montagem de mangueiras hidráulicas</h1><p className="no-print">Da especificação à montagem, tudo em uma ordem.</p></div><svg aria-label="Bandeira do Brasil" role="img" width="56" height="38" viewBox="0 0 60 40"><rect width="60" height="40" rx="3" fill="#149447"/><path d="M30 4 56 20 30 36 4 20Z" fill="#ffdf32"/><circle cx="30" cy="20" r="10" fill="#173c91"/><path d="M21 17q10-1 18 7" fill="none" stroke="white" strokeWidth="2"/></svg></header>
  <div className="hose-stats no-print"><div><span>ORDENS SALVAS</span><strong>{String(orders.length).padStart(2,'0')}</strong></div><div><span>ITENS NESTA ORDEM</span><strong>{order.items.filter(i=>i.hose||i.cj||i.a||i.b).length}<small> / {order.items.length} linhas</small></strong></div><div><span>ARMAZENAMENTO</span><strong className="local-status">● Local neste navegador</strong><small>Exporte suas ordens para manter uma cópia.</small></div></div>
  <div className="hose-toolbar no-print"><div><h2>{order.number?`Ordem #${String(order.number).padStart(4,'0')}`:'Nova ordem de montagem'}</h2><span>{dirty?'Alterações não salvas':order.number?'Ordem salva • disponível para edição':'Preencha os dados abaixo para começar'}</span></div><div className="hose-actions"><button onClick={()=>navigate(newOrder())}><Plus size={16}/> Nova ordem</button><button onClick={()=>window.print()}><Printer size={16}/> Imprimir A4</button><button className="primary" onClick={save}><Save size={16}/> Salvar ordem</button></div></div>
  {message&&<div role="status" className="hose-message no-print">{message}</div>}
  <article className="hose-sheet"><div className="sheet-heading"><div className="sheet-logo">{logo?<img src={logo} alt="Logotipo personalizado"/>:<PremiumFlexLogo />}</div><div><span>ORDEM DE MONTAGEM</span><b>{order.number?`#${String(order.number).padStart(4,'0')}`:'RASCUNHO'}</b></div></div>
  <section className="hose-form"><h3><span>01</span> Dados da ordem</h3><div className="hose-fields">{([['date','Data','date'],['client','Cliente','text'],['sale','Pedido de venda','text'],['assembly','Montagem / responsável','text'],['representative','Representante','text'],['equipment','Nome do equipamento','text']] as const).map(([field,label,type])=><label key={field}>{label}<input type={type} value={order[field]} onChange={e=>change({[field]:e.target.value})} placeholder={field==='client'?'Nome do cliente':'Preencher'}/></label>)}</div></section>
  <section className="hose-items"><div className="items-heading"><h3><span>02</span> Especificação da montagem</h3><small className="no-print">Dimensões em milímetros • catálogos independentes</small></div><div className="hose-table-wrap"><table><thead><tr>{['ITEM','CÓDIGO CJ','CAPA','MANGUEIRA / NORMA','TERMINAL A','TERMINAL B','QTD.','COMP. (mm)'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{order.items.map((row,index)=><tr key={index}><td className="row-number">{String(index+1).padStart(2,'0')}</td>{(['cj','capa','hose','a','b','quantity','length'] as const).map(field=><td key={field}><input aria-label={`${field} item ${index+1}`} value={row[field]} onChange={e=>item(index,field,e.target.value)} placeholder={field==='hose'?'Pesquisar mangueira':field==='a'||field==='b'?'Pesquisar terminal':'—'} list={field==='hose'?'hose-catalog':field==='capa'?'cover-catalog':field==='a'||field==='b'?'terminal-catalog':undefined} type={field==='quantity'||field==='length'?'number':'text'} min={field==='quantity'?'1':'0'} step={field==='length'?'any':undefined}/></td>)}</tr>)}</tbody></table></div><datalist id="cover-catalog">{catalog.covers.map(v=><option key={v} value={v}/>)}</datalist><datalist id="hose-catalog">{catalog.hoses.map(v=><option key={v} value={v}/>)}</datalist><datalist id="terminal-catalog">{catalog.terminals.map(v=><option key={v} value={v}/>)}</datalist><button className="add-row no-print" onClick={()=>change({items:[...order.items,blankItem()]})}><Plus size={16}/> Acrescentar item</button></section>
  <section className="hose-notes"><label>Observações de montagem<textarea value={order.notes} onChange={e=>change({notes:e.target.value})} placeholder="Instruções, orientação dos terminais ou informações adicionais…"/></label></section><div className="hose-signatures"><span>Responsável pela montagem</span><span>Conferência / aprovação</span></div><footer className="sheet-footer">PREMIUM PLUS <span>Montagem de mangueiras hidráulicas • {order.items.length} linhas</span></footer></article>
  <section className="hose-bottom no-print"><div className="hose-panel"><h3><Search size={18}/> Ordens salvas</h3><input aria-label="Buscar ordens" placeholder="Buscar cliente, pedido ou número…" value={search} onChange={e=>setSearch(e.target.value)}/><div className="saved-orders">{orders.filter(o=>`${o.client} ${o.sale} ${o.number}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>b.number-a.number).map(o=><button key={o.id} onClick={()=>navigate(o)}><b>#{String(o.number).padStart(4,'0')} · {o.client}</b><span>{o.date} · Pedido {o.sale||'não informado'} · Editar ↗</span></button>)}{orders.length===0&&<p>Suas ordens aparecerão aqui após salvar.</p>}</div><button onClick={exportOrders} disabled={!orders.length}><Download size={16}/> Exportar ordens (JSON)</button></div>
  <div className="hose-panel"><h3><Upload size={18}/> Catálogos e identidade</h3><p>Os produtos das planilhas enviadas já estão disponíveis: 36 mangueiras, 386 terminais e 22 capas. Pesquise por código, descrição ou norma no campo correspondente. Para substituir um catálogo, importe CSV UTF-8 com um produto por linha, sem cabeçalho.</p><label className="upload-label">Mangueiras ({catalog.hoses.length})<input type="file" accept=".csv,.txt" onChange={e=>void importCatalog(e.target.files?.[0],'hoses')}/></label><label className="upload-label">Terminais hidráulicos ({catalog.terminals.length})<input type="file" accept=".csv,.txt" onChange={e=>void importCatalog(e.target.files?.[0],'terminals')}/></label><label className="upload-label">Capas hidráulicas ({catalog.covers.length})<input type="file" accept=".csv,.txt" onChange={e=>void importCatalog(e.target.files?.[0],'covers')}/></label><label className="upload-label">Logotipo personalizado (PNG/JPG, até 1 MB)<input type="file" accept="image/png,image/jpeg" onChange={e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>1000000){setMessage('Use um logotipo de até 1 MB.');return;}const reader=new FileReader();reader.onload=()=>{try{localStorage.setItem('premium-plus-logo',JSON.stringify(reader.result));setLogo(String(reader.result));}catch{setMessage('Não foi possível salvar o logotipo.');}};reader.readAsDataURL(file);}}/></label></div></section>
  <footer className="hose-page-footer no-print">PREMIUM PLUS · Controle de produção <span>Dados armazenados somente neste navegador</span></footer>
 </main></div>;
}
