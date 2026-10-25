import React, { useState, useMemo, useRef } from 'react';
import { ArrowLeft, Search, CheckCircle2, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../api';
import { formatBDT, newRequestId } from '../utils/format';
import { Avatar, LoadingSpinner } from '../components/ui';

export default function SendMoney({ onBack, onNavigate }) {
  const { balance, sendMoney, transactions, fee, account } = useApp();
  const [step, setStep] = useState(1); // 1 recipient, 2 amount, 3 review, 4 success
  const [query, setQuery] = useState('');
  const [recipient, setRecipient] = useState(null); // { name, phone, accountNumber }
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [looking, setLooking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultTxn, setResultTxn] = useState(null);
  const requestId = useRef(newRequestId()); // same id on retry/double-tap => server sends only once

  const amountNum = parseFloat(amount) || 0;
  const total = amountNum + fee;

  // Recent people = unique recipients from this customer's own sent transfers
  const recent = useMemo(() => {
    const seen = new Map();
    transactions
      .filter((t) => t.kind === 'transfer' && t.type === 'sent' && t.counterpartyPhone)
      .forEach((t) => { if (!seen.has(t.counterpartyPhone)) seen.set(t.counterpartyPhone, { name: t.counterparty, phone: t.counterpartyPhone }); });
    return [...seen.values()].slice(0, 6);
  }, [transactions]);

  const lookup = async (q) => {
    setError('');
    setLooking(true);
    try {
      const r = await api(`/recipients/lookup?q=${encodeURIComponent(q.trim())}`);
      setRecipient(r);
      setStep(2);
    } catch (e) {
      setError(e.message);
    }
    setLooking(false);
  };

  const goReview = () => {
    if (!amountNum || amountNum <= 0) return setError('Enter a valid amount');
    if (!/^\d+(\.\d{1,2})?$/.test(amount)) return setError('Amount can have at most 2 decimals');
    if (total > balance) return setError('Insufficient balance');
    setError('');
    setStep(3);
  };

  const confirmTransfer = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    const res = await sendMoney({ to: recipient.phone, amount: amountNum, note, requestId: requestId.current });
    setLoading(false);
    if (res.success) {
      setResultTxn(res.transaction);
      setStep(4);
    } else {
      setError(res.error);
      if (/balance/i.test(res.error)) setStep(2);
    }
  };

  if (!account) {
    return (
      <div className="min-h-screen px-6 py-16 text-center page-enter">
        <p className="text-slate-500 mb-4">You need an approved bank account before sending money.</p>
        <button onClick={onBack} className="btn-secondary">Go back</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-950 pb-8 page-enter">
      <header className="sticky top-0 z-10 bg-white/95 dark:bg-navy-900/95 backdrop-blur border-b border-slate-100 dark:border-navy-800 px-4 py-3 flex items-center gap-3">
        {step < 4 && (
          <button
            onClick={() => (step === 1 ? onBack() : setStep(step - 1))}
            className="p-2 -ml-1 rounded-xl hover:bg-slate-100 dark:hover:bg-navy-800"
          >
            <ArrowLeft className="w-5 h-5 text-navy-700 dark:text-slate-300" />
          </button>
        )}
        <h1 className="text-lg font-semibold text-navy-900 dark:text-white">
          {step === 4 ? 'Transfer Complete' : 'Send Money'}
        </h1>
      </header>

      <div className="px-5 pt-5 max-w-lg mx-auto">
        {step < 4 && (
          <div className="flex gap-1.5 mb-6">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-navy-700'}`} />
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label className="label">Phone number or account number</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    className="input-field pl-11"
                    placeholder="01XXXXXXXXX or NIR-…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && query.trim() && lookup(query)}
                  />
                </div>
                <button onClick={() => lookup(query)} disabled={!query.trim() || looking} className="btn-primary px-4 shrink-0">
                  {looking ? <LoadingSpinner className="w-5 h-5 text-white" /> : 'Next'}
                </button>
              </div>
              {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
            </div>

            {recent.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Recent</p>
                <div className="card divide-y divide-slate-100 dark:divide-navy-800">
                  {recent.map((c) => (
                    <button key={c.phone} onClick={() => lookup(c.phone)} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-navy-800/50 text-left">
                      <Avatar name={c.name} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-navy-900 dark:text-white">{c.name}</p>
                        <p className="text-xs text-slate-500">{c.phone}</p>
                      </div>
                      <Clock className="w-4 h-4 text-slate-300" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && recipient && (
          <div className="space-y-5">
            <div className="card p-4 flex items-center gap-3">
              <Avatar name={recipient.name} size="md" />
              <div>
                <p className="font-medium text-navy-900 dark:text-white">{recipient.name}</p>
                <p className="text-xs text-slate-500">{recipient.phone}</p>
              </div>
            </div>

            <div>
              <label className="label">Amount (BDT)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-slate-400">৳</span>
                <input type="number" inputMode="decimal" className="input-field pl-10 text-2xl font-bold" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
              </div>
              <p className="text-xs text-slate-500 mt-1.5">Available: {formatBDT(balance)}</p>
            </div>

            <div>
              <label className="label">Note (optional)</label>
              <input type="text" className="input-field" placeholder="What's this for?" value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} />
            </div>

            {amountNum > 0 && (
              <div className="card p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Amount</span><span className="font-medium">{formatBDT(amountNum)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Transfer fee</span><span className="font-medium">{formatBDT(fee)}</span></div>
                <div className="border-t border-slate-100 dark:border-navy-700 pt-2 flex justify-between">
                  <span className="font-semibold text-navy-900 dark:text-white">Total</span>
                  <span className="font-bold text-navy-900 dark:text-white">{formatBDT(total)}</span>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
            <button onClick={goReview} className="btn-primary w-full" disabled={!amountNum}>Review Transfer</button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="card p-5 space-y-4">
              <div className="text-center">
                <p className="text-sm text-slate-500">You're sending</p>
                <p className="text-3xl font-bold text-navy-900 dark:text-white mt-1">{formatBDT(amountNum)}</p>
              </div>
              <div className="border-t border-slate-100 dark:border-navy-700 pt-4 space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">To</span><span className="font-medium text-right">{recipient.name}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Phone</span><span className="font-medium">{recipient.phone}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Fee</span><span className="font-medium">{formatBDT(fee)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Total debit</span><span className="font-bold">{formatBDT(total)}</span></div>
                {note && <div className="flex justify-between"><span className="text-slate-500">Note</span><span className="font-medium text-right max-w-[60%]">{note}</span></div>}
              </div>
            </div>
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
            <button onClick={confirmTransfer} className="btn-accent w-full" disabled={loading}>
              {loading ? <LoadingSpinner className="w-5 h-5 mx-auto text-white" /> : 'Confirm & Send'}
            </button>
          </div>
        )}

        {step === 4 && resultTxn && (
          <div className="text-center space-y-6 py-8">
            <div className="inline-flex w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-navy-900 dark:text-white">Transfer Successful</h2>
              <p className="text-sm text-slate-500 mt-1">{formatBDT(resultTxn.amount)} sent to {resultTxn.counterparty}</p>
            </div>
            <div className="card p-4 text-left text-sm space-y-2">
              <div className="flex justify-between"><span className="text-slate-500">Reference</span><span className="font-mono text-xs font-medium">{resultTxn.reference}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Date</span><span className="font-medium">{new Date(resultTxn.date).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Status</span><span className="text-emerald-600 font-medium">Completed</span></div>
            </div>
            <div className="flex gap-3">
              <button onClick={onBack} className="btn-secondary flex-1">Back to Home</button>
              <button onClick={() => onNavigate('txn-detail', { txnId: resultTxn.id, from: 'home' })} className="btn-primary flex-1">View Receipt</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
