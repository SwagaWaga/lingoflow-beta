import { useState, useEffect, useCallback } from 'react';
import Reader from './components/game/reader';
import Auth from './components/Auth';
import Admin from './pages/Admin';
import Dictionary from './pages/Dictionary';
import Dojo from './pages/Dojo';
import FloatingWords from './components/FloatingWords';
import { supabase } from './lib/supabaseClient';

function App() {
  const [session, setSession] = useState(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [currentView, setCurrentView] = useState('game');
  const [dailyStreak, setDailyStreak] = useState(0);
  const [isDark, setIsDark] = useState(() => {
    // Persist dark mode preference across sessions
    return localStorage.getItem('lf-dark') === 'true';
  });

  // Apply / remove dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('lf-dark', isDark);
  }, [isDark]);

  const toggleDark = useCallback(() => setIsDark(prev => !prev), []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsCheckingSession(false);
      if (session?.user?.id) {
        supabase.from('profiles').select('current_streak').eq('id', session.user.id).single()
          .then(({ data }) => { if (data) setDailyStreak(data.current_streak || 0); });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.id) {
        supabase.from('profiles').select('current_streak').eq('id', session.user.id).single()
          .then(({ data }) => { if (data) setDailyStreak(data.current_streak || 0); });
      } else {
        setDailyStreak(0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogOut = async () => {
    await supabase.auth.signOut();
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center transition-colors duration-300">
        <div className="animate-pulse text-blue-600 dark:text-blue-400 font-bold text-xl">Loading LingoFlow...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex flex-col items-center relative overflow-hidden transition-colors duration-300">
      <FloatingWords />

      {!session ? (
        <div className="w-full flex-1 flex flex-col items-center justify-center p-4 relative z-10">
          <Auth />
        </div>
      ) : (
        <div className="w-full flex flex-col items-center relative z-10">

          {/* Premium Navbar */}
          <header className="w-full sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-100 dark:border-slate-700/60 shadow-sm transition-colors duration-300">
            <div className="max-w-6xl mx-auto flex justify-between items-center px-8 py-4">
              <div className="flex items-center space-x-8">
                <h1 className="text-2xl font-black tracking-tight">
                  <span className="text-blue-600">Lingo</span>
                  <span className="text-slate-800 dark:text-white">Flow</span>
                </h1>
                <nav className="hidden md:flex items-center space-x-1">
                  {[
                    { key: 'game', label: '📖 Play' },
                    { key: 'dictionary', label: '📚 Vault' },
                    { key: 'dojo', label: '🥋 Dojo' },
                    ...(session?.user?.email === 'abdutigr@gmail.com' ? [{ key: 'admin', label: '🔧 Admin' }] : []),
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setCurrentView(key)}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${currentView === key
                        ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
              </div>

              <div className="flex items-center space-x-3">
                {/* Streak Badge */}
                <div className="flex items-center bg-gradient-to-r from-orange-400 to-red-500 text-white font-bold px-4 py-1.5 rounded-full shadow-md shadow-orange-400/30 text-sm">
                  <span className="mr-1.5">🔥</span>
                  <span>{dailyStreak} Day Streak</span>
                </div>

                {/* Dark Mode Toggle */}
                <button
                  onClick={toggleDark}
                  title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all duration-200 text-lg"
                >
                  {isDark ? '☀️' : '🌙'}
                </button>

                <span className="hidden sm:block text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 truncate max-w-[160px]">
                  {session.user.email}
                </span>
                <button
                  onClick={handleLogOut}
                  className="text-sm font-bold text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg border border-transparent hover:border-red-100 dark:hover:border-red-900/40 transition-all duration-200"
                >
                  Log Out
                </button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="w-full max-w-6xl mx-auto px-6 py-8">

            {currentView === 'game' && (
              <>
                {/* Hero Section */}
                <div className="relative w-full bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-800 dark:via-slate-800 dark:to-slate-800 rounded-3xl p-8 mb-8 border border-indigo-100 dark:border-slate-700 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 z-10">
                  <div>
                    <p className="text-blue-500 dark:text-blue-400 font-bold text-sm uppercase tracking-widest mb-1">Welcome back 👋</p>
                    <h2 className="text-4xl font-black text-slate-800 dark:text-white tracking-tight leading-tight mb-2">
                      Ready to expand your vocabulary?
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-lg max-w-lg">
                      Select a subject below, read an article, and collect new words to train in the Dojo.
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-center bg-white/80 dark:bg-slate-700/60 backdrop-blur-sm border border-white dark:border-slate-600 rounded-2xl px-8 py-5 shadow-sm">
                    <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-blue-500 to-indigo-600">{dailyStreak}</span>
                    <span className="text-slate-500 dark:text-slate-400 font-bold text-sm uppercase tracking-wider mt-1">Day Streak</span>
                  </div>
                </div>

                {/* Reading Session Card */}
                <div className="relative w-full bg-white dark:bg-slate-800 rounded-3xl shadow-lg border border-slate-200/80 dark:border-slate-700 overflow-hidden z-10 transition-colors duration-300">
                  <Reader session={session} />
                </div>
              </>
            )}

            {currentView === 'admin' && <Admin />}
            {currentView === 'dictionary' && <Dictionary session={session} />}
            {currentView === 'dojo' && <Dojo session={session} />}

          </main>
        </div>
      )}
    </div>
  );
}

export default App;