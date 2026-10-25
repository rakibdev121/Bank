import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api, getToken, setToken } from '../api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [profile, setProfile] = useState(null); // { user, accounts, cards, config } from the server
  const [transactions, setTransactions] = useState([]);
  const [savings, setSavings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [hideBalance, setHideBalance] = useState(false);
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('nirapod-theme') || 'light';
    return 'light';
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  const loadMoney = useCallback(async () => {
    const [t, s, n] = await Promise.all([
      api('/transactions').catch(() => []),
      api('/savings').catch(() => []),
      api('/notifications').catch(() => []),
    ]);
    setTransactions(t);
    setSavings(s);
    setNotifications(n);
  }, []);

  const applyProfile = useCallback((data) => setProfile(data), []);

  // Reload everything that can change after a money movement
  const refreshAll = useCallback(async () => {
    const data = await api('/me');
    applyProfile(data);
    await loadMoney();
    return data;
  }, [applyProfile, loadMoney]);

  const refreshProfile = refreshAll;

  useEffect(() => {
    const minSplash = new Promise((r) => setTimeout(r, 1200));
    const restore = getToken()
      ? api('/me').then(async (d) => { applyProfile(d); await loadMoney(); }).catch(() => setToken(null))
      : Promise.resolve();
    Promise.all([minSplash, restore]).then(() => {
      setShowSplash(false);
      setIsLoading(false);
    });
  }, [applyProfile, loadMoney]);

  // Pick up money that arrives while the app is open (cash deposit at the counter, incoming transfers)
  useEffect(() => {
    if (!profile) return undefined;
    const tick = () => { if (document.visibilityState === 'visible') refreshAll().catch(() => {}); };
    const id = setInterval(tick, 20000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [profile?.user?.id, refreshAll]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('nirapod-theme', theme);
  }, [theme]);

  const login = useCallback(async (identifier, password) => {
    try {
      const { token, user } = await api('/auth/login', { method: 'POST', body: { identifier, password } });
      if (user.role !== 'customer') {
        return { success: false, error: 'Admins log in from the admin page (add #admin to the address).' };
      }
      setToken(token);
      const data = await api('/me');
      applyProfile(data);
      await loadMoney();
      return { success: true, role: user.role };
    } catch (e) {
      setToken(null);
      return { success: false, error: e.message, code: e.code };
    }
  }, [applyProfile, loadMoney]);

  const logout = useCallback(() => {
    setToken(null);
    setProfile(null);
    setTransactions([]);
    setSavings([]);
    setNotifications([]);
  }, []);

  const toggleHideBalance = useCallback(() => setHideBalance((v) => !v), []);

  const account = profile?.accounts.find((a) => a.status === 'approved') || null;
  const balance = account ? account.balance : 0;
  const fee = profile?.config?.transferFee ?? 10;

  const sendMoney = useCallback(async ({ to, amount, note, requestId }) => {
    try {
      const res = await api('/transfer', { method: 'POST', body: { to, amount, note, requestId } });
      await refreshAll();
      return { success: true, transaction: res.transaction };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }, [refreshAll]);

  const markNotificationRead = useCallback((id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    api('/notifications/read', { method: 'POST', body: { id } }).catch(() => {});
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    api('/notifications/read', { method: 'POST', body: {} }).catch(() => {});
  }, []);

  const createSavingsGoal = useCallback(async (goal) => {
    try {
      await api('/savings', { method: 'POST', body: goal });
      await refreshAll();
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }, [refreshAll]);

  const moveSavings = useCallback(async (goalId, action, amount) => {
    try {
      await api(`/savings/${goalId}/${action}`, { method: 'POST', body: { amount } });
      await refreshAll();
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }, [refreshAll]);

  const isAuthenticated = !!profile;
  const user = profile
    ? { ...profile.user, accountNumber: account?.accountNumber || 'No account yet', kycStatus: 'Approved by bank' }
    : null;

  const value = {
    user, balance, account, fee, transactions, savings, notifications, hideBalance, isAuthenticated, profile,
    accounts: profile?.accounts || [], cards: profile?.cards || [],
    refreshProfile, refreshAll, theme, isLoading, showSplash, login, logout, toggleHideBalance,
    sendMoney, markNotificationRead, markAllNotificationsRead, createSavingsGoal, moveSavings, setTheme,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
