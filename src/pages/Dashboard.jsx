import React, { useState } from 'react';
import {
  Eye, EyeOff, Bell, Plus, Send, ArrowDownLeft, ArrowUpRight,
  PiggyBank, ChevronRight, TrendingUp, CreditCard
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatBDT, formatDate } from '../data/mockData';
import { Avatar, Badge, DemoBanner } from '../components/ui';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b'];

export default function Dashboard({ onNavigate }) {
  const {
    user, balance, hideBalance, toggleHideBalance,
    transactions, notifications, addDemoMoney,
  } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;
  const recent = transactions.slice(0, 5);
  // Spending by category, computed from this user's own outgoing transactions
  const SPENDING_DATA = Object.values(
    transactions
      .filter((t) => t.type === 'sent')
      .reduce((acc, t) => {
        const name = (t.category || 'other').replace(/^./, (c) => c.toUpperCase());
        acc[name] = acc[name] || { name, amount: 0 };
        acc[name].amount += t.amount;
        return acc;
      }, {})
  );

  const handleAddDemo = () => {
    addDemoMoney(5000);
    setShowAdd(false);
  };

  return (
    <div className="pb-24 page-enter">
      <DemoBanner />
      {/* Header */}
      <header className="px-5 pt-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar name={user.name} size="md" />
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Good evening</p>
            <h1 className="text-base font-semibold text-navy-900 dark:text-white leading-tight">
              {user.name.split(' ')[0]}
            </h1>
          </div>
        </div>
        <button
          onClick={() => onNavigate('notifications')}
          className="relative p-2.5 rounded-xl bg-white dark:bg-navy-800 border border-slate-100 dark:border-navy-700 shadow-card"
        >
          <Bell className="w-5 h-5 text-navy-700 dark:text-slate-300" />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500" />
          )}
        </button>
      </header>

      {/* Balance Card */}
      <div className="px-5 mb-6">
        <div className="card bg-gradient-to-br from-navy-900 to-navy-800 dark:from-navy-800 dark:to-navy-900 text-white p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm text-slate-300">Available Balance</p>
              <button onClick={toggleHideBalance} className="p-1 text-slate-400 hover:text-white">
                {hideBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-3xl font-bold tracking-tight">
              {hideBalance ? '৳ ••••••' : formatBDT(balance)}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Badge variant="success" className="!bg-emerald-500/20 !text-emerald-300">
                Demo Account
              </Badge>
              <span className="text-xs text-slate-400">{user.accountNumber}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-5 mb-6">
        <div className="grid grid-cols-4 gap-3">
          {[
            { id: 'send', icon: Send, label: 'Send', color: 'bg-emerald-600' },
            { id: 'add', icon: Plus, label: 'Add Demo', color: 'bg-navy-800' },
            { id: 'activity', icon: ArrowDownLeft, label: 'History', color: 'bg-blue-600' },
            { id: 'cards', icon: CreditCard, label: 'Cards', color: 'bg-violet-600' },
          ].map((a) => (
            <button
              key={a.id}
              onClick={() => (a.id === 'add' ? setShowAdd(true) : onNavigate(a.id))}
              className="flex flex-col items-center gap-2"
            >
              <div className={`w-12 h-12 rounded-2xl ${a.color} text-white flex items-center justify-center shadow-card`}>
                <a.icon className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Spending Summary */}
      {SPENDING_DATA.length > 0 && (
      <div className="px-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-navy-900 dark:text-white flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            Spending Overview
          </h2>
          <span className="text-xs text-slate-400">Your spending</span>
        </div>
        <div className="card p-4">
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={SPENDING_DATA}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={65}
                  paddingAngle={3}
                  dataKey="amount"
                >
                  {SPENDING_DATA.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => formatBDT(v)}
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {SPENDING_DATA.slice(0, 6).map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i] }} />
                <span className="text-slate-500 truncate">{d.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* Recent Transactions */}
      <div className="px-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-navy-900 dark:text-white">Recent Activity</h2>
          <button
            onClick={() => onNavigate('activity')}
            className="text-xs font-medium text-emerald-600 flex items-center gap-0.5"
          >
            See all <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="card divide-y divide-slate-100 dark:divide-navy-800">
          {recent.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-slate-400">No transactions yet</p>
          )}
          {recent.map((txn) => (
            <button
              key={txn.id}
              onClick={() => onNavigate('txn-detail', { txnId: txn.id })}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors text-left"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                txn.type === 'received'
                  ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30'
                  : 'bg-slate-100 text-slate-600 dark:bg-navy-700 dark:text-slate-300'
              }`}>
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
                <p className="text-xs text-slate-500 truncate">{txn.counterparty} · {formatDate(txn.date)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-semibold ${
                  txn.type === 'received' ? 'text-emerald-600' : 'text-navy-900 dark:text-white'
                }`}>
                  {txn.type === 'received' ? '+' : '-'}{formatBDT(txn.amount)}
                </p>
                {txn.status === 'pending' && (
                  <Badge variant="warning" className="mt-0.5">Pending</Badge>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Add Demo Money Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-navy-950/50" onClick={() => setShowAdd(false)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-navy-900 rounded-t-2xl sm:rounded-2xl p-6 page-enter">
            <h3 className="text-lg font-semibold text-navy-900 dark:text-white mb-2">Add Demo Money</h3>
            <p className="text-sm text-slate-500 mb-5">
              Credit virtual ৳5,000 to your demo balance for testing transfers.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleAddDemo} className="btn-accent flex-1">Add ৳5,000</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
