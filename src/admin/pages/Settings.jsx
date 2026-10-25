import React from 'react';
import { LogOut, ExternalLink } from 'lucide-react';
import { PageHeader, Avatar } from '../ui';

export default function Settings({ me, onLogout }) {
  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" subtitle="Your admin session" />
      <div className="panel p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Avatar name={me?.name || 'Admin'} size={56} />
          <div><p className="text-lg font-semibold text-white">{me?.name || 'Admin'}</p><p className="text-sm text-ink-300">{me?.email}</p><p className="text-xs text-brand-400 mt-0.5">Administrator</p></div>
        </div>
        <dl className="grid grid-cols-2 gap-4 text-sm border-t border-ink-700/70 pt-5">
          <div><dt className="text-ink-400">Phone</dt><dd className="text-white">{me?.phone || '—'}</dd></div>
          <div><dt className="text-ink-400">Session</dt><dd className="text-white">Expires when this tab closes</dd></div>
        </dl>
        <div className="flex flex-wrap gap-3 border-t border-ink-700/70 pt-5">
          <a href="/" className="btn-ghost"><ExternalLink className="w-4 h-4" />Customer app</a>
          <button onClick={onLogout} className="btn-danger"><LogOut className="w-4 h-4" />Log out</button>
        </div>
      </div>
    </div>
  );
}
