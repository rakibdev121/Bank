import React, { useState, useEffect, useCallback } from 'react';
import { Users, Wallet, CreditCard, Landmark, Shield, RefreshCw } from 'lucide-react';
import { api } from '../api';
import { formatBDT } from '../data/mockData';
import { Badge, LoadingSpinner, Modal } from '../components/ui';

const TOKEN_KEY = 'nirapod-admin-token'; // separate from the customer session
const statusVariant = { pending: 'warning', approved: 'success', rejected: 'danger', suspended: 'danger', blocked: 'danger' };

export default function Admin({ onBack }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY));

  const logout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-navy-950 page-enter">
      <header className="bg-navy-900 text-white px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Nirapod Admin</h1>
              <p className="text-xs text-slate-400">Approvals & customer management</p>
            </div>
          </div>
          <div className="flex gap-4 text-sm">
            {token && <button onClick={logout} className="text-slate-300 hover:text-white">Log out</button>}
            <button onClick={onBack} className="text-slate-300 hover:text-white">← Back to App</button>
          </div>
        </div>
      </header>
      {token ? (
        <Panel token={token} onExpired={logout} />
      ) : (
        <AdminLogin onToken={(t) => { sessionStorage.setItem(TOKEN_KEY, t); setToken(t); }} />
      )}
    </div>
  );
}

function AdminLogin({ onToken }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await api('/auth/login', { method: 'POST', body: { identifier, password } });
      if (user.role !== 'admin') throw new Error('This account is not an admin');
      onToken(token);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <form onSubmit={submit} className="max-w-sm mx-auto px-6 py-16 space-y-4">
      <h2 className="text-xl font-semibold text-navy-900 dark:text-white">Admin log in</h2>
      <div>
        <label className="label">Email or phone</label>
        <input className="input-field" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" />
      </div>
      <div>
        <label className="label">Password</label>
        <input type="password" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full" disabled={loading}>
        {loading ? <LoadingSpinner className="w-5 h-5 mx-auto" /> : 'Log In'}
      </button>
    </form>
  );
}

const TABS = [
  { id: 'users', label: 'Customers', icon: Users },
  { id: 'accounts', label: 'Accounts', icon: Landmark },
  { id: 'cards', label: 'Cards', icon: CreditCard },
];

