import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { formatBDT, formatDate } from '../../utils/format';
import { PageHeader, Avatar, Badge, STATUS_TONE, Loading, Modal, Pagination } from '../ui';

const PER = 10;
const CFG = {
  users: { title: 'Customers', sub: 'Approve, reject or suspend customer registrations', path: 'users' },
  accounts: { title: 'Accounts', sub: 'Review bank account applications', path: 'accounts' },
  cards: { title: 'Cards', sub: 'Review Visa / Mastercard applications', path: 'cards' },
};
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export default function Directory({ kind, call, stats, reloadStats, initialStatus }) {
  const cfg = CFG[kind];
  const [filter, setFilter] = useState(initialStatus || 'all');
  const [rows, setRows] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [reason, setReason] = useState('');
  const [limit, setLimit] = useState('50000');

  const load = useCallback(async () => {
    setError(''); setRows(null);
    try { setRows(await call(`/admin/${cfg.path}${filter === 'all' ? '' : `?status=${filter}`}`)); }
    catch (e) { setError(e.message); setRows([]); }
  }, [call, cfg.path, filter]);
  useEffect(() => { load(); setPage(1); }, [load]);

  const act = async (id, action, body = {}) => {
    setBusy(true); setError('');
    try {
      await call(`/admin/${cfg.path}/${id}/${action}`, { method: 'POST', body });
      setDialog(null); setReason('');
      await Promise.all([load(), reloadStats()]);
    } catch (e) { setError(e.message); }
    setBusy(false);
  };
  const open = (row, action) => {
    const needs = ['reject', 'suspend', 'block'].includes(action) || (kind === 'cards' && action === 'approve' && row.cardType === 'credit');
    needs ? setDialog({ row, action }) : act(row.id, action);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !rows) return rows;
    return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q));
  }, [rows, search]);
  const pages = Math.max(1, Math.ceil((filtered?.length || 0) / PER));
  const view = (filtered || []).slice((page - 1) * PER, page * PER);

  const heads = { users: ['Customer', 'Phone', 'Member since'], accounts: ['Customer', 'Account', 'Balance'], cards: ['Customer', 'Card', 'Limit'] }[kind];
  const cell = (r) => {
    const name = kind === 'users' ? r.name : r.customer;
    if (kind === 'users') return [<div key="a"><p className="font-medium text-white">{name}</p><p className="text-xs text-ink-400">{r.email}</p></div>, r.phone, formatDate(r.createdAt || r.memberSince)];
    if (kind === 'accounts') return [<div key="a"><p className="font-medium text-white">{name}</p><p className="text-xs text-ink-400">{r.phone}</p></div>, <div key="b"><p className="capitalize">{r.accountType}</p><p className="text-xs font-mono text-ink-400">{r.accountNumber || 'Not issued'}</p></div>, r.status === 'approved' ? formatBDT(r.balance) : '—'];
    return [<div key="a"><p className="font-medium text-white">{name}</p><p className="text-xs text-ink-400">{r.phone}</p></div>, <div key="b"><p className="capitalize">{r.network} {r.cardType}</p><p className="text-xs font-mono text-ink-400">{r.numberMasked || 'Not issued'}</p></div>, r.cardType === 'credit' && r.creditLimit ? formatBDT(r.creditLimit) : '—'];
  };
  const actions = (r) => {
    const a = [];
    if (r.status === 'pending') a.push(['approve', 'btn-brand'], ['reject', 'btn-ghost']);
    if (kind === 'users' && r.status === 'approved') a.push(['suspend', 'btn-danger']);
    if (kind === 'users' && ['suspended', 'rejected'].includes(r.status)) a.push(['approve', 'btn-brand']);
    if (kind === 'cards' && r.status === 'approved') a.push(['block', 'btn-danger']);
    return a;
  };
  const pend = { users: stats?.pendingUsers, accounts: stats?.pendingAccounts, cards: stats?.pendingCards }[kind];

  return (
    <div>
      <PageHeader title={cfg.title} subtitle={cfg.sub}>
        <button onClick={load} className="btn-ghost !p-2.5" aria-label="Refresh"><RefreshCw className="w-4 h-4" /></button>
      </PageHeader>

      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-ink-700/70">
          <div className="flex gap-1 rounded-xl bg-ink-850 p-1">
            {['all', 'pending', 'approved', 'rejected'].map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3.5 py-1.5 text-sm font-medium capitalize ${filter === f ? 'bg-brand-500 text-white' : 'text-ink-300 hover:text-white'}`}>
                {f}{f === 'pending' && pend > 0 ? ` (${pend})` : ''}
              </button>
            ))}
          </div>
          <div className="relative ml-auto w-full sm:w-72"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" /><input className="field pl-9" placeholder="Search…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>
        </div>
        {error && <p className="px-5 py-3 text-sm text-red-400">{error}</p>}
        {rows === null ? <Loading /> : view.length === 0 ? <p className="px-5 py-14 text-center text-sm text-ink-400">Nothing here</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead><tr className="border-b border-ink-700/70">{heads.map((h) => <th key={h} className="th">{h}</th>)}<th className="th">Status</th><th className="th text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-ink-700/50">
                {view.map((r) => {
                  const c = cell(r);
                  return (
                    <tr key={r.id} className="hover:bg-ink-850/60 align-middle">
                      <td className="td"><div className="flex items-center gap-3"><Avatar name={(kind === 'users' ? r.name : r.customer) || '?'} />{c[0]}</div></td>
                      <td className="td text-slate-300">{c[1]}</td>
                      <td className="td text-slate-300">{c[2]}</td>
                      <td className="td"><Badge tone={STATUS_TONE[r.status] || 'slate'}>{r.status}</Badge>{r.reason && <p className="text-xs text-ink-400 mt-1 max-w-[12rem] truncate" title={r.reason}>{r.reason}</p>}</td>
                      <td className="td"><div className="flex justify-end gap-2">{actions(r).map(([a, cls]) => <button key={a} disabled={busy} onClick={() => open(r, a)} className={`${cls} !py-1.5 !px-3 capitalize`}>{a}</button>)}</div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {filtered && filtered.length > 0 && <Pagination page={page} pages={pages} onPage={setPage} info={`Showing ${(page - 1) * PER + 1} to ${Math.min(page * PER, filtered.length)} of ${filtered.length}`} />}
      </div>

      <Modal open={!!dialog} onClose={() => setDialog(null)} title={dialog ? `${cap(dialog.action)} · ${dialog.row.name || dialog.row.customer}` : ''}>
        {dialog && (
          <div className="space-y-4">
            {kind === 'cards' && dialog.action === 'approve'
              ? <div><label className="lbl">Credit limit (৳)</label><input type="number" min="1" className="field" value={limit} onChange={(e) => setLimit(e.target.value)} /></div>
              : <div><label className="lbl">Reason (optional)</label><input className="field" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} autoFocus /></div>}
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button disabled={busy} className="btn-brand w-full" onClick={() => act(dialog.row.id, dialog.action, kind === 'cards' && dialog.action === 'approve' ? { creditLimit: Number(limit) } : { reason })}>Confirm {dialog.action}</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
