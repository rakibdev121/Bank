import React from 'react';
import { ArrowLeft, CheckCircle2, Clock, Copy } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatBDT, formatDate, formatTime } from '../utils/format';
import { Badge } from '../components/ui';

export default function TxnDetail({ txnId, onBack }) {
  const { transactions } = useApp();
  const txn = transactions.find((t) => t.id === txnId);

  if (!txn) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">Transaction not found</p>
        <button onClick={onBack} className="btn-secondary mt-4">Go back</button>
      </div>
    );
  }

  const copyRef = () => {
    navigator.clipboard?.writeText(txn.reference);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-950 page-enter">
      <header className="sticky top-0 z-10 bg-white/95 dark:bg-navy-900/95 backdrop-blur border-b border-slate-100 dark:border-navy-800 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-1 rounded-xl hover:bg-slate-100 dark:hover:bg-navy-800">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-navy-900 dark:text-white">Transaction Receipt</h1>
      </header>

      <div className="px-5 py-6 max-w-lg mx-auto">
        <div className="card p-6 text-center mb-5">
          <div className={`inline-flex w-14 h-14 rounded-full items-center justify-center mb-3 ${
            txn.status === 'completed'
              ? 'bg-emerald-100 dark:bg-emerald-900/30'
              : 'bg-amber-100 dark:bg-amber-900/30'
          }`}>
            {txn.status === 'completed' ? (
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            ) : (
              <Clock className="w-7 h-7 text-amber-600" />
            )}
          </div>
          <p className="text-sm text-slate-500">{txn.type === 'received' ? 'Received' : 'Sent'}</p>
          <p className={`text-3xl font-bold mt-1 ${
            txn.type === 'received' ? 'text-emerald-600' : 'text-navy-900 dark:text-white'
          }`}>
            {txn.type === 'received' ? '+' : '-'}{formatBDT(txn.amount)}
          </p>
          <Badge variant={txn.status === 'completed' ? 'success' : 'warning'} className="mt-2">
            {txn.status === 'completed' ? 'Completed' : 'Pending'}
          </Badge>
        </div>

        <div className="card p-5 space-y-4 text-sm">
          <Row label="Title" value={txn.title} />
          <Row label="Counterparty" value={txn.counterparty} />
          <Row label="Date" value={`${formatDate(txn.date)} · ${formatTime(txn.date)}`} />
          <Row label="Amount" value={formatBDT(txn.amount)} />
          {txn.fee > 0 && <Row label="Fee" value={formatBDT(txn.fee)} />}
          <Row label="Category" value={txn.category} />
          {txn.note && <Row label="Note" value={txn.note} />}
          <div className="flex justify-between items-start pt-2 border-t border-slate-100 dark:border-navy-700">
            <span className="text-slate-500">Reference</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs font-medium text-right">{txn.reference}</span>
              <button onClick={copyRef} className="p-1 text-slate-400 hover:text-emerald-600">
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="font-medium text-navy-900 dark:text-white text-right capitalize">{value}</span>
    </div>
  );
}
