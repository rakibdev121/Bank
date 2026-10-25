import React, { useEffect, useState } from 'react';
import { Users, Wallet, TrendingUp, UserCheck, ShieldCheck, ShieldAlert, ArrowRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { formatBDT, formatCompactBDT } from '../../utils/format';
import { PageHeader, StatCard, Loading, TxnTable } from '../ui';
import { go } from '../AdminApp';

const COLORS = ['#2f7bff', '#22d3ee', '#8b9bbd', '#a78bfa'];
const compact = (v) => (v >= 1e7 ? `৳${+(v / 1e7).toFixed(1)}Cr` : v >= 1e5 ? `৳${+(v / 1e5).toFixed(1)}L` : v >= 1e3 ? `৳${+(v / 1e3).toFixed(1)}k` : `৳${v}`);

export default function Dashboard({ call, stats: base }) {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    call(`/admin/stats?days=${days}`).then((s) => live && setStats(s)).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [call, days]);
  useEffect(() => { call('/admin/accounts').then(setAccounts).catch(() => {}); }, [call]);

  const s = stats || base;
  if (error && !s) return <p className="text-red-400">{error}</p>;
  if (!s) return <Loading />;
  const pending = s.pendingUsers + s.pendingAccounts + s.pendingCards;
  const r = s.reserve;

  const series = (stats?.series || []).map((d) => ({
    ...d, volume: d.cashIn + d.cashOut + d.transfers,
    label: new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
  }));
  const types = Object.entries(accounts.filter((a) => a.status === 'approved').reduce((m, a) => ({ ...m, [a.accountType]: (m[a.accountType] || 0) + 1 }), {}))
    .map(([name, value]) => ({ name: name[0].toUpperCase() + name.slice(1), value }));
  const totalAcc = types.reduce((n, t) => n + t.value, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Overview of nirapod-bank performance and key metrics">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${r.balanced ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/40 bg-red-500/15 text-red-300'}`}>
          {r.balanced ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}{r.balanced ? 'Ledger balanced' : 'Ledger mismatch!'}
        </span>
      </PageHeader>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Active customers" value={s.customers.toLocaleString('en-IN')} hint={`${s.pendingUsers} awaiting approval`} />
        <StatCard icon={Wallet} label="Total customer balance" value={formatCompactBDT(s.totalBalance)} hint={`Reserve ${formatCompactBDT(r.balance)}`} />
        <StatCard icon={TrendingUp} label="Today's transactions" value={s.todayTxns.toLocaleString('en-IN')} hint={`Cash in ${formatCompactBDT(s.todayCashIn)}`} />
        <button onClick={() => go(s.pendingUsers ? 'customers' : s.pendingAccounts ? 'accounts' : 'cards', { status: 'pending' })} className="text-left"><StatCard icon={UserCheck} label="Pending approvals" value={pending} hint={`${s.pendingUsers} customers · ${s.pendingAccounts} accounts · ${s.pendingCards} cards`} /></button>
      </div>

      <div className="grid xl:grid-cols-5 gap-6">
        <div className="panel p-5 xl:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Transaction volume</h2>
            <select value={days} onChange={(e) => { setStats(null); setDays(+e.target.value); }} className="field !w-auto !py-1.5" aria-label="Range">
              <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
            </select>
          </div>
          <div className="h-72">
            {!stats ? <Loading /> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ left: 0, right: 8, top: 8 }}>
                  <defs><linearGradient id="vol" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2f7bff" stopOpacity={0.35} /><stop offset="100%" stopColor="#2f7bff" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#26395a" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="#6b82a8" minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="#6b82a8" width={56} tickFormatter={compact} />
                  <Tooltip formatter={(v) => formatBDT(v)} labelStyle={{ color: '#fff' }} contentStyle={{ background: '#0e182b', border: '1px solid #26395a', borderRadius: 12 }} />
                  <Area type="monotone" dataKey="volume" name="Volume" stroke="#4d94ff" strokeWidth={2.5} fill="url(#vol)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="panel p-5 xl:col-span-2">
          <h2 className="font-semibold text-white mb-4">Account types</h2>
          {totalAcc === 0 ? <p className="py-20 text-center text-sm text-ink-400">No approved accounts yet</p> : (
            <div className="flex items-center gap-6 flex-wrap justify-center">
              <div className="relative w-52 h-52">
                <ResponsiveContainer><PieChart><Pie data={types} dataKey="value" innerRadius={66} outerRadius={96} paddingAngle={2} stroke="none">{types.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie></PieChart></ResponsiveContainer>
                <div className="absolute inset-0 grid place-items-center text-center pointer-events-none"><div><p className="text-2xl font-bold text-white">{totalAcc}</p><p className="text-xs text-ink-300">Total accounts</p></div></div>
              </div>
              <ul className="space-y-3 text-sm min-w-[10rem]">
                {types.map((t, i) => (
                  <li key={t.name} className="flex items-center gap-2.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} /><span className="text-slate-200">{t.name}</span><span className="ml-auto text-ink-300">{((t.value / totalAcc) * 100).toFixed(1)}%</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="font-semibold text-white">Recent transactions</h2>
          <a href="#/transactions" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-400 hover:text-brand-300">View all transactions <ArrowRight className="w-4 h-4" /></a>
        </div>
        <TxnTable rows={s.recent} />
      </div>
    </div>
  );
}
