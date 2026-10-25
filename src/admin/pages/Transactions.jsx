import React, { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { PageHeader, Loading, TxnTable } from '../ui';

const KINDS = [['', 'All'], ['cash_in', 'Deposits'], ['cash_out', 'Withdrawals'], ['transfer', 'Transfers'], ['savings_in', 'Savings in'], ['savings_out', 'Savings out'], ['reserve', 'Reserve']];

export default function Transactions({ call, initialQ }) {
  const [kind, setKind] = useState('');
  const [q, setQ] = useState(initialQ);
  const [applied, setApplied] = useState(initialQ);
  const [rows, setRows] = useState(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);

  const url = (offset) => `/admin/transactions?${new URLSearchParams({ ...(kind && { kind }), ...(applied && { q: applied }), offset })}`;
  const load = useCallback(async () => {
    setError(''); setRows(null);
    try { const r = await call(url(0)); setRows(r.items); setMore(r.hasMore); } catch (e) { setError(e.message); setRows([]); }
  }, [call, kind, applied]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try { const r = await call(url(rows.length)); setRows([...rows, ...r.items]); setMore(r.hasMore); } catch (e) { setError(e.message); }
    setLoadingMore(false);
  };

  return (
    <div>
      <PageHeader title="Transactions" subtitle="Every ledger entry: deposits, withdrawals, transfers, savings and reserve changes">
        <button onClick={load} className="btn-ghost !p-2.5" aria-label="Refresh"><RefreshCw className="w-4 h-4" /></button>
      </PageHeader>
      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-ink-700/70">
          <div className="flex flex-wrap gap-1 rounded-xl bg-ink-850 p-1">
            {KINDS.map(([id, label]) => <button key={id} onClick={() => setKind(id)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${kind === id ? 'bg-brand-500 text-white' : 'text-ink-300 hover:text-white'}`}>{label}</button>)}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); setApplied(q.trim()); }} className="relative ml-auto w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
            <input className="field pl-9" placeholder="Reference, name or account no." value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
        </div>
        {error && <p className="px-5 py-3 text-sm text-red-400">{error}</p>}
        {rows === null ? <Loading /> : <TxnTable rows={rows} />}
        {more && <div className="p-4 border-t border-ink-700/70 text-center"><button onClick={loadMore} disabled={loadingMore} className="btn-ghost">{loadingMore ? 'Loading…' : 'Load more'}</button></div>}
      </div>
    </div>
  );
}
