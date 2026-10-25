import React, { useState, useMemo } from 'react';
import { Search, ArrowDownLeft, ArrowUpRight, Filter, Inbox } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatBDT, formatDate, formatTime } from '../utils/format';
import { Badge, EmptyState } from '../components/ui';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'received', label: 'Received' },
  { id: 'sent', label: 'Sent' },
];

export default function Activity({ onNavigate }) {
  const { transactions } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    let list = [...transactions];
    if (filter === 'received') list = list.filter((t) => t.type === 'received');
    if (filter === 'sent') list = list.filter((t) => t.type === 'sent');
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.counterparty.toLowerCase().includes(q) ||
          t.reference.toLowerCase().includes(q)
      );
    }
    return list;
  }, [transactions, filter, search]);

  return (
    <div className="pb-24 page-enter">
      <header className="px-5 pt-6 pb-3">
        <h1 className="text-xl font-bold text-navy-900 dark:text-white">Activity</h1>
        <p className="text-sm text-slate-500 mt-0.5">All your transactions</p>
      </header>

      <div className="px-5 mb-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            className="input-field pl-11"
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="px-5 mb-4 flex gap-2 overflow-x-auto no-scrollbar">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f.id
                ? 'bg-navy-900 text-white dark:bg-emerald-600'
                : 'bg-white dark:bg-navy-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-navy-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="px-5">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No transactions"
            description={
              search || filter !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'Your transaction history will appear here.'
            }
          />
        ) : (
          <div className="card divide-y divide-slate-100 dark:divide-navy-800">
            {filtered.map((txn) => (
              <button
                key={txn.id}
                onClick={() => onNavigate('txn-detail', { txnId: txn.id })}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-navy-800/50 text-left"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    txn.type === 'received'
                      ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30'
                      : 'bg-slate-100 text-slate-600 dark:bg-navy-700 dark:text-slate-300'
                  }`}
                >
                  {txn.type === 'received' ? (
                    <ArrowDownLeft className="w-5 h-5" />
                  ) : (
                    <ArrowUpRight className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy-900 dark:text-white truncate">
                    {txn.title}
                  </p>
                  <p className="text-xs text-slate-500">
                    {txn.counterparty} · {formatDate(txn.date)} · {formatTime(txn.date)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={`text-sm font-semibold ${
                      txn.type === 'received' ? 'text-emerald-600' : 'text-navy-900 dark:text-white'
                    }`}
                  >
                    {txn.type === 'received' ? '+' : '-'}
                    {formatBDT(txn.amount)}
                  </p>
                  {txn.status === 'pending' && (
                    <Badge variant="warning" className="mt-0.5">Pending</Badge>
                  )}
                  {txn.status === 'completed' && (
                    <span className="text-[10px] text-slate-400">Completed</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
