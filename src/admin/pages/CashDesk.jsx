import React, { useState } from 'react';
import { Search, CheckCircle2, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { formatBDT } from '../../utils/format';
import { PageHeader, Avatar, Spinner, Modal, AmountField } from '../ui';

const CHIPS = [500, 1000, 5000, 10000, 50000].map((v) => ({ label: `৳${v.toLocaleString('en-IN')}`, value: v }));

export default function CashDesk({ call, stats, reloadStats }) {
  const [mode, setMode] = useState('in');
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
    try { setCustomer(await call(`/admin/lookup?q=${encodeURIComponent(query.trim())}`)); } catch (e) { setError(e.message); }
    setFinding(false);
  };
  const submit = async () => {
    setBusy(true); setError('');
    try {
      const res = await call(mode === 'in' ? '/admin/cash-in' : '/admin/cash-out', { method: 'POST', body: { account: customer.accountNumber, amount: String(amount), note } });
      setConfirm(false); setReceipt({ ...res, mode }); await reloadStats();
    } catch (e) { setError(e.message); setConfirm(false); }
    setBusy(false);
  };
  const reset = () => { setReceipt(null); setCustomer(null); setQuery(''); setAmount(''); setNote(''); setError(''); };

  if (receipt) {
    return (
      <div className="max-w-md mx-auto text-center space-y-5 py-10">
        <div className="inline-grid w-20 h-20 rounded-full bg-emerald-500/15 place-items-center"><CheckCircle2 className="w-10 h-10 text-emerald-300" /></div>
        <div><h1 className="text-2xl font-bold text-white">{receipt.mode === 'in' ? 'Cash received' : 'Cash paid out'}</h1>
          <p className="text-sm text-ink-300 mt-1">{formatBDT(receipt.amount)} {receipt.mode === 'in' ? 'credited to' : 'debited from'} {receipt.customer}</p></div>
        <div className="panel p-4 text-left text-sm space-y-2">
          <div className="flex justify-between"><span className="text-ink-300">Account</span><span className="font-mono text-xs">{receipt.accountNumber}</span></div>
          <div className="flex justify-between"><span className="text-ink-300">New customer balance</span><span className="font-semibold text-white">{formatBDT(receipt.newBalance)}</span></div>
          <div className="flex justify-between"><span className="text-ink-300">Reference</span><span className="font-mono text-xs">{receipt.reference}</span></div>
        </div>
        <button onClick={reset} className="btn-brand w-full">New {receipt.mode === 'in' ? 'deposit' : 'withdrawal'}</button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Cash desk" subtitle="Take cash from a customer and move e-money from the reserve to their wallet (or the reverse)." />
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-ink-850 mb-5">
        {[['in', 'Receive cash', ArrowDownToLine], ['out', 'Pay out cash', ArrowUpFromLine]].map(([id, label, Icon]) => (
          <button key={id} onClick={() => { setMode(id); setError(''); }} className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium ${mode === id ? 'bg-brand-500 text-white' : 'text-ink-300 hover:text-white'}`}><Icon className="w-4 h-4" />{label}</button>
        ))}
      </div>
      <div className="panel p-6 space-y-5">
        <div>
          <label className="lbl">1. Find customer</label>
          <div className="flex gap-2">
            <div className="relative flex-1"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
              <input className="field pl-10" placeholder="Phone, email or account number" value={query} onChange={(e) => { setQuery(e.target.value); setCustomer(null); }} onKeyDown={(e) => e.key === 'Enter' && query.trim() && find()} /></div>
            <button onClick={find} disabled={!query.trim() || finding} className="btn-brand px-6">{finding ? <Spinner className="w-4 h-4 !text-white" /> : 'Find'}</button>
          </div>
        </div>
        {customer && (
          <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-4 flex items-center gap-3">
            <Avatar name={customer.name} size={44} />
            <div className="min-w-0 flex-1"><p className="font-semibold text-white truncate">{customer.name}</p><p className="text-xs text-ink-300 truncate capitalize">{customer.phone} · {customer.accountType}</p><p className="text-xs font-mono text-ink-400">{customer.accountNumber}</p></div>
            <div className="text-right"><p className="text-xs text-ink-400">Balance</p><p className="font-bold text-white">{formatBDT(customer.balance)}</p></div>
          </div>
        )}
        <div className={customer ? 'space-y-4' : 'space-y-4 opacity-40 pointer-events-none'}>
          <AmountField label={mode === 'in' ? '2. Cash received' : '2. Cash to pay out'} value={amount} onChange={setAmount} chips={CHIPS} />
          <div><label className="lbl">Note (optional)</label><input className="field" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Counter, teller or remarks" /></div>
          {n > 0 && customer && (
            <div className="rounded-xl bg-ink-850 p-3 text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-ink-300">Customer balance after</span><span className="font-semibold text-white">{formatBDT(customer.balance + (mode === 'in' ? n : -n))}</span></div>
              <div className="flex justify-between"><span className="text-ink-300">Reserve after</span><span className="font-semibold text-white">{formatBDT(reserve + (mode === 'in' ? -n : n))}</span></div>
            </div>
          )}
        </div>
        {tooMuch && <p className="text-sm text-red-400">{mode === 'in' ? `Reserve only has ${formatBDT(reserve)}. Add more reserve first.` : `Customer only has ${formatBDT(customer.balance)}.`}</p>}
        {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
        <button disabled={!customer || !n || tooMuch || busy} onClick={() => setConfirm(true)} className="btn-brand w-full">{mode === 'in' ? 'Confirm cash received' : 'Confirm cash paid out'}</button>
      </div>
      <Modal open={confirm} onClose={() => setConfirm(false)} title={mode === 'in' ? 'Cash received?' : 'Cash paid out?'}>
        <p className="text-sm text-ink-300 mb-5">{mode === 'in'
          ? `You received ${formatBDT(n)} in cash from ${customer?.name}. ${formatBDT(n)} moves from the reserve to their wallet.`
          : `You are handing ${formatBDT(n)} in cash to ${customer?.name}. It is deducted from their wallet and returned to the reserve.`}</p>
        <div className="flex gap-2"><button className="btn-ghost flex-1" onClick={() => setConfirm(false)}>Cancel</button><button className="btn-brand flex-1" disabled={busy} onClick={submit}>{busy ? <Spinner className="w-4 h-4 !text-white" /> : 'Confirm'}</button></div>
      </Modal>
    </div>
  );
}
