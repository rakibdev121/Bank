import React, { useState } from 'react';
import { Eye, EyeOff, ArrowLeft, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { LoadingSpinner } from '../components/ui';
import { api } from '../api';

export default function Auth({ onSuccess }) {
  const { login } = useApp();
  const [mode, setMode] = useState('login'); // login | register | pending | forgot
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!phone.trim()) {
      setError('Please enter phone number or email');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }
    setLoading(true);
    const res = await login(phone.trim(), password);
    setLoading(false);
    if (res.success) onSuccess();
    else setError(res.error);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (name.trim().length < 2) {
      setError('Enter your full name');
      return;
    }
    if (!/^(?:\+?88)?01[3-9][\d\s-]{8,11}$/.test(phone.trim())) {
      setError('Enter a valid Bangladeshi mobile number (01XXXXXXXXX)');
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError('Enter a valid email address');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api('/auth/register', { method: 'POST', body: { name, phone, email, password } });
      setPassword('');
      setConfirmPassword('');
      setMode('pending');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-950 flex flex-col">
      <div className="flex-1 flex flex-col justify-center px-6 py-10 max-w-md mx-auto w-full">
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-white shadow-card border border-slate-100 items-center justify-center mb-4">
            <img src="/app-logo-mark.png" alt="" className="h-11 w-auto" />
          </div>
          <h1 className="text-2xl font-bold text-navy-900 dark:text-white">nirapod-bank</h1>
          <p className="text-sm text-slate-500 mt-1">Secure digital banking for Bangladesh</p>
          <span className="inline-block mt-3 text-[11px] font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            DEMO PROTOTYPE
          </span>
        </div>

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4 page-enter">
            <div>
              <label className="label">Phone or Email</label>
              <input
                type="text"
                className="input-field"
                placeholder="+880 1XXX-XXXXXX or email"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input-field pr-12"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                >
                  {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <LoadingSpinner className="w-5 h-5 mx-auto" /> : 'Log In'}
            </button>
            <div className="flex justify-between text-sm">
              <button type="button" onClick={() => { setMode('forgot'); setError(''); }} className="text-emerald-600 font-medium">
                Forgot password?
              </button>
              <button type="button" onClick={() => { setMode('register'); setError(''); }} className="text-navy-700 dark:text-slate-300 font-medium">
                Create account
              </button>
            </div>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4 page-enter">
            <button type="button" onClick={() => setMode('login')} className="flex items-center gap-1 text-sm text-slate-500 mb-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <div>
              <label className="label">Full Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="As on your NID"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
            <div>
              <label className="label">Phone Number</label>
              <input
                type="tel"
                className="input-field"
                placeholder="01XXXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
              />
            </div>
            <div>
              <label className="label">Email (Gmail)</label>
              <input
                type="email"
                className="input-field"
                placeholder="you@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input-field pr-12"
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400">
                  {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Confirm Password</label>
              <input
                type={showPass ? 'text' : 'password'}
                className="input-field"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <LoadingSpinner className="w-5 h-5 mx-auto" /> : 'Create Account'}
            </button>
          </form>
        )}

        {mode === 'pending' && (
          <div className="space-y-6 page-enter text-center">
            <div className="inline-flex w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 items-center justify-center">
              <Clock className="w-7 h-7 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-navy-900 dark:text-white">Registration received</h2>
              <p className="text-sm text-slate-500 mt-2">
                Your account is waiting for admin approval. Once approved, log in with your phone or email and password.
              </p>
            </div>
            <button onClick={() => { setMode('login'); setError(''); }} className="btn-primary w-full">
              Back to Log In
            </button>
          </div>
        )}

        {mode === 'forgot' && (
          <div className="space-y-4 page-enter">
            <button type="button" onClick={() => setMode('login')} className="flex items-center gap-1 text-sm text-slate-500 mb-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <h2 className="text-xl font-semibold text-navy-900 dark:text-white">Forgot password?</h2>
            <p className="text-sm text-slate-500">
              Self-service password reset is not available yet. Please contact Nirapod support and an admin will help you.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
