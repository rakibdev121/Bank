import React, { useState } from 'react';
import {
  User, Shield, Bell, Moon, Sun, HelpCircle, LogOut,
  ChevronRight, Lock, Smartphone, Eye, EyeOff
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Avatar, ConfirmDialog, Modal } from '../components/ui';
import { api } from '../api';

export default function Profile({ onNavigate }) {
  const { user, theme, setTheme, logout } = useApp();
  const [showLogout, setShowLogout] = useState(false);
  const [screen, setScreen] = useState(null); // personal | security | password | notifications | help
  const [showPass, setShowPass] = useState(false);
  const [passForm, setPassForm] = useState({ current: '', next: '', confirm: '' });
  const [passMsg, setPassMsg] = useState('');
  const [notifPrefs, setNotifPrefs] = useState({
    transactions: true,
    security: true,
    marketing: false,
  });

  const menu = [
    { id: 'personal', icon: User, label: 'Personal Information' },
    { id: 'security', icon: Shield, label: 'Security' },
    { id: 'password', icon: Lock, label: 'Change Password' },
    { id: 'notifications', icon: Bell, label: 'Notifications' },
    { id: 'theme', icon: theme === 'dark' ? Sun : Moon, label: theme === 'dark' ? 'Light Mode' : 'Dark Mode', action: () => setTheme(theme === 'dark' ? 'light' : 'dark') },
    { id: 'help', icon: HelpCircle, label: 'Help & Support' },
  ];

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passForm.next.length < 8) {
      setPassMsg('New password must be at least 8 characters');
      return;
    }
    if (passForm.next !== passForm.confirm) {
      setPassMsg('Passwords do not match');
      return;
    }
    try {
      await api('/me/password', { method: 'POST', body: { current: passForm.current, new: passForm.next } });
      setPassMsg('Password updated');
      setTimeout(() => {
        setScreen(null);
        setPassForm({ current: '', next: '', confirm: '' });
        setPassMsg('');
      }, 1200);
    } catch (err) {
      setPassMsg(err.message);
    }
  };

  if (screen === 'personal') {
    return (
      <SubScreen title="Personal Information" onBack={() => setScreen(null)}>
        <div className="space-y-4">
          <InfoRow label="Full Name" value={user.name} />
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="Phone" value={user.phone} />
          <InfoRow label="Account Number" value={user.accountNumber} />
          <InfoRow label="Member Since" value={user.memberSince} />
          <InfoRow label="KYC Status" value={user.kycStatus} />
        </div>
      </SubScreen>
    );
  }

  if (screen === 'security') {
    return (
      <SubScreen title="Security" onBack={() => setScreen(null)}>
        <div className="space-y-3">
          <div className="card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-slate-500" />
              <div>
                <p className="text-sm font-medium">Two-Factor Authentication</p>
                <p className="text-xs text-slate-500">Coming soon</p>
              </div>
            </div>
            <span className="text-xs text-slate-400">—</span>
          </div>
          <div className="card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-slate-500" />
              <div>
                <p className="text-sm font-medium">Biometric Login</p>
                <p className="text-xs text-slate-500">Coming soon</p>
              </div>
            </div>
            <span className="text-xs text-slate-400">—</span>
          </div>
        </div>
      </SubScreen>
    );
  }

  if (screen === 'password') {
    return (
      <SubScreen title="Change Password" onBack={() => setScreen(null)}>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="label">Current Password</label>
            <input type={showPass ? 'text' : 'password'} className="input-field" value={passForm.current} onChange={(e) => setPassForm({ ...passForm, current: e.target.value })} />
          </div>
          <div>
            <label className="label">New Password</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} className="input-field pr-12" value={passForm.next} onChange={(e) => setPassForm({ ...passForm, next: e.target.value })} />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input type={showPass ? 'text' : 'password'} className="input-field" value={passForm.confirm} onChange={(e) => setPassForm({ ...passForm, confirm: e.target.value })} />
          </div>
          {passMsg && <p className={`text-sm ${passMsg.includes('updated') ? 'text-emerald-600' : 'text-red-600'}`}>{passMsg}</p>}
          <button type="submit" className="btn-primary w-full">Update Password</button>
        </form>
      </SubScreen>
    );
  }

  if (screen === 'notifications') {
    return (
      <SubScreen title="Notification Preferences" onBack={() => setScreen(null)}>
        <div className="space-y-3">
          {[
            { key: 'transactions', label: 'Transaction Alerts', desc: 'Send & receive confirmations' },
            { key: 'security', label: 'Security Alerts', desc: 'Login and device changes' },
            { key: 'marketing', label: 'Promotions', desc: 'Offers and product updates' },
          ].map((item) => (
            <label key={item.key} className="card p-4 flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-navy-900 dark:text-white">{item.label}</p>
                <p className="text-xs text-slate-500">{item.desc}</p>
              </div>
              <input
                type="checkbox"
                checked={notifPrefs[item.key]}
                onChange={() => setNotifPrefs({ ...notifPrefs, [item.key]: !notifPrefs[item.key] })}
                className="w-5 h-5 rounded accent-emerald-600"
              />
            </label>
          ))}
        </div>
      </SubScreen>
    );
  }

  if (screen === 'help') {
    return (
      <SubScreen title="Help & Support" onBack={() => setScreen(null)}>
        <div className="space-y-3 text-sm">
          <div className="card p-4">
            <p className="font-medium mb-1">About Nirapod Bank</p>
            <p className="text-slate-500">
              Deposit cash at a Nirapod counter to add money to your account. You can then send money to other customers, save towards goals and manage your cards from the app.
            </p>
          </div>
          <div className="card p-4">
            <p className="font-medium mb-1">Contact</p>
            <p className="text-slate-500">support@nirapod.bank</p>
            <p className="text-slate-500">+880 9600-000000</p>
          </div>
        </div>
      </SubScreen>
    );
  }

  return (
    <div className="pb-24 page-enter">
      <header className="px-5 pt-6 pb-6">
        <div className="flex items-center gap-4">
          <Avatar name={user.name} size="xl" />
          <div>
            <h1 className="text-xl font-bold text-navy-900 dark:text-white">{user.name}</h1>
            <p className="text-sm text-slate-500">{user.phone}</p>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">{user.accountNumber}</p>
          </div>
        </div>
      </header>

      <div className="px-5 space-y-1">
        {menu.map((item) => (
          <button
            key={item.id}
            onClick={() => (item.action ? item.action() : setScreen(item.id))}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-white dark:hover:bg-navy-800 transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-navy-800 flex items-center justify-center">
              <item.icon className="w-4.5 h-4.5 text-navy-700 dark:text-slate-300" />
            </div>
            <span className="flex-1 text-left text-sm font-medium text-navy-900 dark:text-white">
              {item.label}
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        ))}
      </div>

      <div className="px-5 mt-6">
        <button
          onClick={() => setShowLogout(true)}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-red-600 font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Log Out
        </button>
      </div>

      <ConfirmDialog
        open={showLogout}
        onClose={() => setShowLogout(false)}
        onConfirm={logout}
        title="Log Out"
        message="Are you sure you want to log out?"
        confirmLabel="Log Out"
        danger
      />
    </div>
  );
}

function SubScreen({ title, onBack, children }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-950 page-enter">
      <header className="sticky top-0 z-10 bg-white/95 dark:bg-navy-900/95 backdrop-blur border-b border-slate-100 dark:border-navy-800 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-1 rounded-xl hover:bg-slate-100 dark:hover:bg-navy-800">
          <ChevronRight className="w-5 h-5 rotate-180" />
        </button>
        <h1 className="text-lg font-semibold text-navy-900 dark:text-white">{title}</h1>
      </header>
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-navy-900 dark:text-white">{value}</p>
    </div>
  );
}
