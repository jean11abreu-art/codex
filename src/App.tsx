import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowDownLeft, ArrowDownToLine, ArrowRight, ArrowUpRight, Banknote, Bell, Building2, CalendarDays, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, CreditCard, FileBarChart2, FileText, LayoutDashboard, Link2, Menu, MoreHorizontal, RefreshCw, Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Truck, Users, Wallet, X } from 'lucide-react';
import { actualBalance, aggregate, csv, dateKey, inRange, monthRange, projectedBalance, total } from './finance.mjs';
import { createDemoEntries, OPENING_BALANCE_CENTS, type Entry } from './data';
import { PremiumFlexLogo, BrazilFlag } from './Brand';
import { emptyMapping, type CostMapping, type LiveData, type Range } from './connection';

const money = (cents: number | null) => cents === null ? 'A configurar' : (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const shortMoney = (cents: number) => `${(cents / 100000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
const prettyDate = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString('pt-BR');
type Period = 'day' | 'month' | 'year' | 'custom';
type Modal = 'integration' | 'balance' | 'help' | null;

type Props = { live?: LiveData; initialRange?: Range; initialPeriod?: Period; onConnect?: () => void; onLogout?: () => void; onRefresh?: () => void; onSettings?: () => void; onRangeChange?: (range: Range, period: Period) => void; onCompanyChange?: (company: string) => void };
function App({ live, initialRange, initialPeriod, onConnect, onLogout, onRefresh, onSettings, onRangeChange, onCompanyChange }: Props = {}) {
  const [now] = useState(() => live ? new Date(live.today + 'T12:00:00') : new Date());
  const today = live?.today || dateKey(now);
  const costMapping = live?.settings?.costMapping || emptyMapping;
  const entries = useMemo(() => live?.entries || createDemoEntries(now), [now, live]);
  const month = live?.month || monthRange(now);
  const [period, setPeriod] = useState<Period>(initialPeriod || 'month');
  const [range, setRange] = useState(initialRange || month);
  const [dates, setDates] = useState(initialRange || month);
  const [dateError, setDateError] = useState('');
  const [tab, setTab] = useState<'all' | 'out' | 'in' | 'boletos'>('all');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState('');
  const [sidebar, setSidebar] = useState(false);
  const [activeNav, setActiveNav] = useState('overview');
  const [chartType, setChartType] = useState<'flow' | 'balance'>('flow');
  const [hovered, setHovered] = useState<number | null>(null);
  const [updated, setUpdated] = useState(() => live ? new Date(live.fetchedAt) : new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [opening, setOpening] = useState(() => {
    try { const value = Number(localStorage.getItem('nexo-opening-cents')); return localStorage.getItem('nexo-opening-cents') !== null && Number.isSafeInteger(value) ? value : OPENING_BALANCE_CENTS; } catch { return OPENING_BALANCE_CENTS; }
  });
  const [openingInput, setOpeningInput] = useState(String(opening / 100));
  const closeRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = (message: string) => { setToast(message); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 4500); };

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); if (refreshTimer.current) clearTimeout(refreshTimer.current); }, []);
  useEffect(() => { setPage(1); }, [tab, query, status, range]);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setModal(null);
      if (event.key === 'Tab') {
        const elements = modalRef.current?.querySelectorAll<HTMLElement>('button, input, a[href]');
        if (!elements?.length) return;
        const first = elements[0]; const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; previous?.focus(); };
  }, [modal]);

  const selected = useMemo(() => inRange(entries, range.start, range.end) as Entry[], [entries, range]);
  const daily = entries.filter(row => row.settledDate === today && row.status === 'paid');
  const monthEntries = inRange(entries, month.start, month.end) as Entry[];
  const balance = live ? live.bankBalanceCents : actualBalance(entries, opening, today);
  const projection = live ? live.projectionCents : projectedBalance(entries, opening, today, month.end);
  const pendingIn = total(selected, 'in', 'pending');
  const pendingOut = total(selected, 'out', 'pending');
  const chart = aggregate(selected, range.start, range.end, period);
  const chartMax = Math.max(...chart.flatMap(point => [point.incoming, point.outgoing]), 100000);
  let running = 0;
  const balancePoints = chart.map(point => { running += point.incoming - point.outgoing; return running; });
  const balanceMin = Math.min(0, ...balancePoints);
  const balanceMax = Math.max(...balancePoints, 100000);
  const chartY = (value: number) => 182 - (chartType === 'flow' ? value / chartMax : (value - balanceMin) / (balanceMax - balanceMin)) * 148;
  const monthlyCosts = (Object.keys(emptyMapping) as (keyof CostMapping)[]).map(category => ({ category, amount: total(monthEntries.filter(row => live ? Boolean(row.accountId && costMapping[category].includes(row.accountId)) : row.category === category), 'out'), configured: !live || costMapping[category].length > 0 }));
  const totalCosts = monthlyCosts.reduce((sum, cost) => sum + cost.amount, 0);
  const boletos = selected.filter(row => row.boleto);
  const filtered = selected.filter(row => (tab === 'all' || (tab === 'boletos' ? row.boleto : row.direction === tab)) && (status === 'all' || row.status === status) && `${row.description} ${row.company} ${row.category}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
  const pages = Math.max(1, Math.ceil(filtered.length / 5));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * 5, safePage * 5);
  const periodLabel = period === 'month' ? now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : period === 'day' ? 'Hoje' : period === 'year' ? `Ano de ${now.getFullYear()}` : 'Período personalizado';

  function changePeriod(value: Period) {
    setPeriod(value);
    const next = value === 'day' ? { start: today, end: today } : value === 'year' ? { start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31` } : month;
    setRange(next); setDates(next); setDateError('');
    onRangeChange?.(next, value);
  }
  function applyDates() {
    if (!dates.start || !dates.end || dates.start > dates.end) { setDateError('Informe um período válido: a data inicial deve ser anterior ou igual à final.'); return; }
    if (Number(dates.start.slice(0, 4)) < (live ? 2000 : 1900) || Number(dates.end.slice(0, 4)) > (live ? 2099 : 2100) || (new Date(dates.end).getTime() - new Date(dates.start).getTime()) / 86400000 > 366) { setDateError(`Selecione um período de até 366 dias, entre ${live ? '2000 e 2099' : '1900 e 2100'}.`); return; }
    setRange(dates); setPeriod('custom'); setDateError('');
    onRangeChange?.(dates, 'custom');
  }
  function goTo(id: string, nextTab?: typeof tab) { setActiveNav(id); setSidebar(false); if (nextTab) setTab(nextTab); document.getElementById(id === 'overview' ? 'overview' : id === 'costs' ? 'costs' : id === 'flow' ? 'flow' : 'transactions')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  function exportCsv() {
    const url = URL.createObjectURL(new Blob([csv(filtered)], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `nexo-financeiro-${range.start}-${range.end}.csv`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(`${filtered.length} lançamentos${live ? '' : ' de demonstração'} exportados.`);
  }
  function refresh() { if (live) { onRefresh?.(); return; } setRefreshing(true); refreshTimer.current = setTimeout(() => { setUpdated(new Date()); setRefreshing(false); notify('Dados de demonstração atualizados. Use Acessar dados reais para consultar o Maxiprod.'); }, 650); }
  function saveOpening() {
    const value = Number(openingInput); if (!Number.isFinite(value) || Math.abs(value) > 1000000000 || openingInput.trim() === '') return;
    const cents = Math.round(value * 100); setOpening(cents);
    try { localStorage.setItem('nexo-opening-cents', String(cents)); notify('Saldo inicial de demonstração salvo neste navegador.'); } catch { notify('Saldo alterado nesta sessão. O navegador não permitiu salvar.'); }
    setModal(null);
  }

  return <div className="app-shell">
    {sidebar && <button className="mobile-overlay" aria-label="Fechar menu" onClick={() => setSidebar(false)} />}
    <aside className={`sidebar ${sidebar ? 'is-open' : ''}`}>
      <a className="brand" href="#overview" onClick={() => goTo('overview')} aria-label="Premium Flex, início"><PremiumFlexLogo /></a>
      <button className="workspace-selector" onClick={() => setModal('integration')}><span className="workspace-avatar"><Building2 size={18} /></span><span>Premium Flex<small>{live ? live.company.name : 'Ambiente de demonstração'}</small></span><ChevronDown size={15} /></button>
      <div className="nav-label">WORKSPACE</div>
      <nav aria-label="Navegação principal">
        <button className={activeNav === 'overview' ? 'active' : ''} onClick={() => goTo('overview')}><LayoutDashboard size={18} />Visão geral<span className="nav-active-dot" /></button>
        <button className={activeNav === 'flow' ? 'active' : ''} onClick={() => goTo('flow')}><Activity size={18} />Fluxo de caixa</button>
        <button className={activeNav === 'payables' ? 'active' : ''} onClick={() => goTo('payables', 'out')}><ArrowUpRight size={18} />Contas a pagar</button>
        <button className={activeNav === 'receivables' ? 'active' : ''} onClick={() => goTo('receivables', 'in')}><ArrowDownLeft size={18} />Contas a receber</button>
        <button className={activeNav === 'boletos' ? 'active' : ''} onClick={() => goTo('boletos', 'boletos')}><FileText size={18} />Boletos e cobranças</button>
        <button className={activeNav === 'costs' ? 'active' : ''} onClick={() => goTo('costs')}><FileBarChart2 size={18} />Custos mensais</button>
      </nav>
      <div className="nav-label tools-label">GERENCIAR</div>
      <nav aria-label="Configurações"><button onClick={() => setModal('integration')}><Link2 size={18} />Integração Maxiprod<span className="tiny-dot" /></button><button onClick={() => { if (live) { onSettings?.(); } else { setOpeningInput(String(opening / 100)); setModal('balance'); } }}><Settings2 size={18} />Configurações</button></nav>
      <div className="sidebar-bottom"><div className="help-card"><span className="help-icon"><Sparkles size={18} /></span><strong>Clareza para decidir.</strong><p>Seu financeiro conectado,<br />sua empresa no controle.</p><button onClick={() => setModal('help')}>Conheça seu painel <ArrowUpRight size={14} /></button></div><button className="help-link" onClick={() => setModal('help')}><CircleHelp size={17} />Ajuda e informações<ArrowUpRight size={14} /></button><div className="profile"><div className="avatar">PF</div><span>Premium Flex<small>{live ? 'Acesso protegido' : 'Administrador · Demo'}</small></span><button className="icon-button" aria-label="Configurações do perfil" onClick={() => setModal('help')}><MoreHorizontal size={18} /></button></div></div>
    </aside>

    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Abrir menu" onClick={() => setSidebar(true)}><Menu size={20} /></button><span className="mobile-brand"><PremiumFlexLogo /></span><LayoutDashboard size={16} /><span>Workspace</span><ChevronRight size={13} /><strong>Painel financeiro</strong></div><div className="topbar-actions"><span className="demo-badge"><span />{live ? 'Maxiprod · acesso protegido' : 'Modo demonstração'}</span><button className="button access-button" onClick={live ? onLogout : onConnect}>{live ? 'Sair' : 'Acessar dados reais'}</button><div className="topbar-separator" /><button className="icon-button notification-button" aria-label="Notificações" onClick={() => notify(live ? 'Os avisos da consulta estão disponíveis logo abaixo dos filtros.' : 'Você está no modo demonstração. Nenhuma notificação financeira real disponível.')}><Bell size={18} /><i /></button><div className="avatar small">PF</div><BrazilFlag /></div></header>
      <main id="overview">
        <section className="page-heading"><div><div className="eyebrow">FINANÇAS, SEM COMPLICAÇÃO</div><h1>Seu financeiro, em perspectiva<span>.</span></h1><p>Acompanhe os números de hoje. Planeje os próximos passos.</p></div><button className="button export-button" onClick={exportCsv}><ArrowDownToLine size={16} />Exportar relatório</button></section>
        <section className="filter-bar" aria-label="Filtros de período"><div className="period-tabs">{([['day', 'Diário'], ['month', 'Mensal'], ['year', 'Anual']] as const).map(([key, label]) => <button key={key} aria-pressed={period === key} className={period === key ? 'selected' : ''} onClick={() => changePeriod(key)}>{label}</button>)}</div><span className="filter-divider" /><div className="date-fields"><label><CalendarDays size={15} /><span className="sr-only">Data início</span><span className="date-display" aria-hidden="true">{dates.start ? prettyDate(dates.start) : "dd/mm/aaaa"}</span><input aria-label="Data início" lang="pt-BR" type="date" value={dates.start} onChange={event => setDates({ ...dates, start: event.target.value })} /></label><span className="date-arrow">→</span><label><span className="sr-only">Data fim</span><span className="date-display" aria-hidden="true">{dates.end ? prettyDate(dates.end) : "dd/mm/aaaa"}</span><input aria-label="Data fim" lang="pt-BR" type="date" value={dates.end} onChange={event => setDates({ ...dates, end: event.target.value })} /></label><button className="apply-filter" onClick={applyDates}>Aplicar</button></div><div className="update-info"><span>Atualizado às {updated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span><button className={`icon-button ${refreshing ? 'spinning' : ''}`} disabled={refreshing} aria-label={live ? 'Atualizar Maxiprod' : 'Atualizar demonstração'} onClick={refresh}><RefreshCw size={15} /></button></div></section>
        {dateError && <p className="form-error" role="alert">{dateError}</p>}
        {live && <div className="connection-details"><label>Empresa <select aria-label="Empresa do painel" value={live.company.id} onChange={event => onCompanyChange?.(event.target.value)}>{live.companies.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><details><summary>Regras e avisos desta consulta</summary>{live.warnings.map(warning => <p key={warning}>{warning}</p>)}</details></div>}

        <div className="section-caption"><span className="live-dot" />Seu dia em números<span className="caption-date">{now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span></div>
        <section className="kpi-grid" aria-label="Indicadores financeiros">
          <article className="kpi-card"><div className="kpi-top"><span>{live ? 'Saldo caixa/bancos hoje' : 'Saldo bancário hoje'}</span><span className="metric-icon purple"><Wallet size={18} /></span></div><strong data-testid="bank-balance">{money(balance)}</strong><div className="kpi-foot"><span className="small-dot purple-dot" />Saldo consolidado <span className="subtle">· {live ? 'base contábil' : 'demonstração'}</span>{live && <button className="inline-settings" onClick={onSettings}>Configurar saldo</button>}</div></article>
          <article className="kpi-card"><div className="kpi-top"><span>Recebimentos do dia</span><span className="metric-icon green"><ArrowDownLeft size={19} /></span></div><strong>{money(live ? live.daily.incomingCents : total(daily, 'in'))}</strong><div className="kpi-foot"><span className="mini-tag green-text"><CheckCheck size={12} />Recebido</span><span>{live ? live.daily.incomingCount : daily.filter(row => row.direction === 'in').length} lançamento(s) hoje</span></div></article>
          <article className="kpi-card"><div className="kpi-top"><span>Pagamentos do dia</span><span className="metric-icon coral"><ArrowUpRight size={19} /></span></div><strong>{money(live ? live.daily.outgoingCents : total(daily, 'out'))}</strong><div className="kpi-foot"><span className="mini-tag coral-text"><CheckCheck size={12} />Pago</span><span>{live ? live.daily.outgoingCount : daily.filter(row => row.direction === 'out').length} lançamento(s) hoje</span></div></article>
          <article className={`kpi-card projection-card ${projection !== null && projection < 0 ? 'negative' : ''}`}><div className="kpi-top"><span>Projeção no fim do mês</span><span className="metric-icon"><Activity size={18} /></span></div><strong data-testid="projected-balance">{money(projection)}</strong><div className="kpi-foot"><span className="projection-badge">{projection !== null && (projection >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />)}{projection === null ? 'Saldo inicial pendente' : projection >= 0 ? 'Saldo positivo' : 'Saldo negativo'}</span><span>Até {prettyDate(month.end).slice(0, 5)}</span><span className="info-tooltip" tabIndex={0} aria-label="Projeção: saldo atual mais todos os títulos em aberto com vencimento até o fim do mês, incluindo atrasados."><CircleHelp size={13} /><span>Saldo atual + recebimentos em aberto − pagamentos em aberto até o fim do mês, incluindo atrasados.</span></span></div></article>
        </section>

        <section className="middle-grid"><article className="card flow-card" id="flow"><div className="card-heading"><div><h2>Fluxo de caixa <span className="muted-chip">{periodLabel}</span></h2><p>Entradas e saídas lançadas · realizadas e previstas</p></div><div className="chart-switch"><button className={chartType === 'flow' ? 'active' : ''} aria-pressed={chartType === 'flow'} onClick={() => setChartType('flow')}>Fluxo</button><button className={chartType === 'balance' ? 'active' : ''} aria-pressed={chartType === 'balance'} onClick={() => setChartType('balance')}>Resultado</button></div></div>
          <div className="chart-summary"><div><span><i className="legend-dot green-bg" />Entradas</span><strong>{money(total(selected, 'in'))}</strong></div><div><span><i className="legend-dot purple-bg" />Saídas</span><strong>{money(total(selected, 'out'))}</strong></div><div className="chart-result"><span>Resultado do período</span><strong className={total(selected, 'in') - total(selected, 'out') >= 0 ? 'green-text' : 'coral-text'}>{money(total(selected, 'in') - total(selected, 'out'))}<ArrowUpRight size={15} /></strong></div></div>
          <div className="chart-wrap" onMouseLeave={() => setHovered(null)}><svg className="cash-chart" viewBox="0 0 720 222" role="img" aria-label={`Gráfico de ${chartType === 'flow' ? 'entradas e saídas' : 'resultado acumulado'} entre ${prettyDate(range.start)} e ${prettyDate(range.end)}`}>
            <defs><linearGradient id="balance-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8d74e4" stopOpacity="0.24" /><stop offset="100%" stopColor="#8d74e4" stopOpacity="0.01" /></linearGradient></defs>
            {[0, 1, 2, 3, 4].map(index => { const value = chartType === 'flow' ? chartMax * (4 - index) / 4 : balanceMin + (balanceMax - balanceMin) * (4 - index) / 4; const y = 34 + index * 37; return <g key={index}><line x1="62" x2="710" y1={y} y2={y} stroke="#eef0f3" strokeDasharray="4 5" /><text x="47" y={y + 4} textAnchor="end" className="chart-axis">{shortMoney(value)}</text></g>; })}
            {chartType === 'balance' && balancePoints.length > 0 && <><path d={`M ${62 + 648 / chart.length / 2} 182 ${balancePoints.map((value, index) => `L ${62 + (index + 0.5) * 648 / chart.length} ${chartY(value)}`).join(' ')} L ${62 + (chart.length - 0.5) * 648 / chart.length} 182 Z`} fill="url(#balance-fill)" /><polyline points={balancePoints.map((value, index) => `${62 + (index + 0.5) * 648 / chart.length},${chartY(value)}`).join(' ')} fill="none" stroke="#8060d4" strokeWidth="3" strokeLinejoin="round" /></>}
            {chart.map((point, index) => { const center = 62 + (index + 0.5) * 648 / chart.length; const width = Math.min(20, 648 / chart.length * 0.28); return <g key={point.key} onMouseEnter={() => setHovered(index)}><rect x={center - 648 / chart.length / 2} y="22" width={648 / chart.length} height="180" fill={hovered === index ? '#f8f7fc' : 'transparent'} />{chartType === 'flow' ? <><rect x={center - width - 3} y={chartY(point.incoming)} width={width} height={182 - chartY(point.incoming)} rx="4" fill="#48b9a3" /><rect x={center + 3} y={chartY(point.outgoing)} width={width} height={182 - chartY(point.outgoing)} rx="4" fill="#a58bdf" /></> : <circle cx={center} cy={chartY(balancePoints[index])} r="4" fill="#8060d4" />}{(chart.length <= 13 || index % Math.ceil(chart.length / 10) === 0) && <text x={center} y="210" textAnchor="middle" className="chart-axis">{point.label}</text>}</g>; })}
          </svg>{hovered !== null && chart[hovered] && <div className="chart-tooltip"><strong>{chart[hovered].label}</strong><span>Entradas: {money(chart[hovered].incoming)}</span><span>Saídas: {money(chart[hovered].outgoing)}</span></div>}</div>
          <div className="flow-card-bottom"><span><Clock3 size={13} />Valores por vencimento dos lançamentos</span><span>BRL · R$</span></div>
        </article>

        <article className="card costs-card" id="costs"><div className="card-heading"><div><h2>Custos do mês</h2><p className="capitalize">{now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p></div><button className="icon-button" aria-label="Configurar categorias de custo" onClick={() => live ? onSettings?.() : setModal('integration')}><Settings2 size={18} /></button></div><div className="cost-total"><span>{live ? 'Total das categorias configuradas' : 'Total de custos lançados'}</span><strong>{money(live && !monthlyCosts.some(cost => cost.configured) ? null : totalCosts)}</strong></div><div className="cost-items">{monthlyCosts.map((cost, index) => { const Icon = [Truck, Users, Building2][index]; return <div className="cost-row" key={cost.category}><div className={`cost-icon cost-${index}`}><Icon size={17} /></div><div className="cost-details"><div><span>{['Frete e logística', 'Salários', 'Bancos e financiamentos'][index]}</span><strong>{cost.configured ? money(cost.amount) : 'Selecionar contas'}</strong></div><div className="cost-progress"><i className={`cost-fill-${index}`} style={{ width: `${totalCosts ? cost.amount / totalCosts * 100 : 0}%` }} /></div><small>{cost.configured ? `${totalCosts ? Math.round(cost.amount / totalCosts * 100) : 0}% dos custos configurados do mês` : 'Aguardando seleção de contas'}</small></div></div>; })}</div><div className="cost-footer"><ShieldCheck size={14} />Visão mensal fixa · {live ? 'contas selecionadas' : 'valores de demonstração'}</div></article></section>

        <section className="obligation-grid" aria-label="Contas lançadas no período"><button className={`obligation-card ${tab === 'out' ? 'chosen' : ''}`} onClick={() => { setTab('out'); goTo('payables', 'out'); }}><span className="obligation-icon coral"><ArrowUpRight size={20} /></span><div><span>Contas a pagar <small>· período selecionado</small></span><strong>{money(pendingOut)}</strong><p>{selected.filter(row => row.direction === 'out' && row.status === 'pending').length} títulos em aberto <span>de {money(total(selected, 'out'))} lançados</span></p></div><ArrowRight className="obligation-arrow" size={17} /></button><button className={`obligation-card ${tab === 'in' ? 'chosen' : ''}`} onClick={() => goTo('receivables', 'in')}><span className="obligation-icon green"><ArrowDownLeft size={20} /></span><div><span>Contas a receber <small>· período selecionado</small></span><strong>{money(pendingIn)}</strong><p>{selected.filter(row => row.direction === 'in' && row.status === 'pending').length} títulos em aberto <span>de {money(total(selected, 'in'))} lançados</span></p></div><ArrowRight className="obligation-arrow" size={17} /></button><button className={`obligation-card ${tab === 'boletos' ? 'chosen' : ''}`} onClick={() => goTo('boletos', 'boletos')}><span className="obligation-icon purple"><FileText size={20} /></span><div><span>Boletos e cobranças <small>· lançados</small></span><strong>{money(total(boletos))}</strong><p>{boletos.length} boletos no período <span>{boletos.filter(row => row.status === 'pending').length} em aberto</span></p></div><ArrowRight className="obligation-arrow" size={17} /></button></section>

        <section className="card transactions-card" id="transactions"><div className="card-heading"><div><h2>Movimentações financeiras</h2><p>Todos os seus lançamentos, no mesmo lugar.</p></div><span className="records-chip">{selected.length} lançamentos</span></div><div className="table-toolbar"><div className="table-tabs">{([['all', 'Todos'], ['out', 'A pagar'], ['in', 'A receber'], ['boletos', 'Boletos']] as const).map(([key, label]) => <button className={tab === key ? 'active' : ''} aria-pressed={tab === key} key={key} onClick={() => setTab(key)}>{label}{tab === key && <span>{filtered.length}</span>}</button>)}</div><div className="table-tools"><label className="search-input"><Search size={15} /><input aria-label="Buscar lançamento" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar lançamento..." />{query && <button className="icon-button" aria-label="Limpar busca" onClick={() => setQuery('')}><X size={13} /></button>}</label><button className={`button filter-toggle ${showFilters ? 'active' : ''}`} aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal size={15} />Filtros{status !== 'all' && <span className="tiny-dot" />}</button></div></div>
          {showFilters && <div className="expanded-filters"><label>Situação<select aria-label="Situação do lançamento" value={status} onChange={event => setStatus(event.target.value)}><option value="all">Todas as situações</option><option value="pending">Em aberto</option><option value="paid">Liquidado</option></select></label><button onClick={() => { setStatus('all'); setQuery(''); }}>Limpar filtros</button></div>}
          <div className="table-scroll"><table><thead><tr><th>Descrição / favorecido</th><th>Tipo</th><th>Categoria</th><th>Vencimento</th><th>Situação</th><th className="text-right">Valor</th></tr></thead><tbody>{visible.map(row => <tr key={row.id}><td><div className="description-cell"><span className={`transaction-icon ${row.direction === 'in' ? 'green' : 'coral'}`}>{row.direction === 'in' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span><div><strong>{row.description}</strong><small>{row.company}</small></div></div></td><td><span className={row.direction === 'in' ? 'green-text' : 'coral-text'}>{row.direction === 'in' ? 'Entrada' : 'Saída'}</span></td><td><span className="category-tag">{row.category}</span></td><td className="date-cell">{prettyDate(row.dueDate)}</td><td><span className={`status-badge ${row.status === 'paid' ? 'settled' : row.dueDate < today ? 'overdue' : 'pending'}`}><span />{row.status === 'paid' ? row.direction === 'in' ? 'Recebido' : 'Pago' : row.paidCents && row.paidCents > 0 ? 'Parcial' : row.dueDate < today ? 'Em atraso' : 'Em aberto'}</span></td><td className={`text-right amount-cell ${row.direction === 'in' ? 'green-text' : ''}`}>{row.direction === 'in' ? '+' : '−'} {money(row.amountCents)}{live && <small className="open-amount">Em aberto: {money(row.outstandingCents || 0)}</small>}</td></tr>)}</tbody></table>{visible.length === 0 && <div className="empty-state"><Search size={27} /><strong>Nenhum lançamento encontrado</strong><p>Tente outro período ou ajuste a busca e os filtros.</p><button className="button" onClick={() => { setQuery(''); setStatus('all'); setTab('all'); }}>Limpar busca e filtros</button></div>}</div><div className="table-footer"><span>{filtered.length ? `Exibindo ${(safePage - 1) * 5 + 1}–${Math.min(safePage * 5, filtered.length)} de ${filtered.length} lançamentos` : '0 lançamentos'}<span className="table-range"> · {prettyDate(range.start)} a {prettyDate(range.end)}</span></span><div className="pagination"><button aria-label="Página anterior" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}><ChevronLeft size={15} /></button><span>{safePage} <span>de {pages}</span></span><button aria-label="Próxima página" disabled={safePage === pages} onClick={() => setPage(safePage + 1)}><ChevronRight size={15} /></button></div></div>
        </section>
        <footer className="page-footer"><span><span className="footer-logo">Premium Flex</span> Menos planilhas. Mais clareza.</span><button onClick={() => setModal('integration')}><span className="tiny-dot" />{live ? 'Maxiprod · consulta protegida' : 'Maxiprod ainda não conectado'}<ArrowUpRight size={12} /></button></footer>
      </main>
    </div>
    {toast && <div className="toast" role="status"><Check size={17} /><span>{toast}</span><button className="icon-button" aria-label="Fechar aviso" onClick={() => setToast('')}><X size={15} /></button></div>}
    {modal && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setModal(null); }}><div className="modal" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="icon-button modal-close" aria-label="Fechar janela" ref={closeRef} onClick={() => setModal(null)}><X size={20} /></button><span className="modal-icon">{modal === 'integration' ? <Link2 size={26} /> : modal === 'balance' ? <Wallet size={26} /> : <Sparkles size={26} />}</span><h2 id="modal-title">{modal === 'integration' ? 'Conecte seu financeiro' : modal === 'balance' ? 'Saldo inicial de demonstração' : 'Um painel. Todas as respostas.'}</h2>
      {modal === 'integration' ? <><p>{live ? 'A consulta usa a conexão protegida com o Maxiprod. A chave da API permanece no servidor.' : 'A conexão usa o servidor do Netlify e uma senha própria de acesso. Os números da demonstração continuam separados dos dados reais.'}</p><div className="integration-status"><span className="tiny-dot" /><span>{live ? 'Consulta Maxiprod concluída' : 'Aguardando configuração da API e acesso protegido'}</span></div>{live ? <><p>As categorias de custo e o saldo inicial são configurados por empresa e salvos no servidor para a equipe.</p><button className="button primary full-width" onClick={onSettings}>Configurar financeiro<Settings2 size={16} /></button></> : <ol className="integration-steps"><li>Cadastre MAXIPROD_API_KEY e DASHBOARD_PASSWORD como segredos no Netlify.</li><li>Publique o projeto pelo GitHub para incluir as funções.</li><li>Entre, valide os lançamentos e configure as categorias de custo.</li></ol>}<div className="modal-note"><ShieldCheck size={18} />A chave de API não deve ser digitada neste painel. Use apenas a senha de acesso.</div><button className="button primary full-width" onClick={() => { setModal(null); if (!live) onConnect?.(); }}>{live ? 'Concluir' : 'Acessar dados reais'}<ArrowRight size={16} /></button></> : modal === 'balance' ? <form onSubmit={event => { event.preventDefault(); saveOpening(); }}><p>Saldo em 1º de janeiro de {now.getFullYear()}, antes dos lançamentos de demonstração. A alteração fica salva apenas neste navegador.</p><label className="balance-label">Saldo inicial (R$)<input aria-label="Saldo inicial em reais" type="number" step="0.01" min="-1000000000" max="1000000000" required onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); saveOpening(); } }} value={openingInput} onChange={event => setOpeningInput(event.target.value)} /></label><div className="modal-note"><Banknote size={18} />O saldo diário e a projeção são recalculados automaticamente.</div><button type="button" onClick={saveOpening} className="button primary full-width">Salvar saldo inicial<Check size={16} /></button></form> : <><p>Use os filtros diário, mensal e anual ou escolha suas próprias datas. Os gráficos e lançamentos acompanham o período selecionado.</p><div className="help-details"><p><CalendarDays size={18} /><span><strong>Seu dia e seu mês</strong>Os indicadores diários e os custos do mês permanecem como referência, independentemente do filtro.</span></p><p><CreditCard size={18} /><span><strong>Uma visão do que vem pela frente</strong>A projeção soma ao saldo atual os títulos em aberto até o fim do mês, incluindo atrasados.</span></p><p><ArrowDownToLine size={18} /><span><strong>Seus dados em uma planilha</strong>Exporte os lançamentos do período, respeitando a aba, a busca e os filtros atuais.</span></p></div><div className="modal-note">{live ? 'Os totais refletem as regras e os avisos da consulta. Valide a conciliação com o Maxiprod.' : 'Este modo usa dados fictícios. Use Acessar dados reais para abrir a conexão protegida.'}</div><button className="button primary full-width" onClick={() => setModal(null)}>Explorar meu painel<ArrowRight size={16} /></button></>}
    </div></div>}
  </div>;
}

export default App;
