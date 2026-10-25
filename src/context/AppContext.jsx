import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { generateRef } from '../data/mockData';
import { api, getToken, setToken } from '../api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [profile, setProfile] = useState(null); // { user, accounts, cards } from the server
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [savings, setSavings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [hideBalance, setHideBalance] = useState(false);
    const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('nirapod-theme') || 'light';
    }
    return 'light';
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  const applyProfile = useCallback((data) => {
    setProfile(data);
    const acc = data.accounts.find((a) => a.status === 'approved');
    // Server balance + any local demo top-ups made this session are not persisted yet.
    setBalance(acc ? acc.balance : 0);
  }, []);

  const refreshProfile = useCallback(async () => {
    const data = await api('/me');
    applyProfile(data);
    return data;
  }, [applyProfile]);

  useEffect(() => {
    // Splash, and restore the session if a valid token exists
    const minSplash = new Promise((r) => setTimeout(r, 1500));
    const restore = getToken()
      ? api('/me').then(applyProfile).catch(() => setToken(null))
      : Promise.resolve();
    Promise.all([minSplash, restore]).then(() => {
      setShowSplash(false);
      setIsLoading(false);
    });
  }, [applyProfile]);

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
      return { success: true, role: user.role };
    } catch (e) {
      setToken(null);
      return { success: false, error: e.message, code: e.code };
    }
  }, [applyProfile]);

  const logout = useCallback(() => {
    setToken(null);
    setProfile(null);
    setBalance(0);
    setTransactions([]);
    setSavings([]);
    setNotifications([]);
  }, []);

  const toggleHideBalance = useCallback(() => {
    setHideBalance((v) => !v);
  }, []);

  const addDemoMoney = useCallback((amount = 5000) => {
    setBalance((b) => b + amount);
    const txn = {
      id: `txn_${Date.now()}`,
      type: 'received',
      title: 'Demo Top-up',
      counterparty: 'Nirapod Demo',
      amount,
      fee: 0,
      date: new Date().toISOString(),
      status: 'completed',
      category: 'income',
      reference: generateRef(),
      note: 'Virtual money added for testing',
    };
    setTransactions((prev) => [txn, ...prev]);
    addNotification({
      type: 'transaction',
      title: 'Demo Money Added',
      body: `৳${amount.toLocaleString()} credited to your demo account`,
    });
  }, []);

  const sendMoney = useCallback(({ recipient, amount, note, fee = 10 }) => {
    const total = amount + fee;
    if (total > balance) {
      return { success: false, error: 'Insufficient demo balance' };
    }
    setBalance((b) => b - total);
    const txn = {
      id: `txn_${Date.now()}`,
      type: 'sent',
      title: 'Send Money',
      counterparty: recipient.name || recipient.phone || 'Recipient',
      amount,
      fee,
      date: new Date().toISOString(),
      status: 'completed',
      category: 'transfer',
      reference: generateRef(),
      note: note || '',
    };
    setTransactions((prev) => [txn, ...prev]);
    addNotification({
      type: 'transaction',
      title: 'Transfer Successful',
      body: `৳${amount.toLocaleString()} sent to ${txn.counterparty}`,
    });
    return { success: true, transaction: txn };
  }, [balance]);

  const addNotification = useCallback((n) => {
    setNotifications((prev) => [
      {
        id: `n_${Date.now()}`,
        time: new Date().toISOString(),
        read: false,
        ...n,
      },
      ...prev,
    ]);
  }, []);

  const markNotificationRead = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const createSavingsGoal = useCallback((goal) => {
    const newGoal = {
      id: `sav_${Date.now()}`,
      saved: 0,
      color: 'emerald',
      ...goal,
    };
    setSavings((prev) => [newGoal, ...prev]);
  }, []);

  const contributeToSavings = useCallback((goalId, amount) => {
    if (amount > balance) return { success: false, error: 'Insufficient balance' };
    setBalance((b) => b - amount);
    setSavings((prev) =>
      prev.map((g) =>
        g.id === goalId ? { ...g, saved: Math.min(g.saved + amount, g.target) } : g
      )
    );
    const goal = savings.find((g) => g.id === goalId);
    const txn = {
      id: `txn_${Date.now()}`,
      type: 'sent',
      title: 'Savings Contribution',
      counterparty: goal?.name || 'Savings',
      amount,
      fee: 0,
      date: new Date().toISOString(),
      status: 'completed',
      category: 'savings',
      reference: generateRef(),
      note: '',
    };
    setTransactions((prev) => [txn, ...prev]);
    return { success: true };
  }, [balance, savings]);

  const isAuthenticated = !!profile;
  const account = profile?.accounts.find((a) => a.status === 'approved') || null;
  const user = profile
    ? {
        ...profile.user,
        accountNumber: account?.accountNumber || 'No account yet',
        kycStatus: 'Approved by admin',
      }
    : null;
  const accounts = profile?.accounts || [];
  const cards = profile?.cards || [];

  const value = {
    user,
    balance,
    transactions,
    savings,
    notifications,
    hideBalance,
    isAuthenticated,
    profile,
    accounts,
    cards,
    refreshProfile,
    theme,
    isLoading,
    showSplash,
    login,
    logout,
    toggleHideBalance,
    addDemoMoney,
    sendMoney,
    addNotification,
    markNotificationRead,
    markAllNotificationsRead,
    createSavingsGoal,
    contributeToSavings,
    setTheme,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
