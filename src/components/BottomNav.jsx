import React from 'react';
import { Home, Activity, Send, PiggyBank, User } from 'lucide-react';

const tabs = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'send', label: 'Send', icon: Send, primary: true },
  { id: 'savings', label: 'Savings', icon: PiggyBank },
  { id: 'profile', label: 'Profile', icon: User },
];

export default function BottomNav({ active, onNavigate }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-navy-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-navy-800 safe-area-pb">
      <div className="max-w-lg mx-auto flex items-center justify-around px-2 py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          if (tab.primary) {
            return (
              <button
                key={tab.id}
                onClick={() => onNavigate(tab.id)}
                className="flex flex-col items-center -mt-5"
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-elevated transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white scale-105'
                    : 'bg-navy-900 text-white hover:bg-navy-800 dark:bg-emerald-600'
                }`}>
                  <Icon className="w-6 h-6" strokeWidth={2.2} />
                </div>
                <span className={`text-[10px] mt-1 font-medium ${isActive ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {tab.label}
                </span>
              </button>
            );
          }
          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${
                isActive ? 'text-navy-900 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2]' : ''}`} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
