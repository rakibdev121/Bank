import React, { useState, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui';
import { PageHeader, TxnRow } from './shared';

const FILTERS = [['all', 'All'], ['cash_in', 'Deposits'], ['cash_out', 'Withdrawals'], ['transfer', 'Transfers'], ['reserve', 'Reserve']];

export default function Transactions({ call }) {
  const [kind, setKind] = useState('all');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [items, setItems] = useState(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => { const t = setTimeout(() => setDebounced(q), 300); return () => clearTimeout(t); }, [q]);

  const url = useCallback((offset) => {
    const p = new URLSearchParams({ offset: String(offset) });
    if (kind !== 'all') p.set('kind', kind);
    if (debounced.trim()) p.set('q', debounced.trim());
    return `/admin/transactions?${p}`;
  }, [kind, debounced]);

  useEffect(() => {
    let live = true;
    setItems(null); setError('');
    call(url(0)).then((r) => { if (live) { setItems(r.items); setMore(r.hasMore); } })
      .catch((e) => { if (live) { setError(e.message); setItems([]); } });
    return () => { live = false; };
  }, [call, url]);

  const loadMore = async () => {
    setLoadingMore(true);
    try { const r = await call(url(items.length)); setItems((p) => [...p, ...r.items]); setMore(r.hasMore); }
    catch (e) { setError(e.message); }
    setLoadingMore(false);
  };

  return (
    <div>
      <PageHeader title="Transactions" subtitle="Every movement of money, newest first" />
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input className="input-field pl-11" placeholder="Search name, account or reference" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
        {FILTERS.map(([id, label]) => (
          <button key={id} onClick={() => setKind(id)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${kind === id ? 'bg-navy-900 text-white dark:bg-emerald-600' : 'bg-white dark:bg-navy-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-navy-700'}`}>
            {label}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <div className="card divide-y divide-slate-100 dark:divide-navy-800 overflow-hidden">
        {items === null && <div className="py-12 flex justify-center"><LoadingSpinner /></div>}
        {items?.length === 0 && <p className="px-5 py-12 text-center text-sm text-slate-400">No transactions found</p>}
        {items?.map((t) => <TxnRow key={t.id} t={t} />)}
      </div>
      {more && (
        <button onClick={loadMore} disabled={loadingMore} className="btn-secondary w-full mt-4">
          {loadingMore ? <LoadingSpinner className="w-5 h-5 mx-auto" /> : 'Load more'}
        </button>
      )}
    </div>
  );
}
