import React, { useCallback, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, PiggyBank, Coins, MinusCircle } from 'lucide-react';
import { api } from '../api';
import { formatBDT, formatDate, formatTime } from '../utils/format';

export function useAdminCall(token, onExpired) {
  return useCallback(async (path, opts) => {
    try { return await api(path, { ...opts, token }); }
    catch (e) { if (e.status === 401) onExpired(); throw e; }
  }, [token, onExpired]);
}

export function Spinner({ className = 'w-5 h-5' }) {
  return <svg className={`animate-spin text-brand-400 ${className}`} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity=".25" /><path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>;
}
export const Loading = () => <div className="py-16 flex justify-center"><Spinner className="w-7 h-7" /></div>;

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-ink-300 mt-1">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

const BADGE = {
  green: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  red: 'bg-red-500/15 text-red-300 border-red-500/30',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  blue: 'bg-brand-500/15 text-brand-400 border-brand-500/30',
  violet: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  slate: 'bg-ink-700/60 text-ink-300 border-ink-600',
};
export function Badge({ tone = 'slate', children }) {
  return <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium capitalize ${BADGE[tone]}`}>{children}</span>;
}
export const STATUS_TONE = { pending: 'amber', approved: 'green', rejected: 'red', suspended: 'red', blocked: 'red' };

export function Avatar({ name = '?', size = 36 }) {
  const i = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  return <div style={{ width: size, height: size }} className="shrink-0 rounded-full bg-ink-700 text-slate-200 grid place-items-center text-xs font-semibold">{i}</div>;
}

export function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/60 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="panel w-full max-w-md p-6 shadow-2xl" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="p-1 text-ink-300 hover:text-white" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="panel p-5 flex items-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/25 grid place-items-center shrink-0">
        <Icon className="w-6 h-6 text-brand-400" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-ink-300">{label}</p>
        <p className="text-2xl font-bold text-white truncate">{value}</p>
        {hint && <p className="text-xs text-ink-400 mt-0.5 truncate">{hint}</p>}
      </div>
    </div>
  );
}

export function Pagination({ page, pages, onPage, info }) {
  if (pages <= 1 && !info) return null;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-ink-700/70 text-sm text-ink-300">
      <span>{info}</span>
      <div className="flex items-center gap-1">
        <button className="btn-ghost !p-2" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous"><ChevronLeft className="w-4 h-4" /></button>
        {nums.map((n, i) => (
          <React.Fragment key={n}>
            {i > 0 && n - nums[i - 1] > 1 && <span className="px-1">…</span>}
            <button onClick={() => onPage(n)} className={`btn !px-3 !py-1.5 ${n === page ? 'border border-brand-500 text-brand-400' : 'text-ink-300 hover:text-white'}`}>{n}</button>
          </React.Fragment>
        ))}
        <button className="btn-ghost !p-2" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next"><ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

export function AmountField({ label, value, onChange, chips = [] }) {
  const n = parseFloat(value) || 0;
  return (
    <div>
      <label className="lbl">{label}</label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold text-ink-300">৳</span>
        <input type="number" min="0" step="0.01" className="field pl-9 text-lg font-semibold" placeholder="0.00" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
      <p className="text-xs text-brand-400 mt-1.5 min-h-[1rem]">{n > 0 ? `${amountWords(n)} taka` : ''}</p>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1.5">
          {chips.map((c) => <button key={c.label} type="button" onClick={() => onChange(String(c.value))} className="rounded-full border border-ink-700 px-3 py-1 text-xs text-ink-300 hover:border-brand-500 hover:text-brand-400">{c.label}</button>)}
        </div>
      )}
    </div>
  );
}

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

// kind -> label, credit/debit direction, badge tone
export const KIND = {
  cash_in: { label: 'Cash deposit', dir: 'Credit', tone: 'green', sign: '+', icon: ArrowDownToLine },
  cash_out: { label: 'Cash withdrawal', dir: 'Debit', tone: 'red', sign: '-', icon: ArrowUpFromLine },
  transfer: { label: 'Transfer', dir: 'Transfer', tone: 'blue', sign: '', icon: ArrowLeftRight },
  savings_in: { label: 'Savings in', dir: 'Savings', tone: 'violet', sign: '', icon: PiggyBank },
  savings_out: { label: 'Savings out', dir: 'Savings', tone: 'violet', sign: '', icon: PiggyBank },
  reserve_add: { label: 'Reserve added', dir: 'Credit', tone: 'green', sign: '+', icon: Coins },
  reserve_remove: { label: 'Reserve removed', dir: 'Debit', tone: 'red', sign: '-', icon: MinusCircle },
};
export function txnParties(t) {
  switch (t.kind) {
    case 'transfer': return [`${t.from} → ${t.to}`, `${t.fromAccount || ''}`];
    case 'cash_in': return [t.to, t.toAccount];
    case 'cash_out': return [t.from, t.fromAccount];
    case 'savings_in': return [t.from, t.note || 'goal'];
    case 'savings_out': return [t.to, t.note || 'goal'];
    default: return ['Bank reserve', t.note || 'Reserve adjustment'];
  }
}

export function TxnTable({ rows }) {
  if (!rows.length) return <p className="px-5 py-14 text-center text-sm text-ink-400">No transactions found</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px]">
        <thead><tr className="border-b border-ink-700/70"><th className="th">Reference</th><th className="th">Customer / party</th><th className="th">Amount</th><th className="th">Type</th><th className="th">Status</th><th className="th">Date</th></tr></thead>
        <tbody className="divide-y divide-ink-700/50">
          {rows.map((t) => {
            const k = KIND[t.kind] || KIND.transfer;
            const [who, sub] = txnParties(t);
            return (
              <tr key={t.id} className="hover:bg-ink-850/60">
                <td className="td font-mono text-xs text-ink-300">{t.reference}</td>
                <td className="td"><div className="flex items-center gap-3 min-w-0"><Avatar name={who || '?'} size={32} /><div className="min-w-0"><p className="font-medium text-white truncate">{who}</p><p className="text-xs text-ink-400 truncate">{sub}</p></div></div></td>
                <td className={`td font-semibold ${k.tone === 'green' ? 'text-emerald-300' : k.tone === 'red' ? 'text-red-300' : 'text-white'}`}>{k.sign}{formatBDT(t.amount)}</td>
                <td className="td"><Badge tone={k.tone}>{k.dir === 'Transfer' || k.dir === 'Savings' ? k.label : `${k.dir} · ${k.label}`}</Badge></td>
                <td className="td"><Badge tone="green">Completed</Badge></td>
                <td className="td text-ink-300 whitespace-nowrap">{formatDate(t.date)} · {formatTime(t.date)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
