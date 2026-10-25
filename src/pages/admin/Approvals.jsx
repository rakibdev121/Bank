import React, { useState, useEffect, useCallback } from 'react';
import { Users, CreditCard, Landmark, RefreshCw } from 'lucide-react';
import { formatBDT } from '../../utils/format';
import { Badge, Avatar, LoadingSpinner, Modal } from '../../components/ui';
import { PageHeader } from './shared';

const statusVariant = { pending: 'warning', approved: 'success', rejected: 'danger', suspended: 'danger', blocked: 'danger' };
const TABS = [
  { id: 'users', label: 'Customers', icon: Users },
  { id: 'accounts', label: 'Accounts', icon: Landmark },
  { id: 'cards', label: 'Cards', icon: CreditCard },
];

export default function Approvals({ call, stats, reloadStats }) {
  const [tab, setTab] = useState('users');
  const [filter, setFilter] = useState('pending');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [reason, setReason] = useState('');
  const [limit, setLimit] = useState('50000');

  const load = useCallback(async () => {
    setError(''); setRows(null);
    try { setRows(await call(`/admin/${tab}${filter === 'all' ? '' : `?status=${filter}`}`)); }
    catch (e) { setError(e.message); setRows([]); }
  }, [call, tab, filter]);
  useEffect(() => { load(); }, [load]);

  const act = async (kind, id, action, body = {}) => {
    setBusy(true); setError('');
    try {
      await call(`/admin/${kind}/${id}/${action}`, { method: 'POST', body });
      setDialog(null); setReason('');
      await Promise.all([load(), reloadStats()]);
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const open = (row, action) => {
    const needsInput = ['reject', 'suspend', 'block'].includes(action) || (tab === 'cards' && action === 'approve' && row.cardType === 'credit');
    needsInput ? setDialog({ row, action }) : act(tab, row.id, action);
  };

  const counts = { users: stats?.pendingUsers, accounts: stats?.pendingAccounts, cards: stats?.pendingCards };

  return (
    <div>
      <PageHeader title="Approvals" subtitle="Review customers, bank accounts and card applications"
        action={<button onClick={load} className="p-2 rounded-xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700" aria-label="Refresh"><RefreshCw className="w-4 h-4 text-slate-500" /></button>} />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${tab === t.id ? 'bg-navy-900 text-white dark:bg-emerald-600' : 'bg-white dark:bg-navy-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-navy-700'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
            {counts[t.id] > 0 && <span className="ml-1 min-w-5 h-5 px-1.5 rounded-full bg-amber-500 text-white text-[11px] flex items-center justify-center">{counts[t.id]}</span>}
          </button>
        ))}
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input-field py-2 text-sm w-auto ml-auto">
          <option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All</option>
        </select>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="card divide-y divide-slate-100 dark:divide-navy-800 overflow-hidden">
        {rows === null && <div className="py-12 flex justify-center"><LoadingSpinner /></div>}
        {rows?.length === 0 && <p className="px-5 py-12 text-center text-sm text-slate-400">Nothing here</p>}
        {rows?.map((r) => <Row key={r.id} tab={tab} r={r} busy={busy} onAction={(a) => open(r, a)} />)}
      </div>

      <Modal open={!!dialog} onClose={() => setDialog(null)} size="sm"
        title={dialog ? `${dialog.action[0].toUpperCase()}${dialog.action.slice(1)}` : ''}>
        {dialog && (
          <div className="space-y-4">
            {tab === 'cards' && dialog.action === 'approve' ? (
              <div><label className="label">Credit limit (৳)</label>
                <input type="number" min="1" className="input-field" value={limit} onChange={(e) => setLimit(e.target.value)} /></div>
            ) : (
              <div><label className="label">Reason (optional)</label>
                <input className="input-field" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} /></div>
            )}
            <button disabled={busy} className="btn-primary w-full"
              onClick={() => act(tab, dialog.row.id, dialog.action, tab === 'cards' && dialog.action === 'approve' ? { creditLimit: Number(limit) } : { reason })}>
              Confirm
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Row({ tab, r, onAction, busy }) {
  const title = tab === 'users' ? r.name : r.customer;
  const sub =
    tab === 'users' ? `${r.phone} · ${r.email}`
    : tab === 'accounts' ? `${r.accountType} account · ${r.phone}${r.accountNumber ? ` · ${r.accountNumber}` : ''}`
    : `${r.network} ${r.cardType} · ${r.phone}${r.numberMasked ? ` · ${r.numberMasked}` : ''}${r.creditLimit ? ` · limit ${formatBDT(r.creditLimit)}` : ''}`;

  const actions = [];
  if (r.status === 'pending') actions.push(['approve', 'btn-accent'], ['reject', 'btn-secondary']);
  if (tab === 'users' && r.status === 'approved') actions.push(['suspend', 'btn-secondary']);
  if (tab === 'users' && (r.status === 'suspended' || r.status === 'rejected')) actions.push(['approve', 'btn-accent']);
  if (tab === 'cards' && r.status === 'approved') actions.push(['block', 'btn-secondary']);

  return (
    <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar name={title || '?'} size="md" />
        <div className="min-w-0">
          <p className="font-medium text-navy-900 dark:text-white truncate">{title}</p>
          <p className="text-xs text-slate-500 truncate capitalize">{sub}</p>
          {r.reason && <p className="text-xs text-slate-400 mt-0.5">Reason: {r.reason}</p>}
        </div>
      </div>
      <Badge variant={statusVariant[r.status] || 'default'} className="self-start sm:self-auto">{r.status}</Badge>
      <div className="flex gap-2">
        {actions.map(([a, cls]) => (
          <button key={a} disabled={busy} onClick={() => onAction(a)} className={`${cls} !py-1.5 !px-3 text-sm capitalize`}>{a}</button>
        ))}
      </div>
    </div>
  );
}