function Panel({ token, onExpired }) {
  const [tab, setTab] = useState('users');
  const [filter, setFilter] = useState('pending');
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null); // { kind, row, action }
  const [reason, setReason] = useState('');
  const [limit, setLimit] = useState('50000');

  const call = useCallback(
    async (path, opts) => {
      try {
        return await api(path, { ...opts, token });
      } catch (e) {
        if (e.status === 401) onExpired();
        throw e;
      }
    },
    [token, onExpired]
  );

  const load = useCallback(async () => {
    setError('');
    setRows(null);
    try {
      const q = filter === 'all' ? '' : `?status=${filter}`;
      const [s, list] = await Promise.all([call('/admin/stats'), call(`/admin/${tab}${q}`)]);
      setStats(s);
      setRows(list);
    } catch (e) {
      setError(e.message);
      setRows([]);
    }
  }, [call, tab, filter]);

  useEffect(() => { load(); }, [load]);

  const act = async (kind, id, action, body = {}) => {
    setBusy(true);
    setError('');
    try {
      await call(`/admin/${kind}/${id}/${action}`, { method: 'POST', body });
      setDialog(null);
      setReason('');
      await load();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  const open = (kind, row, action) => {
    // Approvals of users/accounts need no extra input; rejections ask for a reason; credit cards ask for a limit.
    const needsInput = action === 'reject' || action === 'suspend' || action === 'block' || (kind === 'cards' && action === 'approve' && row.cardType === 'credit');
    if (needsInput) setDialog({ kind, row, action });
    else act(kind, row.id, action);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Stat icon={Users} label="Pending customers" value={stats.pendingUsers} />
          <Stat icon={Landmark} label="Pending accounts" value={stats.pendingAccounts} />
          <Stat icon={CreditCard} label="Pending cards" value={stats.pendingCards} />
          <Stat icon={Wallet} label="Total balances" value={formatBDT(stats.totalBalance)} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${
              tab === t.id ? 'bg-navy-900 text-white dark:bg-emerald-600' : 'bg-white dark:bg-navy-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input-field py-2 text-sm w-auto ml-auto">
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
        <button onClick={load} className="p-2 rounded-xl bg-white dark:bg-navy-800" aria-label="Refresh">
          <RefreshCw className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="card divide-y divide-slate-100 dark:divide-navy-800">
        {rows === null && <div className="py-10 flex justify-center"><LoadingSpinner /></div>}
        {rows?.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-400">Nothing here</p>}
        {rows?.map((r) => (
          <Row key={r.id} tab={tab} r={r} onAction={(action) => open(tab, r, action)} busy={busy} />
        ))}
      </div>

      <Modal
        open={!!dialog}
        onClose={() => setDialog(null)}
        title={dialog ? `${dialog.action[0].toUpperCase()}${dialog.action.slice(1)}` : ''}
        size="sm"
      >
        {dialog && (
          <div className="space-y-4">
            {dialog.kind === 'cards' && dialog.action === 'approve' ? (
              <div>
                <label className="label">Credit limit (৳)</label>
                <input type="number" min="1" className="input-field" value={limit} onChange={(e) => setLimit(e.target.value)} />
              </div>
            ) : (
              <div>
                <label className="label">Reason (optional)</label>
                <input className="input-field" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
              </div>
            )}
            <button
              disabled={busy}
              className="btn-primary w-full"
              onClick={() =>
                act(dialog.kind, dialog.row.id, dialog.action,
                  dialog.kind === 'cards' && dialog.action === 'approve' ? { creditLimit: Number(limit) } : { reason })
              }
            >
              Confirm
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Row({ tab, r, onAction, busy }) {
  const title =
    tab === 'users' ? r.name
    : tab === 'accounts' ? `${r.customer} · ${r.accountType} account`
    : `${r.customer} · ${r.network} ${r.cardType}`;
  const sub =
    tab === 'users' ? `${r.phone} · ${r.email}`
    : tab === 'accounts' ? `${r.phone}${r.accountNumber ? ` · ${r.accountNumber}` : ''}`
    : `${r.phone}${r.numberMasked ? ` · ${r.numberMasked}` : ''}${r.creditLimit ? ` · limit ${formatBDT(r.creditLimit)}` : ''}`;

  const actions = [];
  if (r.status === 'pending') actions.push(['approve', 'btn-accent'], ['reject', 'btn-secondary']);
  if (tab === 'users' && r.status === 'approved') actions.push(['suspend', 'btn-secondary']);
  if (tab === 'users' && (r.status === 'suspended' || r.status === 'rejected')) actions.push(['approve', 'btn-accent']);
  if (tab === 'cards' && r.status === 'approved') actions.push(['block', 'btn-secondary']);

  return (
    <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-navy-900 dark:text-white truncate">{title}</p>
        <p className="text-xs text-slate-500 truncate">{sub}</p>
        {r.reason && <p className="text-xs text-slate-400 mt-0.5">Reason: {r.reason}</p>}
      </div>
      <Badge variant={statusVariant[r.status] || 'default'}>{r.status}</Badge>
      <div className="flex gap-2">
        {actions.map(([a, cls]) => (
          <button key={a} disabled={busy} onClick={() => onAction(a)} className={`${cls} !py-1.5 !px-3 text-sm capitalize`}>
            {a}
          </button>
        ))}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2 text-slate-500">
        <Icon className="w-4 h-4" />
        <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-2xl font-bold text-navy-900 dark:text-white">{value}</p>
    </div>
  );
}
