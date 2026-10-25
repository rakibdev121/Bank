import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Users, Landmark, CreditCard, ArrowLeftRight, Banknote, Coins, Settings as SettingsIcon,
  Search, Bell, ChevronDown, LogOut, ShieldCheck, Lock, Mail,
} from 'lucide-react';
import { api } from '../api';
import { useAdminCall, Spinner, Avatar } from './ui';
import Dashboard from './pages/Dashboard';
import Directory from './pages/Directory';
import Transactions from './pages/Transactions';
import CashDesk from './pages/CashDesk';
import Reserve from './pages/Reserve';
import Settings from './pages/Settings';

const TOKEN_KEY = 'nirapod-admin-token';
const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'customers', label: 'Customers', icon: Users, badge: 'pendingUsers' },
  { id: 'accounts', label: 'Accounts', icon: Landmark, badge: 'pendingAccounts' },
  { id: 'cards', label: 'Cards', icon: CreditCard, badge: 'pendingCards' },
  { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
  { id: 'cash', label: 'Cash desk', icon: Banknote },
  { id: 'reserve', label: 'Reserve', icon: Coins },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

export function Logo({ size = 'md' }) {
  const s = size === 'lg' ? 'h-16' : 'h-10';
  return (
    <div className="flex items-center gap-3">
      <img src="/logo-mark.png" alt="" className={`${s} w-auto`} />
      <div className="leading-tight">
        <p className={`font-bold text-white tracking-tight ${size === 'lg' ? 'text-3xl' : 'text-xl'}`}>nirapod-bank</p>
        <p className={`font-semibold tracking-[0.3em] text-brand-400 ${size === 'lg' ? 'text-sm' : 'text-[10px]'}`}>ADMIN</p>
      </div>
    </div>
  );
}

function useRoute() {
  const read = () => {
    const [id, ...rest] = (window.location.hash.replace(/^#\/?/, '') || 'dashboard').split('?');
    return { id: NAV.some((n) => n.id === id) ? id : 'dashboard', query: new URLSearchParams(rest.join('?')) };
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const h = () => setRoute(read());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return route;
}
export const go = (id, q) => { window.location.hash = `/${id}${q ? `?${new URLSearchParams(q)}` : ''}`; };

export default function AdminApp() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY));
  const [me, setMe] = useState(() => { try { return JSON.parse(sessionStorage.getItem('nirapod-admin-me')); } catch { return null; } });
  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem('nirapod-admin-me'); setToken(null); setMe(null);
  }, []);
  if (!token) {
    return <Login onDone={(t, u) => { sessionStorage.setItem(TOKEN_KEY, t); sessionStorage.setItem('nirapod-admin-me', JSON.stringify(u)); setToken(t); setMe(u); }} />;
  }
  return <Shell token={token} me={me} onLogout={logout} />;
}

function Login({ onDone }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const { token, user } = await api('/auth/login', { method: 'POST', body: { identifier, password } });
      if (user.role !== 'admin') throw new Error('This account is not an admin');
      onDone(token, user);
    } catch (err) { setError(err.message); }
    setLoading(false);
  };
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-ink-950">
      <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden bg-gradient-to-br from-ink-900 via-ink-950 to-brand-700/30 border-r border-ink-700/60">
        <div className="absolute -right-32 -top-32 w-96 h-96 rounded-full bg-brand-500/10 blur-3xl" />
        <Logo />
        <div className="relative">
          <img src="/logo-mark.png" alt="" className="h-40 w-auto mb-8 drop-shadow-[0_0_40px_rgba(47,123,255,.35)]" />
          <h2 className="text-4xl font-bold text-white leading-tight">Run the bank.<br />Every taka accounted for.</h2>
          <p className="text-ink-300 mt-4 max-w-md">Manage reserve, receive customer cash, approve accounts and cards, and watch every transaction in one place.</p>
        </div>
        <p className="text-xs text-ink-400">Authorized staff only. All actions are logged.</p>
      </div>
      <div className="grid place-items-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div className="lg:hidden mb-4"><Logo /></div>
          <div><h1 className="text-2xl font-bold text-white">Admin sign in</h1><p className="text-sm text-ink-300 mt-1">Use your staff email and password.</p></div>
          <div><label className="lbl">Email or phone</label>
            <div className="relative"><Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" /><input className="field pl-10" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" autoFocus /></div></div>
          <div><label className="lbl">Password</label>
            <div className="relative"><Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" /><input type="password" className="field pl-10" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></div></div>
          {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
          <button className="btn-brand w-full" disabled={loading || !identifier || !password}>{loading ? <Spinner className="w-5 h-5 !text-white" /> : 'Sign in'}</button>
          <a href="/" className="block text-center text-sm text-ink-300 hover:text-white">← Back to customer app</a>
        </form>
      </div>
    </div>
  );
}

