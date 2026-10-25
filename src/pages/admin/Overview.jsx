import React from 'react';
import { Users, Wallet, ArrowLeftRight, Banknote, ShieldCheck, ShieldAlert, Plus, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { formatBDT, formatCompactBDT } from '../../utils/format';
import { LoadingSpinner } from '../../components/ui';
import { PageHeader, StatCard, TxnRow, amountWords } from './shared';

export function ReserveHero({ r, onAdd, onCash }) {
  return (
    <div className="rounded-3xl bg-gradient-to-br from-navy-900 via-navy-800 to-emerald-900 text-white p-6 relative overflow-hidden shadow-elevated">
      <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-emerald-400/10" />
      <div className="absolute -bottom-20 -left-10 w-48 h-48 rounded-full bg-white/5" />
      <div className="relative">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-slate-300">Reserve e-money available</p>
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${r.balanced ? 'bg-emerald-400/20 text-emerald-200' : 'bg-red-500/30 text-red-100'}`}>
            {r.balanced ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
            {r.balanced ? 'Ledger balanced' : 'Ledger mismatch!'}
          </span>
        </div>
        <p className="text-3xl sm:text-4xl font-bold tracking-tight mt-2 break-words">{formatBDT(r.balance)}</p>
        <p className="text-sm text-emerald-200/90 mt-1">{r.balance > 0 ? `${amountWords(r.balance)} taka` : 'Reserve is empty — add reserve to start accepting cash'}</p>
        <div className="grid grid-cols-3 gap-3 mt-6 text-sm">
          <div><p className="text-slate-400 text-xs">With customers</p><p className="font-semibold">{formatCompactBDT(r.circulation)}</p></div>
          <div><p className="text-slate-400 text-xs">Total generated</p><p className="font-semibold">{formatCompactBDT(r.totalGenerated)}</p></div>
          <div><p className="text-slate-400 text-xs">Fees earned</p><p className="font-semibold">{formatCompactBDT(r.fees)}</p></div>
        </div>
        <div className="flex flex-wrap gap-3 mt-6">
          <button onClick={onCash} className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-medium rounded-xl px-4 py-2.5 text-sm">
            <Banknote className="w-4 h-4" /> Receive cash
          </button>
          <button onClick={onAdd} className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl px-4 py-2.5 text-sm">
            <Plus className="w-4 h-4" /> Add reserve
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Overview({ stats, go }) {
  if (!stats) return <div className="py-20 flex justify-center"><LoadingSpinner /></div>;
  const pending = stats.pendingUsers + stats.pendingAccounts + stats.pendingCards;
  const chart = stats.series.map((s) => ({ ...s, day: new Date(s.date).toLocaleDateString('en-GB', { weekday: 'short' }) }));

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" subtitle="Money, customers and approvals at a glance" />
      <ReserveHero r={stats.reserve} onAdd={() => go('reserve')} onCash={() => go('cash')} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Banknote} tone="emerald" label="Cash in today" value={formatCompactBDT(stats.todayCashIn)} hint="Deposits at the counter" />
        <StatCard icon={ArrowLeftRight} tone="blue" label="Transactions today" value={stats.todayTxns} hint="Deposits, withdrawals, transfers" />
        <StatCard icon={Wallet} tone="violet" label="Customer balances" value={formatCompactBDT(stats.totalBalance)} hint="Across all wallets" />
        <StatCard icon={Users} tone="amber" label="Active customers" value={stats.customers} hint={`${pending} awaiting approval`} />
      </div>

      {pending > 0 && (
        <button onClick={() => go('approvals')} className="w-full card p-4 flex items-center gap-3 text-left border-amber-200 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-900/10">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">{pending}</div>
          <div className="flex-1">
            <p className="font-medium text-navy-900 dark:text-white text-sm">Requests waiting for your decision</p>
            <p className="text-xs text-slate-500">{stats.pendingUsers} customers · {stats.pendingAccounts} accounts · {stats.pendingCards} cards</p>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400" />
        </button>
      )}

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="card p-5 lg:col-span-3">
          <h3 className="font-semibold text-navy-900 dark:text-white mb-4">Last 7 days</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ left: -10, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b833" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} tickFormatter={(v) => (v >= 1e5 ? `${v / 1e5}L` : v >= 1e3 ? `${v / 1e3}k` : v)} />
                <Tooltip formatter={(v) => formatBDT(v)} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="cashIn" name="Cash in" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cashOut" name="Cash out" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="transfers" name="Transfers" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card lg:col-span-2 overflow-hidden">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <h3 className="font-semibold text-navy-900 dark:text-white">Recent activity</h3>
            <button onClick={() => go('transactions')} className="text-xs font-medium text-emerald-600">See all</button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-navy-800">
            {stats.recent.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-400">No transactions yet</p>}
            {stats.recent.slice(0, 6).map((t) => <TxnRow key={t.id} t={t} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
