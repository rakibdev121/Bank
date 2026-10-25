import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Minus, ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react';
import { formatBDT, formatCompactBDT } from '../../utils/format';
import { PageHeader, Loading, Modal, Spinner, AmountField, TxnTable, amountWords } from '../ui';

const CHIPS = [{ label: '100 Cr', value: 1e9 }, { label: '500 Cr', value: 5e9 }, { label: '1000 Cr', value: 1e10 }];

export default function Reserve({ call, reloadStats }) {
  const [data, setData] = useState(null);
  const [mode, setMode] = useState('add');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const load = useCallback(async () => { try { setData(await call('/admin/reserve')); } catch (e) { setError(e.message); } }, [call]);
  useEffect(() => { load(); }, [load]);
  const n = parseFloat(amount) || 0;

  const submit = async () => {
    setBusy(true); setError(''); setMsg('');
    try {
      const res = await call('/admin/reserve', { method: 'POST', body: { action: mode, amount: String(amount), note } });
      setMsg(`${mode === 'add' ? 'Reserve increased' : 'Reserve reduced'} by ${formatBDT(n)} · ${res.reference}`);
      setAmount(''); setNote(''); await Promise.all([load(), reloadStats()]);
    } catch (e) { setError(e.message); }
    setConfirm(false); setBusy(false);
  };

  if (!data) return error ? <p className="text-red-400">{error}</p> : <Loading />;
  const tooMuch = mode === 'remove' && n > data.balance;

  return (
    <div className="space-y-6">
      <PageHeader title="Reserve money" subtitle="E-money the bank holds in reserve. Cash deposits are paid out of this reserve into customer wallets.">
        <button onClick={load} className="btn-ghost !p-2.5" aria-label="Refresh"><RefreshCw className="w-4 h-4" /></button>
      </PageHeader>

      <div className="panel p-6 relative overflow-hidden bg-gradient-to-br from-ink-850 to-brand-700/25">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-300">Reserve e-money available</p>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${data.balanced ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/40 bg-red-500/15 text-red-300'}`}>
            {data.balanced ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}{data.balanced ? 'Ledger balanced' : 'Ledger mismatch!'}</span>
        </div>
        <p className="text-4xl font-bold text-white mt-2 break-words">{formatBDT(data.balance)}</p>
        <p className="text-sm text-brand-400 mt-1">{data.balance > 0 ? `${amountWords(data.balance)} taka` : 'Reserve is empty — add reserve to start accepting cash'}</p>
        <div className="grid grid-cols-3 gap-4 mt-6 text-sm">
          {[['With customers', data.circulation], ['Total generated', data.totalGenerated], ['Fees earned', data.fees]].map(([l, v]) => <div key={l}><p className="text-xs text-ink-300">{l}</p><p className="font-semibold text-white">{formatCompactBDT(v)}</p></div>)}
        </div>
      </div>

      <div className="grid xl:grid-cols-5 gap-6">
        <div className="panel p-6 xl:col-span-2 space-y-4 self-start">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-ink-850">
            {[['add', 'Add reserve', Plus], ['remove', 'Remove reserve', Minus]].map(([id, label, Icon]) => (
              <button key={id} onClick={() => { setMode(id); setError(''); setMsg(''); }} className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium ${mode === id ? 'bg-brand-500 text-white' : 'text-ink-300 hover:text-white'}`}><Icon className="w-4 h-4" />{label}</button>
            ))}
          </div>
          <AmountField label="Amount" value={amount} onChange={setAmount} chips={mode === 'add' ? CHIPS : []} />
          <div><label className="lbl">Note (optional)</label><input className="field" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Treasury top-up" /></div>
          {tooMuch && <p className="text-sm text-red-400">Reserve only has {formatBDT(data.balance)}.</p>}
          {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
          {msg && <p className="text-sm text-emerald-300">{msg}</p>}
          <button className="btn-brand w-full" disabled={!n || tooMuch || busy} onClick={() => setConfirm(true)}>{mode === 'add' ? 'Add to reserve' : 'Remove from reserve'}</button>
        </div>
        <div className="panel overflow-hidden xl:col-span-3">
          <div className="px-5 py-4"><h2 className="font-semibold text-white">Reserve history</h2></div>
          <TxnTable rows={data.history} />
        </div>
      </div>

      <Modal open={confirm} onClose={() => setConfirm(false)} title={mode === 'add' ? 'Add to reserve?' : 'Remove from reserve?'}>
        <p className="text-sm text-ink-300 mb-5">{mode === 'add' ? `${formatBDT(n)} (${amountWords(n)} taka) of new e-money will be generated into the reserve.` : `${formatBDT(n)} will be removed from the reserve.`} This is logged in the audit trail.</p>
        <div className="flex gap-2"><button className="btn-ghost flex-1" onClick={() => setConfirm(false)}>Cancel</button><button className="btn-brand flex-1" disabled={busy} onClick={submit}>{busy ? <Spinner className="w-4 h-4 !text-white" /> : 'Confirm'}</button></div>
      </Modal>
    </div>
  );
}
