import React from 'react';
import { ArrowLeft, Bell, Shield, Info, CheckCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatDate, formatTime } from '../utils/format';
import { EmptyState } from '../components/ui';

const iconMap = {
  transaction: Bell,
  security: Shield,
  system: Info,
};

export default function Notifications({ onBack }) {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useApp();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-950 page-enter">
      <header className="sticky top-0 z-10 bg-white/95 dark:bg-navy-900/95 backdrop-blur border-b border-slate-100 dark:border-navy-800 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-1 rounded-xl hover:bg-slate-100 dark:hover:bg-navy-800">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-navy-900 dark:text-white flex-1">Notifications</h1>
        {unread > 0 && (
          <button
            onClick={markAllNotificationsRead}
            className="text-xs font-medium text-emerald-600 flex items-center gap-1"
          >
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        )}
      </header>

      <div className="px-5 py-4">
        {notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications"
            description="You're all caught up. Alerts will appear here."
          />
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => {
              const Icon = iconMap[n.type] || Bell;
              return (
                <button
                  key={n.id}
                  onClick={() => markNotificationRead(n.id)}
                  className={`w-full card p-4 flex gap-3 text-left transition-colors ${
                    !n.read ? 'border-l-4 border-l-emerald-500' : ''
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    n.type === 'security'
                      ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30'
                      : 'bg-slate-100 text-slate-600 dark:bg-navy-700'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm ${!n.read ? 'font-semibold' : 'font-medium'} text-navy-900 dark:text-white`}>
                        {n.title}
                      </p>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1.5" />}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {formatDate(n.time)} · {formatTime(n.time)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
