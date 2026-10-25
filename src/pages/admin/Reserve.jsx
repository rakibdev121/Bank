import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Minus, RefreshCw } from 'lucide-react';
import { formatBDT } from '../../utils/format';
import { ConfirmDialog, LoadingSpinner } from '../../components/ui';
import { PageHeader, AmountField, TxnRow, amountWords } from './shared';
import { ReserveHero } from './Overview';

const CHIPS = [
  { label: '100 Cr', value: 1e9 },
  { label: '500 Cr', value: 5e9 },
  { label: '1000 Cr', value: 1e10 },
];

export default function Reserve({ call, reloadStats, go }) {
  const [data, setData] = useState(null);
  const [mode, setMode] = useState('add');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const load = useCallback(async () => {
    try { setData(await call('/admin/reserve')); } catch (e) { setError(e.message); }
  }, [call]);
  useEffect(() => { load(); }, [load]);

  const n = parseFloat(amount) || 0;

  const submit = async () => {
    setBusy(true); setError(''); setMsg('');
    try {
      const res = await call('/admin/reserve', { method: 'POST', body: { action: mode, amount: String(amount), note } });
      setMsg(`${mode === 'add' ? 'Reserve increased' : 'Reserve reduced'} by ${formatBDT(n)} · ${res.reference}`);
      setAmount(''); setNote('');
      await Promise.all([load(), reloadStats()]);
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  if (!data) return <div className="py-20 flex justify-center"><LoadingSpinner /></div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reserve money"
        subtitle="E-money the bank holds in reserve. Cash deposits are paid out of this reserve into customer wallets."
        action={<button onClick={load} className="p-2 rounded-xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700" aria-label="Refresh"><RefreshCw className="w-4 h-4 text-slate-500" /></button>}
      />
      <ReserveHero r={data} onAdd={() => setMode('add')} onCash={() => go('cash')} />

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="card p-5 lg:col-span-3 space-y-5">
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-navy-800">
            {[['add', 'Generate / add', Plus], ['remove', 'Remove', Minus]].map(([id, label, Icon]) => (
              <button key={id} onClick={() => { setMode(id); setError(''); setMsg(''); }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${mode === id ? 'bg-white dark:bg-navy-700 shadow-card text-navy-900 dark:text-white' : 'text-slate-500'}`}>
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>

          <AmountField label={mode === 'add' ? 'Amount to add to reserve' : 'Amount to remove from reserve'} value={amount} onChange={setAmount} chips={mode === 'add' ? CHIPS : []} />
          <div>
            <label className="label">Note (optional)</label>
            <input className="input-field" maxLength={120} placeholder="e.g. Initial capital, Q4 top-up" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {mode === 'remove' && n > data.balance && <p className="text-sm text-red-600">You can remove at most {formatBDT(data.balance)} — customer money is never touched.</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {msg && <p className="text-sm text-emerald-700 dark:text-emerald-400">{msg}</p>}

          <button disabled={!n || busy || (mode === 'remove' && n > data.balance)} onClick={() => setConfirm(true)}
            className={mode === 'add' ? 'btn-accent w-full' : 'w-full font-medium rounded-xl px-5 py-3 bg-red-600 text-white hover:bg-red-500 disabled:opacity-50'}>
            {busy ? <LoadingSpinner className="w-5 h-5 mx-auto text-white" /> : mode === 'add' ? 'Add to reserve' : 'Remove from reserve'}
          </button>
        </div>

        <div className="card lg:col-span-2 p-5 space-y-3 text-sm self-start">
          <h3 className="font-semibold text-navy-900 dark:text-white">Where the money is</h3>
          {[
            ['Reserve (unissued)', data.balance],
            ['Customer wallets', data.wallets],
            ['Savings goals', data.savings],
            ['Fees earned', data.fees],
          ].map(([l, v]) => (
            <div key={l} className="flex justify-between gap-3"><span className="text-slate-500">{l}</span><span className="font-medium text-navy-900 dark:text-white">{formatBDT(v)}</span></div>
          ))}
          <div className="border-t border-slate-100 dark:border-navy-700 pt-3 flex justify-between gap-3">
            <span className="font-semibold text-navy-900 dark:text-white">Total generated</span>
            <span className="font-bold text-navy-900 dark:text-white">{formatBDT(data.totalGenerated)}</span>
          </div>
          <div className="flex justify-between gap-3 text-xs text-slate-400"><span>Cash received (lifetime)</span><span>{formatBDT(data.totalCashIn)}</span></div>
          <div className="flex justify-between gap-3 text-xs text-slate-400"><span>Cash paid out (lifetime)</span><span>{formatBDT(data.totalCashOut)}</span></div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 pt-4 pb-2"><h3 className="font-semibold text-navy-900 dark:text-white">Reserve history</h3></div>
        <div className="divide-y divide-slate-100 dark:divide-navy-800">
          {data.history.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-400">No reserve operations yet — add your first reserve above.</p>}
          {data.history.map((t) => <TxnRow key={t.id} t={t} />)}
        </div>
      </div>

      <ConfirmDialog
        open={confirm} onClose={() => setConfirm(false)} onConfirm={submit}
        danger={mode === 'remove'} confirmLabel={mode === 'add' ? 'Add reserve' : 'Remove'}
        title={mode === 'add' ? 'Add to reserve?' : 'Remove from reserve?'}
        message={`${mode === 'add' ? 'Add' : 'Remove'} ${formatBDT(n)} (${amountWords(n)} taka) ${mode === 'add' ? 'to' : 'from'} the reserve. This is recorded in the ledger and audit log.`}
      />
    </div>
  );
}
