import React, { useState } from 'react';
import { Search, CheckCircle2, ArrowDownToLine, ArrowUpFromLine, UserRound } from 'lucide-react';
import { formatBDT } from '../../utils/format';
import { ConfirmDialog, LoadingSpinner, Avatar } from '../../components/ui';
import { PageHeader, AmountField } from './shared';

const CHIPS = [500, 1000, 5000, 10000, 50000].map((v) => ({ label: `৳${v.toLocaleString('en-IN')}`, value: v }));

export default function CashDesk({ call, stats, reloadStats }) {
  const [mode, setMode] = useState('in'); // in = customer gives cash, out = customer takes cash
  const [query, setQuery] = useState('');
  const [customer, setCustomer] = useState(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [finding, setFinding] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const reserve = stats?.reserve?.balance ?? 0;
  const n = parseFloat(amount) || 0;
  const tooMuch = mode === 'in' ? n > reserve : customer && n > customer.balance;

  const find = async () => {
    setError(''); setCustomer(null); setFinding(true);
    try { setCustomer(await call(`/admin/lookup?q=${encodeURIComponent(query.trim())}`)); }
    catch (e) { setError(e.message); }
    setFinding(false);
  };

  const submit = async () => {
    setBusy(true); setError('');
    try {
      const res = await call(mode === 'in' ? '/admin/cash-in' : '/admin/cash-out', {
        method: 'POST', body: { account: customer.accountNumber, amount: String(amount), note },
      });
      setReceipt({ ...res, mode });
      await reloadStats();
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const reset = () => { setReceipt(null); setCustomer(null); setQuery(''); setAmount(''); setNote(''); setError(''); };

  if (receipt) {
    return (
      <div className="max-w-md mx-auto text-center space-y-5 py-6">
        <div className="inline-flex w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-navy-900 dark:text-white">{receipt.mode === 'in' ? 'Cash received' : 'Cash paid out'}</h2>
          <p className="text-sm text-slate-500 mt-1">
            {formatBDT(receipt.amount)} {receipt.mode === 'in' ? 'credited to' : 'debited from'} {receipt.customer}
          </p>
        </div>
        <div className="card p-4 text-left text-sm space-y-2">
          <div className="flex justify-between"><span className="text-slate-500">Account</span><span className="font-mono text-xs">{receipt.accountNumber}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">New customer balance</span><span className="font-semibold">{formatBDT(receipt.newBalance)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Reference</span><span className="font-mono text-xs">{receipt.reference}</span></div>
        </div>
        <button onClick={reset} className="btn-primary w-full">New {receipt.mode === 'in' ? 'deposit' : 'withdrawal'}</button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <PageHeader title="Cash desk" subtitle="Take cash from a customer and move e-money from the reserve to their wallet." />

      <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-navy-800 mb-5">
        {[['in', 'Receive cash', ArrowDownToLine], ['out', 'Pay out cash', ArrowUpFromLine]].map(([id, label, Icon]) => (
          <button key={id} onClick={() => { setMode(id); setError(''); }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${mode === id ? 'bg-white dark:bg-navy-700 shadow-card text-navy-900 dark:text-white' : 'text-slate-500'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      <div className="card p-5 space-y-5">
        <div>
          <label className="label">1. Find customer</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input className="input-field pl-11" placeholder="Phone, email or account number" value={query}
                onChange={(e) => { setQuery(e.target.value); setCustomer(null); }} onKeyDown={(e) => e.key === 'Enter' && query.trim() && find()} />
            </div>
            <button onClick={find} disabled={!query.trim() || finding} className="btn-primary px-5 shrink-0">
              {finding ? <LoadingSpinner className="w-5 h-5 text-white" /> : 'Find'}
            </button>
          </div>
        </div>

        {customer && (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/60 dark:bg-emerald-900/10 p-4 flex items-center gap-3">
            <Avatar name={customer.name} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-navy-900 dark:text-white truncate">{customer.name}</p>
              <p className="text-xs text-slate-500 truncate">{customer.phone} · {customer.accountType}</p>
              <p className="text-xs font-mono text-slate-500 truncate">{customer.accountNumber}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[11px] text-slate-400">Balance</p>
              <p className="text-sm font-bold text-navy-900 dark:text-white">{formatBDT(customer.balance)}</p>
            </div>
          </div>
        )}
        {!customer && !error && <p className="text-xs text-slate-400 flex items-center gap-1.5"><UserRound className="w-3.5 h-3.5" /> Confirm the customer's identity before taking cash.</p>}

        <div className={customer ? '' : 'opacity-40 pointer-events-none'}>
          <AmountField label={mode === 'in' ? '2. Cash received (৳)' : '2. Cash to pay out (৳)'} value={amount} onChange={setAmount} chips={CHIPS} />
          <div className="mt-4">
            <label className="label">Note (optional)</label>
            <input className="input-field" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Counter, teller or remarks" />
          </div>
          {n > 0 && customer && (
            <div className="mt-4 rounded-xl bg-slate-50 dark:bg-navy-800 p-3 text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-slate-500">Customer balance after</span><span className="font-semibold">{formatBDT(customer.balance + (mode === 'in' ? n : -n))}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Reserve after</span><span className="font-semibold">{formatBDT(reserve + (mode === 'in' ? -n : n))}</span></div>
            </div>
          )}
        </div>

        {tooMuch && <p className="text-sm text-red-600">{mode === 'in' ? `Reserve only has ${formatBDT(reserve)}. Add more reserve first.` : `Customer only has ${formatBDT(customer.balance)}.`}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <button disabled={!customer || !n || tooMuch || busy} onClick={() => setConfirm(true)} className="btn-accent w-full">
          {busy ? <LoadingSpinner className="w-5 h-5 mx-auto text-white" /> : mode === 'in' ? 'Confirm cash received' : 'Confirm cash paid out'}
        </button>
      </div>

      <ConfirmDialog
        open={confirm} onClose={() => setConfirm(false)} onConfirm={submit} confirmLabel="Confirm"
        title={mode === 'in' ? 'Cash received?' : 'Cash paid out?'}
        message={mode === 'in'
          ? `You have received ${formatBDT(n)} in cash from ${customer?.name}. ${formatBDT(n)} will move from the reserve to their wallet.`
          : `You are handing ${formatBDT(n)} in cash to ${customer?.name}. It will be deducted from their wallet and returned to the reserve.`}
      />
    </div>
  );
}
