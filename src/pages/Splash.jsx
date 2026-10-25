import React from 'react';
import { Shield } from 'lucide-react';

export default function Splash() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-navy-950 text-white">
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/30">
          <Shield className="w-10 h-10 text-white" strokeWidth={1.8} />
        </div>
        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-400 border-2 border-navy-950" />
      </div>
      <h1 className="mt-6 text-2xl font-bold tracking-tight">Nirapod Bank</h1>
      <p className="mt-1 text-sm text-slate-400">নিরাপদ ব্যাংকিং</p>
      <div className="mt-10 flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" style={{ animationDelay: '150ms' }} />
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" style={{ animationDelay: '300ms' }} />
      </div>
      <p className="absolute bottom-10 text-xs text-slate-500">Demo • Learning Prototype</p>
    </div>
  );
}
