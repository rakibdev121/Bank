import React, { useCallback } from 'react';
import {
  ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, PiggyBank, Coins, MinusCircle,
} from 'lucide-react';
import { api } from '../../api';
import { formatBDT, formatDate, formatTime } from '../../utils/format';

export function useAdminCall(token, onExpired) {
  return useCallback(
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
}

// 5,00,00,00,000 -> "500 Crore" in words (Bangladeshi numbering)
export function amountWords(n) {
  if (!n || n <= 0) return '';
  let rest = Math.floor(n);
  const cr = Math.floor(rest / 1e7); rest %= 1e7;
  const lk = Math.floor(rest / 1e5); rest %= 1e5;
  const th = Math.floor(rest / 1e3); rest %= 1e3;
  const parts = [];
  if (cr) parts.push(`${cr.toLocaleString('en-IN')} Crore`);
  if (lk) parts.push(`${lk} Lakh`);
  if (th) parts.push(`${th} Thousand`);
  if (rest) parts.push(`${rest}`);
  return parts.join(' ');
}

export const KIND = {
  cash_in: { label: 'Cash deposit', icon: ArrowDownToLine, tone: 'emerald', sign: '+' },
  cash_out: { label: 'Cash withdrawal', icon: ArrowUpFromLine, tone: 'amber', sign: '-' },
  transfer: { label: 'Transfer', icon: ArrowLeftRight, tone: 'blue', sign: '' },
  savings_in: { label: 'Savings in', icon: PiggyBank, tone: 'violet', sign: '' },
  savings_out: { label: 'Savings out', icon: PiggyBank, tone: 'violet', sign: '' },
  reserve_add: { label: 'Reserve added', icon: Coins, tone: 'emerald', sign: '+' },
  reserve_remove: { label: 'Reserve removed', icon: MinusCircle, tone: 'red', sign: '-' },
};

const TONES = {
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

export function KindIcon({ kind, className = '' }) {
  const k = KIND[kind] || KIND.transfer;
  return (
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${TONES[k.tone]} ${className}`}>
      <k.icon className="w-5 h-5" />
    </div>
  );
}

export function TxnRow({ t }) {
  const k = KIND[t.kind] || KIND.transfer;
  const who =
    t.kind === 'transfer' ? `${t.from} → ${t.to}`
    : t.kind === 'cash_in' ? `To ${t.to}`
    : t.kind === 'cash_out' ? `From ${t.from}`
    : t.kind === 'savings_in' ? `${t.from} · ${t.note || 'goal'}`
    : t.kind === 'savings_out' ? `${t.to} · ${t.note || 'goal'}`
    : t.note || 'Reserve adjustment';
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <KindIcon kind={t.kind} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-navy-900 dark:text-white truncate">{k.label}</p>
        <p className="text-xs text-slate-500 truncate">{who}</p>
        <p className="text-[11px] text-slate-400 font-mono truncate">{t.reference}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-semibold ${k.tone === 'emerald' ? 'text-emerald-600' : k.tone === 'red' || k.tone === 'amber' ? 'text-amber-600' : 'text-navy-900 dark:text-white'}`}>
          {k.sign}{formatBDT(t.amount)}
        </p>
        <p className="text-[11px] text-slate-400">{formatDate(t.date)} · {formatTime(t.date)}</p>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-5">
      <div>
        <h2 className="text-xl font-bold text-navy-900 dark:text-white">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, hint, tone = 'slate' }) {
  const ring = {
    slate: 'bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-300',
    emerald: TONES.emerald, amber: TONES.amber, blue: TONES.blue, violet: TONES.violet,
  }[tone];
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${ring}`}><Icon className="w-4 h-4" /></div>
      </div>
      <p className="text-2xl font-bold text-navy-900 dark:text-white truncate">{value}</p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

// Money input with live "in words" line and quick-pick chips
export function AmountField({ label, value, onChange, chips = [], autoFocus }) {
  const n = parseFloat(value) || 0;
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-slate-400">৳</span>
        <input
          type="number" inputMode="decimal" min="0" step="0.01" autoFocus={autoFocus}
          className="input-field pl-10 text-xl font-bold" placeholder="0.00"
          value={value} onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1.5 min-h-[1rem]">
        {n > 0 ? `${amountWords(n)} taka` : ''}
      </p>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {chips.map((c) => (
            <button key={c.label} type="button" onClick={() => onChange(String(c.value))}
              className="px-3 py-1.5 rounded-full text-xs font-medium border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600">
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