function Shell({ token, me, onLogout }) {
  const route = useRoute();
  const [stats, setStats] = useState(null);
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState('');
  const call = useAdminCall(token, onLogout);

  const reloadStats = useCallback(async () => {
    try { setStats(await call('/admin/stats')); } catch { /* pages show their own errors */ }
  }, [call]);
  useEffect(() => {
    reloadStats();
    const id = setInterval(() => document.visibilityState === 'visible' && reloadStats(), 30000);
    return () => clearInterval(id);
  }, [reloadStats]);
  useEffect(() => { document.title = `${NAV.find((n) => n.id === route.id).label} · nirapod-bank Admin`; }, [route.id]);

  const pending = stats ? stats.pendingUsers + stats.pendingAccounts + stats.pendingCards : 0;
  const search = (e) => { e.preventDefault(); if (q.trim()) { go('transactions', { q: q.trim() }); setQ(''); } };
  const common = { call, stats, reloadStats };

  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:flex flex-col w-64 shrink-0 sticky top-0 h-screen bg-ink-900 border-r border-ink-700/60 p-4">
        <div className="px-2 pt-2 pb-6"><Logo /></div>
        <nav className="space-y-1 flex-1 overflow-y-auto">
          {NAV.map((n) => {
            const active = route.id === n.id; const count = n.badge && stats?.[n.badge];
            return (
              <a key={n.id} href={`#/${n.id}`} className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${active ? 'bg-brand-500/15 text-brand-400 ring-1 ring-brand-500/30' : 'text-ink-300 hover:bg-ink-800 hover:text-white'}`}>
                <n.icon className="w-[18px] h-[18px]" />{n.label}
                {count > 0 && <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-amber-500 text-ink-950 text-[11px] font-bold grid place-items-center">{count}</span>}
              </a>
            );
          })}
        </nav>
        <div className="panel p-3 flex items-center gap-3 mt-3">
          <ShieldCheck className="w-8 h-8 text-brand-400 shrink-0" />
          <div className="text-xs"><p className="font-semibold text-white">Secure banking</p><p className="text-ink-300">Role: {me?.role || 'admin'}</p></div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-ink-700/60 bg-ink-950/85 backdrop-blur px-4 sm:px-8 py-3">
          <div className="lg:hidden"><img src="/logo-mark.png" alt="nirapod-bank" className="h-9 w-auto" /></div>
          <form onSubmit={search} className="relative flex-1 max-w-xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} className="field pl-10" placeholder="Search transactions by reference, name or account…" />
          </form>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => go(stats?.pendingUsers ? 'customers' : stats?.pendingAccounts ? 'accounts' : 'cards', { status: 'pending' })} className="relative p-2.5 rounded-xl text-ink-300 hover:bg-ink-800 hover:text-white" aria-label={`${pending} pending approvals`}>
              <Bell className="w-5 h-5" />
              {pending > 0 && <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-ink-950 text-[10px] font-bold grid place-items-center">{pending}</span>}
            </button>
            <div className="relative">
              <button onClick={() => setMenu((v) => !v)} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-ink-800">
                <Avatar name={me?.name || 'Admin'} size={36} />
                <div className="hidden sm:block text-left leading-tight"><p className="text-sm font-semibold text-white">{me?.name || 'Admin'}</p><p className="text-xs text-ink-300">Administrator</p></div>
                <ChevronDown className="w-4 h-4 text-ink-300" />
              </button>
              {menu && (
                <div className="absolute right-0 mt-2 w-48 panel p-1.5 shadow-2xl" onMouseLeave={() => setMenu(false)}>
                  <a href="#/settings" onClick={() => setMenu(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-ink-800"><SettingsIcon className="w-4 h-4" />Settings</a>
                  <button onClick={onLogout} className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-300 hover:bg-ink-800"><LogOut className="w-4 h-4" />Log out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <nav className="lg:hidden flex gap-2 overflow-x-auto px-4 py-2 border-b border-ink-700/60">
          {NAV.map((n) => <a key={n.id} href={`#/${n.id}`} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm ${route.id === n.id ? 'bg-brand-500 text-white' : 'bg-ink-800 text-ink-300'}`}>{n.label}</a>)}
        </nav>

        <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-8 py-6 lg:py-8">
          {route.id === 'dashboard' && <Dashboard {...common} />}
          {route.id === 'customers' && <Directory key="users" kind="users" initialStatus={route.query.get('status')} {...common} />}
          {route.id === 'accounts' && <Directory key="accounts" kind="accounts" initialStatus={route.query.get('status')} {...common} />}
          {route.id === 'cards' && <Directory key="cards" kind="cards" initialStatus={route.query.get('status')} {...common} />}
          {route.id === 'transactions' && <Transactions key={route.query.get('q') || ''} initialQ={route.query.get('q') || ''} {...common} />}
          {route.id === 'cash' && <CashDesk {...common} />}
          {route.id === 'reserve' && <Reserve {...common} />}
          {route.id === 'settings' && <Settings me={me} onLogout={onLogout} />}
        </main>
      </div>
    </div>
  );
}
