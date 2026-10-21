import { useState, type FormEvent } from 'react';
import App from './App';
import { PremiumFlexLogo, BrazilFlag } from './Brand';
import { api, type Company, type LiveData, type Range } from './connection';
import { dateKey, monthRange } from './finance.mjs';
type CheckReport = { reference: string; summary: string; action: string; steps: { key: string; label: string; ok: boolean; note: string }[] };

export default function Portal() {
  const [view, setView] = useState<'demo' | 'login' | 'loading' | 'live' | 'error' | 'companies'>('demo');
  const [data, setData] = useState<LiveData | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [setup, setSetup] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [company, setCompany] = useState('');
  const [range, setRange] = useState<Range>(() => monthRange(new Date()));
  const [period, setPeriod] = useState<'day' | 'month' | 'year' | 'custom'>('month');
  const [checking, setChecking] = useState(false);
  const [report, setReport] = useState<CheckReport | null>(null);
  const [checkError, setCheckError] = useState('');
  async function diagnose() {
    setChecking(true); setReport(null); setCheckError('');
    try { setReport(await api('/api/connection-check', { method: 'POST' })); }
    catch (cause) { setCheckError(cause instanceof Error ? cause.message : 'Não foi possível verificar a conexão.'); }
    finally { setChecking(false); }
  }
  async function load(nextRange = range, nextCompany = company) {
    setView('loading'); setData(null); setError(''); setReport(null); setCheckError('');
    try {
      const params = new URLSearchParams({ ...nextRange });
      if (nextCompany) params.set('company', nextCompany);
      const result = await api('/api/finance?' + params);
      setCompanies(result.companies);
      if (result.needsCompany) { setView('companies'); return; }
      setCompany(result.company.id); setRange(nextRange); setData(result); setView('live');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível consultar o financeiro.');
      if ((cause as { code?: string }).code === 'LOGIN_REQUIRED') setView('login'); else setView('error');
    }
  }
  async function connect() {
    setView('loading'); setData(null); setPassword(''); setError(''); setSetup(false);
    if (!/^https?:$/.test(location.protocol) || location.origin === 'null') {
      setError('Abra o site publicado no Netlify para acessar a conexão segura.'); setView('error'); return;
    }
    try {
      const session = await api('/api/session');
      if (session.authenticated) await load();
      else { setSetup(!session.configured); setView('login'); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Servidor indisponível.'); setView('error'); }
  }
  async function login(event: FormEvent) {
    event.preventDefault(); setView('loading'); setError('');
    const entered = password; setPassword('');
    try {
      await api('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: entered }) });
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível entrar.'); setView('login'); }
  }
  async function logout() {
    setView('loading'); setData(null);
    try { await api('/api/session', { method: 'DELETE' }); setView('demo'); }
    catch { setError('Não foi possível encerrar a sessão no servidor. Feche o navegador ou tente novamente.'); setView('error'); }
  }
  if (view === 'demo') return <App onConnect={connect} />;
  if (view === 'live' && data) return <App live={data} initialRange={range} initialPeriod={period} onLogout={logout} onRefresh={() => load()} onRangeChange={(next, nextPeriod) => { setRange(next); setPeriod(nextPeriod); void load(next); }} onCompanyChange={value => { setCompany(value); void load(range, value); }} />;
  return <main className="access-screen"><section className="access-card"><div className="access-brand"><PremiumFlexLogo /><BrazilFlag /></div>
    <p className="eyebrow">PAINEL FINANCEIRO</p><h1>{view === 'loading' ? 'Consultando com segurança…' : view === 'companies' ? 'Selecione sua empresa' : view === 'error' ? 'Consulta não concluída' : 'Acesse seu financeiro'}</h1>
    {error && <p role="alert" className="form-error">{error}</p>}
    {view === 'login' && (setup ? <p>Crie a variável secreta <strong>DASHBOARD_PASSWORD</strong> no Netlify com uma senha exclusiva de pelo menos 20 caracteres. Depois publique novamente. A chave Maxiprod permanece somente no servidor.</p> : <form onSubmit={login}><label className="balance-label">Senha de acesso<input autoFocus type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={event => setPassword(event.target.value)} /></label><button className="button primary full-width" type="submit">Entrar no painel</button><p>A senha é diferente da chave da API. A sessão dura até 8 horas.</p></form>)}
    {view === 'companies' && (companies.length ? <label className="balance-label">Empresa<select aria-label="Selecionar empresa" value="" onChange={event => { setCompany(event.target.value); void load(range, event.target.value); }}><option value="" disabled>Escolha uma empresa</option>{companies.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : <p>Este token não disponibilizou nenhuma empresa própria. Confira suas permissões no Maxiprod.</p>)}
    {view === 'loading' && <p role="status">Buscando todas as páginas dos lançamentos. Nenhum dado de demonstração será usado nesta consulta.</p>}
    {view === 'error' && <button className="button primary full-width" onClick={connect}>Tentar novamente</button>}
    {view === 'error' && <><button className="button full-width" disabled={checking} onClick={diagnose}>{checking ? 'Verificando conexão…' : 'Verificar conexão'}</button>{checking && <p role="status">Testando consultas pequenas pelo servidor…</p>}{checkError && <p role="alert" className="form-error">{checkError}</p>}{report && <section className="connection-report" aria-label="Diagnóstico da conexão"><h2>Diagnóstico da conexão</h2><p><strong>{report.summary}</strong></p><ul>{report.steps.map(step => <li key={step.key}><strong>{step.ok ? '✓ Funcionou' : '✕ Falhou'} · {step.label}</strong><span>{step.note}</span></li>)}</ul><p>{report.action}</p><p><strong>Referência: {report.reference}</strong></p></section>}</>}
    {view !== 'loading' && <button className="button full-width" onClick={() => { setPassword(''); setData(null); setError(''); setView('demo'); }}>Voltar à demonstração</button>}
    <small>Data de referência: {dateKey(new Date())} · Chave da API protegida no servidor</small>
  </section></main>;
}
