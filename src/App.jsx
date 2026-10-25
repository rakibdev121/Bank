import React, { useState, useCallback } from 'react';
import { useApp } from './context/AppContext';
import Splash from './pages/Splash';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import SendMoney from './pages/SendMoney';
import Activity from './pages/Activity';
import TxnDetail from './pages/TxnDetail';
import Savings from './pages/Savings';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';
import Admin from './pages/Admin';
import Cards from './pages/Cards';
import BottomNav from './components/BottomNav';

export default function App() {
  const { showSplash, isAuthenticated } = useApp();
  const [screen, setScreen] = useState('home');
  const [params, setParams] = useState({});
  const [showAdmin, setShowAdmin] = useState(false);

  const navigate = useCallback((next, p = {}) => {
    setScreen(next);
    setParams(p);
    window.scrollTo(0, 0);
  }, []);

  // Secret gesture: triple-click logo area or type 'admin' — for demo we expose via URL hash
  React.useEffect(() => {
    const check = () => {
      if (window.location.hash === '#admin') setShowAdmin(true);
    };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);

  if (showSplash) return <Splash />;

  if (showAdmin) {
    return <Admin onBack={() => { setShowAdmin(false); window.location.hash = ''; }} />;
  }

  if (!isAuthenticated) {
    return <Auth onSuccess={() => navigate('home')} />;
  }

  // Full-screen flows without bottom nav
  if (screen === 'send') {
    return (
      <SendMoney
        onBack={() => navigate('home')}
        onNavigate={navigate}
      />
    );
  }
  if (screen === 'txn-detail') {
    return (
      <TxnDetail
        txnId={params.txnId}
        onBack={() => navigate(params.from || 'activity')}
      />
    );
  }
  if (screen === 'notifications') {
    return <Notifications onBack={() => navigate('home')} />;
  }

  // Main tab screens
  const mainScreens = {
    home: <Dashboard onNavigate={navigate} />,
    activity: <Activity onNavigate={navigate} />,
    savings: <Savings />,
    cards: <Cards onBack={() => navigate('home')} />,
    profile: <Profile onNavigate={navigate} />,
  };

  return (
    <div className="min-h-screen max-w-lg mx-auto bg-slate-50 dark:bg-navy-950 relative">
      {/* Desktop sidebar hint */}
      <div className="hidden lg:block fixed left-0 top-0 bottom-0 w-56 bg-navy-900 text-white p-6">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-sm font-bold">N</div>
          <span className="font-semibold">Nirapod</span>
        </div>
        <nav className="space-y-1 text-sm">
          {[
            { id: 'home', label: 'Home' },
            { id: 'activity', label: 'Activity' },
            { id: 'send', label: 'Send Money' },
            { id: 'savings', label: 'Savings' },
            { id: 'cards', label: 'Cards' },
            { id: 'profile', label: 'Profile' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                screen === item.id ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="lg:ml-56">
        {mainScreens[screen] || mainScreens.home}
        <BottomNav active={screen} onNavigate={navigate} />
      </div>
    </div>
  );
}
