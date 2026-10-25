import React, { useState } from 'react';
import { ArrowLeft, CreditCard, Landmark, Eye, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../api';
import { Badge, LoadingSpinner, Modal } from '../components/ui';
import { formatBDT } from '../data/mockData';

const statusVariant = { pending: 'warning', approved: 'success', rejected: 'danger', blocked: 'danger' };
const gradient = {
  visa: 'from-navy-900 to-blue-800',
  mastercard: 'from-slate-800 to-orange-700',
};

function CardFace({ card, revealed }) {
  const ready = card.status === 'approved' || card.status === 'blocked';
  return (
    <div className={`relative rounded-2xl p-5 text-white bg-gradient-to-br ${gradient[card.network]} shadow-elevated ${card.status === 'blocked' ? 'opacity-60' : ''}`}>
      <div className="flex justify-between items-start">
        <span className="text-xs uppercase tracking-widest opacity-80">{card.cardType} card</span>
        <span className="font-bold italic text-lg capitalize">{card.network === 'visa' ? 'VISA' : 'Mastercard'}</span>
      </div>
      <p className="font-mono text-lg tracking-widest mt-8">
        {ready ? revealed || card.numberMasked : '•••• •••• •••• ••••'}
      </p>
      <div className="flex justify-between items-end mt-4 text-xs">
        <div>
          <p className="opacity-60">CARD HOLDER</p>
          <p className="font-medium">{card.holder}</p>
        </div>
        <div className="text-right">
          <p className="opacity-60">EXPIRES</p>
          <p className="font-medium">{card.expiry || '--/--'}</p>
        </div>
      </div>
      {card.status === 'pending' && (
        <div className="absolute inset-0 rounded-2xl bg-navy-950/60 flex items-center justify-center gap-2 text-sm font-medium">
          <Clock className="w-4 h-4" /> Waiting for approval
        </div>
      )}
    </div>
  );
}

export default function Cards({ onBack }) {
  const { accounts, cards, refreshProfile } = useApp();
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showApply, setShowApply] = useState(false);
  const [form, setForm] = useState({ network: 'visa', cardType: 'debit' });
  const [revealed, setRevealed] = useState({});

  const account = accounts.find((a) => a.status === 'approved');
  const pendingAccount = accounts.find((a) => a.status === 'pending');
  const rejectedAccount = !account && !pendingAccount && accounts.find((a) => a.status === 'rejected');

  const run = async (fn) => {
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const res = await fn();
      setMsg(res.message || 'Done');
      await refreshProfile();
      setShowApply(false);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  const applyAccount = (accountType) =>
    run(() => api('/accounts/apply', { method: 'POST', body: { accountType } }));
  const applyCard = () => run(() => api('/cards/apply', { method: 'POST', body: form }));

  const reveal = async (id) => {
    try {
      const { number } = await api(`/cards/${id}/reveal`);
      setRevealed((r) => ({ ...r, [id]: number }));
      setTimeout(() => setRevealed((r) => { const n = { ...r }; delete n[id]; return n; }), 15000);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="pb-28 page-enter">
      <div className="px-5 pt-6 pb-4 flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-slate-100 dark:hover:bg-navy-800">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-navy-900 dark:text-white">Account & Cards</h1>
      </div>

      <div className="px-5 space-y-6">
        {msg && <p className="text-sm text-emerald-700 dark:text-emerald-400">{msg}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* Bank account */}
        <section className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-navy-100 dark:bg-navy-800 flex items-center justify-center">
              <Landmark className="w-5 h-5 text-navy-700 dark:text-slate-300" />
            </div>
            <h2 className="font-semibold text-navy-900 dark:text-white">Bank account</h2>
          </div>
          {account && (
            <div className="text-sm space-y-1">
              <p className="font-mono text-navy-900 dark:text-white">{account.accountNumber}</p>
              <p className="text-slate-500 capitalize">{account.accountType} account · {formatBDT(account.balance)}</p>
            </div>
          )}
          {pendingAccount && (
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="warning">pending</Badge>
              <span className="text-slate-500">Your {pendingAccount.accountType} account application is under review.</span>
            </div>
          )}
          {!account && !pendingAccount && (
            <div className="space-y-3">
              {rejectedAccount && (
                <p className="text-sm text-red-600">
                  Your last application was not approved{rejectedAccount.reason ? `: ${rejectedAccount.reason}` : '.'}
                </p>
              )}
              <p className="text-sm text-slate-500">Open a bank account to get an account number and apply for cards.</p>
              <div className="flex gap-3">
                <button disabled={busy} onClick={() => applyAccount('savings')} className="btn-accent flex-1">Savings</button>
                <button disabled={busy} onClick={() => applyAccount('current')} className="btn-secondary flex-1">Current</button>
              </div>
            </div>
          )}
        </section>

        {/* Cards */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-navy-900 dark:text-white">Your cards</h2>
            {account && (
              <button onClick={() => setShowApply(true)} className="text-sm font-medium text-emerald-600">+ Apply for card</button>
            )}
          </div>
          {!account && <p className="text-sm text-slate-500">Cards unlock after your bank account is approved.</p>}
          {account && cards.length === 0 && <p className="text-sm text-slate-500">No cards yet.</p>}
          {cards.map((c) => (
            <div key={c.id} className="space-y-2">
              <CardFace card={c} revealed={revealed[c.id]} />
              <div className="flex items-center justify-between text-xs px-1">
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant[c.status]}>{c.status}</Badge>
                  {c.cardType === 'credit' && c.status === 'approved' && (
                    <span className="text-slate-500">Limit {formatBDT(c.creditLimit)}</span>
                  )}
                  {c.reason && <span className="text-slate-400">{c.reason}</span>}
                </div>
                {c.status === 'approved' && !revealed[c.id] && (
                  <button onClick={() => reveal(c.id)} className="flex items-center gap-1 text-slate-500">
                    <Eye className="w-4 h-4" /> Show number
                  </button>
                )}
              </div>
            </div>
          ))}
        </section>

        <p className="text-[11px] text-slate-400 text-center">
          Demo cards use generated test numbers. They cannot be used for real payments.
        </p>
      </div>

      <Modal open={showApply} onClose={() => setShowApply(false)} title="Apply for a card" size="sm">
        <div className="space-y-4">
          <div>
            <p className="label">Network</p>
            <div className="grid grid-cols-2 gap-2">
              {['visa', 'mastercard'].map((n) => (
                <button key={n} onClick={() => setForm({ ...form, network: n })}
                  className={`py-3 rounded-xl border text-sm font-medium capitalize ${form.network === n ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' : 'border-slate-200 dark:border-navy-700'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="label">Type</p>
            <div className="grid grid-cols-2 gap-2">
              {['debit', 'credit'].map((t) => (
                <button key={t} onClick={() => setForm({ ...form, cardType: t })}
                  className={`py-3 rounded-xl border text-sm font-medium capitalize ${form.cardType === t ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' : 'border-slate-200 dark:border-navy-700'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <button disabled={busy} onClick={applyCard} className="btn-primary w-full">
            {busy ? <LoadingSpinner className="w-5 h-5 mx-auto" /> : 'Submit application'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
