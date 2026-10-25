import React from 'react';

export default function Splash() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-navy-950 text-white">
      <div className="relative">
        <div className="w-24 h-24 rounded-3xl bg-white flex items-center justify-center shadow-lg shadow-brand-500/30">
          <img src="/app-logo-mark.png" alt="nirapod-bank" className="h-16 w-auto" />
        </div>
      </div>
      <h1 className="mt-6 text-2xl font-bold tracking-tight">nirapod-bank</h1>
      <p className="mt-1 text-sm text-slate-400">নিরাপদ ব্যাংকিং</p>
      <div className="mt-10 flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" style={{ animationDelay: '150ms' }} />
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" style={{ animationDelay: '300ms' }} />
      </div>
      <p className="absolute bottom-10 text-xs text-slate-500">Secure digital banking</p>
    </div>
  );
}
