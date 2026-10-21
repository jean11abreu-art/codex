import { useEffect, useState, type FormEvent } from 'react';
import { api, emptyMapping, type Account, type Company, type CostMapping, type FinancialSettingsData } from './connection';
import { PremiumFlexLogo, BrazilFlag } from './Brand';
import { parseRealInput } from './money-input.mjs';

type Snapshot = { settings: FinancialSettingsData; version: string | null; source: string; savedAt: string | null; company: Company; companies: Company[]; accounts: Account[]; today: string };
const categories = Object.keys(emptyMapping) as (keyof CostMapping)[];
const moneyInput = (cents: number) => (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function FinancialSettings({ companyId, onSaved, onCancel }: { companyId: string; onSaved: (id: string) => void; onCancel: () => void }) {
  const [selectedCompany, setSelectedCompany] = useState(companyId);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [costs, setCosts] = useState<CostMapping>(emptyMapping);
  const [searches, setSearches] = useState({ Frete: '', 'Salários': '', Financiamento: '' });
  const [useOpening, setUseOpening] = useState(false);
  const [openingDate, setOpeningDate] = useState('');
  const [openingInput, setOpeningInput] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [migration, setMigration] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setSnapshot(null); setError(''); setMigration(false);
    (async () => {
      try {
        const params = new URLSearchParams(); if (selectedCompany) params.set('company', selectedCompany);
        const result = await api('/api/settings?' + params, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setCompanies(result.companies);
        if (result.needsCompany) return;
        setSnapshot(result); setUseOpening(Boolean(result.settings.opening));
        setOpeningDate(result.settings.opening?.date || result.today);
        setOpeningInput(result.settings.opening ? moneyInput(result.settings.opening.cents) : '');
        let mapping = result.settings.costMapping as CostMapping;
        if (result.version === null) {
          try {
            const legacy = JSON.parse(localStorage.getItem('pf-cost-accounts-' + result.company.id) || 'null');
            const available = new Set(result.accounts.map((account: Account) => account.id)); const seen = new Set<string>();
            if (legacy && categories.every(category => Array.isArray(legacy[category]))) {
              const imported = Object.fromEntries(categories.map(category => [category, legacy[category].filter((id: unknown) => {
                if (typeof id !== 'string' || !available.has(id) || seen.has(id)) return false;
                seen.add(id); return true;
              })])) as CostMapping;
              if (seen.size) { mapping = imported; setMigration(true); }
            }
          } catch { /* Optional import of account IDs only; never monetary values. */ }
        }
        setCosts(mapping);
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar as configurações.'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [selectedCompany, reload]);

  function toggle(category: keyof CostMapping, accountId: string) {
    setCosts(previous => {
      const checked = !previous[category].includes(accountId);
      return Object.fromEntries(categories.map(other => [other, other === category ? checked ? [...previous[other], accountId] : previous[other].filter(id => id !== accountId) : checked ? previous[other].filter(id => id !== accountId) : previous[other]])) as CostMapping;
    });
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!snapshot) return;
    setError('');
    let opening = null;
    try {
      if (useOpening) {
        if (!openingDate || openingDate > snapshot.today) throw new Error('Escolha uma data de referência até hoje.');
        opening = { date: openingDate, cents: parseRealInput(openingInput) };
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Revise o saldo inicial.'); return; }
    setBusy(true);
    try {
      await api('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId: snapshot.company.id, expectedVersion: snapshot.version, costMapping: costs, opening }) });
      try { localStorage.removeItem('pf-cost-accounts-' + snapshot.company.id); } catch { /* The server now owns the saved settings. */ }
      onSaved(snapshot.company.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar as configurações.'); }
    finally { setBusy(false); }
  }
  return <main className="financial-settings"><section className="settings-panel"><header className="settings-header"><PremiumFlexLogo /><BrazilFlag /></header>
    <div className="settings-title"><div><p className="eyebrow">PAINEL FINANCEIRO</p><h1>Configurações financeiras</h1><p>{snapshot ? snapshot.company.name : 'Selecione as contas e informe o saldo de referência.'}</p></div><button className="button" disabled={busy} onClick={onCancel}>Voltar ao painel</button></div>
    {loading && <p role="status">Carregando configurações salvas…</p>}
    {error && <div className="settings-error"><p className="form-error" role="alert">{error}</p><button type="button" className="button" disabled={busy} onClick={() => setReload(value => value + 1)}>Recarregar configurações</button></div>}
    {!loading && !snapshot && !error && <label className="balance-label">Empresa<select aria-label="Empresa das configurações" value="" onChange={event => setSelectedCompany(event.target.value)}><option value="" disabled>Selecione sua empresa</option>{companies.map(company => <option value={company.id} key={company.id}>{company.name}</option>)}</select></label>}
    {snapshot && <form onSubmit={save}><fieldset disabled={busy} className="settings-fields"><legend className="sr-only">Configurações de {snapshot.company.name}</legend>
      <section><h2>Categorias de custo</h2><p>Marque as contas de destino que compõem cada custo. Uma conta pertence a uma categoria por vez. Os totais usam o vencimento dos títulos do mês.</p>{migration && <p className="settings-note">Importei a seleção anterior deste navegador para revisão. Confira e salve para disponibilizá-la à equipe.</p>}
        <div className="cost-settings-grid">{categories.map(category => {
          const term = searches[category].trim().toLocaleLowerCase('pt-BR');
          const matching = snapshot.accounts.filter(account => `${account.code} ${account.name}`.toLocaleLowerCase('pt-BR').includes(term));
          return <fieldset className="cost-choice" key={category}><legend>{category === 'Financiamento' ? 'Bancos e financiamentos' : category}<span>{costs[category].length} selecionada(s)</span></legend><label className="sr-only" htmlFor={`cost-search-${category}`}>Buscar contas de {category}</label><input id={`cost-search-${category}`} type="search" onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }} value={searches[category]} placeholder="Buscar nome ou código da conta" onChange={event => setSearches(previous => ({ ...previous, [category]: event.target.value }))} /><div className="account-choices">{matching.slice(0, 40).map(account => <label key={account.id}><input type="checkbox" aria-label={`${category}: ${account.code} ${account.name}`} checked={costs[category].includes(account.id)} onChange={() => toggle(category, account.id)} /><span><strong>{account.name}</strong><small>{account.code}</small></span></label>)}{!matching.length && <p>Nenhuma conta encontrada.</p>}</div><small>{matching.length > 40 ? `Mostrando 40 de ${matching.length} contas. Use a busca para localizar outras.` : `${matching.length} conta(s) disponível(is).`}</small>{costs[category].length > 0 && <div className="selected-accounts" aria-label={`Contas selecionadas de ${category}`}>{costs[category].map(id => <span key={id}>{snapshot.accounts.find(account => account.id === id)?.name || 'Conta indisponível'}<button type="button" aria-label={`Remover ${id} de ${category}`} onClick={() => toggle(category, id)}>×</button></span>)}</div>}</fieldset>;
        })}</div>
      </section>
      <section className="opening-settings"><h2>Saldo inicial de caixa e bancos</h2><p>Informe o saldo consolidado de todas as contas de caixa/bancos <strong>antes dos movimentos da data escolhida</strong>. Para começar hoje, use o saldo de encerramento de ontem.</p><label className="opening-toggle"><input type="checkbox" checked={useOpening} onChange={event => setUseOpening(event.target.checked)} />Usar saldo inicial real</label>{useOpening ? <div className="opening-fields"><label>Data de referência<div className="opening-date"><span aria-hidden="true">{openingDate ? new Date(openingDate + 'T12:00:00').toLocaleDateString('pt-BR') : 'dd/mm/aaaa'}</span><input aria-label="Data de referência do saldo" type="date" lang="pt-BR" required min="2000-01-01" max={snapshot.today} value={openingDate} onChange={event => setOpeningDate(event.target.value)} /></div></label><label>Saldo consolidado (R$)<input aria-label="Saldo consolidado em reais" type="text" inputMode="decimal" required placeholder="0,00" value={openingInput} onChange={event => setOpeningInput(event.target.value)} /><small>Use vírgula para os centavos. Saldos negativos são permitidos.</small></label></div> : <p className="settings-note">Sem saldo inicial, saldo bancário e projeção continuam como “A configurar”.</p>}</section>
      <p className="settings-note">As configurações serão salvas no servidor para esta empresa e compartilhadas com quem acessa o painel. Elas não alteram os registros do Maxiprod.</p>
      <div className="settings-actions"><span>{snapshot.savedAt ? `Último salvamento: ${new Date(snapshot.savedAt).toLocaleString('pt-BR')}` : 'As configurações ainda não foram salvas no painel.'}</span><button className="button primary" type="submit">{busy ? 'Salvando…' : 'Salvar configurações'}</button></div>
    </fieldset></form>}
  </section></main>;
}
