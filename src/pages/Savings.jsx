import React, { useState } from 'react';
import { Plus, Target, Calendar } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatBDT } from '../data/mockData';
import { Modal, DemoBanner, EmptyState } from '../components/ui';

export default function Savings() {
  const { savings, createSavingsGoal, contributeToSavings, balance } = useApp();
  const [showCreate, setShowCreate] = useState(false);
  const [showContribute, setShowContribute] = useState(null);
  const [form, setForm] = useState({ name: '', target: '', deadline: '' });
  const [contribAmount, setContribAmount] = useState('');
  const [error, setError] = useState('');

  const handleCreate = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.target || parseFloat(form.target) <= 0) {
      setError('Enter a valid goal name and target amount');
      return;
    }
    createSavingsGoal({
      name: form.name.trim(),
      target: parseFloat(form.target),
      deadline: form.deadline || '2027-12-31',
    });
    setForm({ name: '', target: '', deadline: '' });
    setShowCreate(false);
    setError('');
  };

  const handleContribute = () => {
    const amt = parseFloat(contribAmount);
    if (!amt || amt <= 0) {
      setError('Enter a valid amount');
      return;
    }
    const res = contributeToSavings(showContribute, amt);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setShowContribute(null);
    setContribAmount('');
    setError('');
  };

  return (
    <div className="pb-24 page-enter">
      <DemoBanner />
      <header className="px-5 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy-900 dark:text-white">Savings</h1>
          <p className="text-sm text-slate-500">Simulated goals only</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-card"
        >
          <Plus className="w-5 h-5" />
        </button>
      </header>

      <div className="px-5 space-y-4">
        {savings.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No savings goals"
            description="Create a goal to start saving with virtual money."
            action={
              <button onClick={() => setShowCreate(true)} className="btn-accent">
                Create Goal
              </button>
            }
          />
        ) : (
          savings.map((goal) => {
            const pct = Math.min(100, Math.round((goal.saved / goal.target) * 100));
            return (
              <div key={goal.id} className="card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-navy-900 dark:text-white">{goal.name}</h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3" />
                      Target: {new Date(goal.deadline).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-emerald-600">{pct}%</span>
                </div>
                <div className="h-2.5 bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-sm mb-4">
                  <span className="text-slate-500">
                    Saved <span className="font-semibold text-navy-900 dark:text-white">{formatBDT(goal.saved)}</span>
                  </span>
                  <span className="text-slate-500">
                    of <span className="font-semibold text-navy-900 dark:text-white">{formatBDT(goal.target)}</span>
                  </span>
                </div>
                <button
                  onClick={() => { setShowContribute(goal.id); setError(''); }}
                  className="btn-secondary w-full text-sm py-2.5"
                  disabled={goal.saved >= goal.target}
                >
                  {goal.saved >= goal.target ? 'Goal Reached 🎉' : 'Add Money'}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Savings Goal">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Goal Name</label>
            <input
              className="input-field"
              placeholder="e.g. Emergency Fund"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Target Amount (৳)</label>
            <input
              type="number"
              className="input-field"
              placeholder="100000"
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Deadline</label>
            <input
              type="date"
              className="input-field"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-xs text-amber-600">All savings are simulated virtual money.</p>
          <button type="submit" className="btn-primary w-full">Create Goal</button>
        </form>
      </Modal>

      {/* Contribute Modal */}
      <Modal
        open={!!showContribute}
        onClose={() => setShowContribute(null)}
        title="Contribute to Goal"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Available balance: {formatBDT(balance)}</p>
          <div>
            <label className="label">Amount (৳)</label>
            <input
              type="number"
              className="input-field"
              placeholder="1000"
              value={contribAmount}
              onChange={(e) => setContribAmount(e.target.value)}
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button onClick={handleContribute} className="btn-accent w-full">
            Add to Savings
          </button>
        </div>
      </Modal>
    </div>
  );
}
