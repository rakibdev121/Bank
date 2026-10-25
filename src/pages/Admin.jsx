import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, LayoutDashboard, Coins, Banknote, ArrowLeftRight, UserCheck, LogOut, ArrowLeft, Sun, Moon, Lock,
} from 'lucide-react';
import { api } from '../api';
import { useApp } from '../context/AppContext';
import { LoadingSpinner } from '../components/ui';
import { useAdminCall } from './admin/shared';
import Overview from './admin/Overview';
import Reserve from './admin/Reserve';
import CashDesk from './admin/CashDesk';
import Transactions from './admin/Transactions';
import Approvals from './admin/Approvals';

const TOKEN_KEY = 'nirapod-admin-token'; // separate from the customer session

const NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'reserve', label: 'Reserve', icon: Coins },
  { id: 'cash', label: 'Cash desk', icon: Banknote },
  { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
  { id: 'approvals', label: 'Approvals', icon: UserCheck },
];

export default function Admin({ onBack }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY));
  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }, []);

  if (!token) {
    return <AdminLogin onBack={onBack} onToken={(t) => { sessionStorage.setItem(TOKEN_KEY, t); setToken(t); }} />;
  }
  return <Shell token={token} onLogout={logout} onBack={onBack} />;
}

function AdminLogin({ onToken, onBack }) {
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
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50 dark:bg-navy-950 page-enter">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-navy-900 via-navy-800 to-emerald-900 text-white p-12">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500 flex items-center justify-center"><Shield className="w-6 h-6" /></div>
          <span className="text-xl font-bold">Nirapod Admin</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">Run the bank.<br />Keep every taka accounted for.</h1>
          <p className="text-slate-300 mt-4 max-w-md">Manage the reserve, receive customer cash, approve accounts and cards, and watch every transaction in one place.</p>
        </div>
        <p className="text-xs text-slate-400">Authorized staff only. All actions are logged.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div className="lg:hidden flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-navy-900 text-white flex items-center justify-center"><Shield className="w-5 h-5" /></div>
            <span className="font-bold text-navy-900 dark:text-white">Nirapod Admin</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-navy-900 dark:text-white">Admin sign in</h2>
            <p className="text-sm text-slate-500 mt-1">Use your staff email and password.</p>
          </div>
          <div>
            <label className="label">Email or phone</label>
            <input className="input-field" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" />
          </div>
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="password" className="input-field pl-10" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={loading || !identifier || !password}>
            {loading ? <LoadingSpinner className="w-5 h-5 mx-auto text-white" /> : 'Sign in'}
          </button>
          <button type="button" onClick={onBack} className="w-full text-sm text-slate-500 hover:text-navy-900 dark:hover:text-white flex items-center justify-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Back to app
          </button>
        </form>
      </div>
    </div>
  );
}

function Shell({ token, onLogout, onBack }) {
  const { theme, setTheme } = useApp();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const call = useAdminCall(token, onLogout);

  const reloadStats = useCallback(async () => {
    try { setStats(await call('/admin/stats')); } catch { /* shown by the page that needs it */ }
  }, [call]);

  useEffect(() => {
    reloadStats();
    const id = setInterval(() => document.visibilityState === 'visible' && reloadStats(), 30000);
    return () => clearInterval(id);
  }, [reloadStats]);

  const pending = stats ? stats.pendingUsers + stats.pendingAccounts + stats.pendingCards : 0;
  const go = (id) => { setTab(id); window.scrollTo(0, 0); };

  const NavButton = ({ item, mobile }) => {
    const active = tab === item.id;
    return (
      <button
        onClick={() => go(item.id)}
        className={mobile
          ? `flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium whitespace-nowrap ${active ? 'bg-white text-navy-900' : 'text-slate-300 bg-white/10'}`
          : `w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${active ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
      >
        <item.icon className="w-[18px] h-[18px]" />
        {item.label}
        {item.id === 'approvals' && pending > 0 && (
          <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-amber-500 text-white text-[11px] flex items-center justify-center">{pending}</span>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-navy-950 lg:flex page-enter">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-navy-900 text-white p-5 sticky top-0 h-screen">
        <div className="flex items-center gap-3 mb-8 px-1">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center"><Shield className="w-5 h-5" /></div>
          <div><p className="font-bold leading-tight">Nirapod</p><p className="text-xs text-slate-400">Admin console</p></div>
        </div>
        <nav className="space-y-1 flex-1">{NAV.map((n) => <NavButton key={n.id} item={n} />)}</nav>
        <div className="space-y-1 pt-4 border-t border-white/10 text-sm">
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5">
            {theme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />} {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <button onClick={onBack} className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5"><ArrowLeft className="w-[18px] h-[18px]" /> Customer app</button>
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5"><LogOut className="w-[18px] h-[18px]" /> Log out</button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden bg-navy-900 text-white px-4 pt-4 pb-3 sticky top-0 z-30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center"><Shield className="w-4 h-4" /></div>
              <span className="font-bold">Nirapod Admin</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 text-slate-300" aria-label="Toggle theme">{theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button>
              <button onClick={onBack} className="p-2 text-slate-300" aria-label="Back to app"><ArrowLeft className="w-5 h-5" /></button>
              <button onClick={onLogout} className="p-2 text-slate-300" aria-label="Log out"><LogOut className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">{NAV.map((n) => <NavButton key={n.id} item={n} mobile />)}</div>
        </header>

        <main className="max-w-5xl mx-auto px-4 sm:px-8 py-6 lg:py-8 pb-16">
          {tab === 'overview' && <Overview stats={stats} go={go} />}
          {tab === 'reserve' && <Reserve call={call} reloadStats={reloadStats} go={go} />}
          {tab === 'cash' && <CashDesk call={call} stats={stats} reloadStats={reloadStats} />}
          {tab === 'transactions' && <Transactions call={call} />}
          {tab === 'approvals' && <Approvals call={call} stats={stats} reloadStats={reloadStats} />}
        </main>
      </div>
    </div>
  );
}
