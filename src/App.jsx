import { useState, useEffect, useCallback } from 'react';
import Reader from './components/game/reader';
import Auth from './components/Auth';
import Admin from './pages/Admin';
import Dictionary from './pages/Dictionary';
import Dojo from './pages/Dojo';
import FloatingWords from './components/FloatingWords';
import { supabase } from './lib/supabaseClient';
import { useAccent } from './context/AccentContext';

const NAV_ITEMS = [
  { key: 'game', label: '📖 Play' },
  { key: 'dictionary', label: '📚 Vault' },
  { key: 'dojo', label: '🥋 Dojo' },
];

function App() {
  const [session, setSession] = useState(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [currentView, setCurrentView] = useState('game');
  const [dailyStreak, setDailyStreak] = useState(0);
  const [isDark, setIsDark] = useState(() => localStorage.getItem('lf-dark') === 'true');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { preferredAccent, setPreferredAccent } = useAccent();

  useEffect(() => {
    const root = document.documentElement;
    isDark ? root.classList.add('dark') : root.classList.remove('dark');
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

  const handleNavClick = (key) => {
    setCurrentView(key);
    setMobileMenuOpen(false);
  };

  const isAdmin = session?.user?.email === 'abdutigr@gmail.com';
  const navItems = [...NAV_ITEMS, ...(isAdmin ? [{ key: 'admin', label: '🔧 Admin' }] : [])];

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

          {/* ── Navbar ── */}
          <header className="w-full sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-100 dark:border-slate-700/60 shadow-sm transition-colors duration-300">
            <div className="max-w-6xl mx-auto flex justify-between items-center px-4 md:px-8 py-3 md:py-4">

              {/* Left: logo + desktop nav */}
              <div className="flex items-center space-x-4 md:space-x-8">
                <div className="flex items-center space-x-2 md:space-x-3">
                  <img src="/logo.png" alt="LingoFlow Globe Logo" className="w-8 h-8 md:w-10 md:h-10 object-contain drop-shadow-md" />
                  <h1 className="text-xl md:text-2xl font-black tracking-tight">
                    <span className="text-brand-teal">Lingo</span>
                    <span className="text-slate-800 dark:text-white">Flow</span>
                  </h1>
                </div>
                {/* Desktop nav */}
                <nav className="hidden md:flex items-center space-x-1">
                  {navItems.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => handleNavClick(key)}
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

              {/* Right: streak + dark toggle + email + logout + hamburger */}
              <div className="flex items-center space-x-2 md:space-x-3">
                {/* Streak Badge */}
                <div className="flex items-center bg-gradient-to-r from-orange-400 to-red-500 text-white font-bold px-2.5 md:px-4 py-1 md:py-1.5 rounded-full shadow-md shadow-orange-400/30 text-xs md:text-sm">
                  <span className="mr-1">🔥</span>
                  <span className="hidden sm:inline">{dailyStreak} Day Streak</span>
                  <span className="sm:hidden">{dailyStreak}</span>
                </div>

                {/* Accent Selection */}
                <div className="hidden sm:flex items-center space-x-2">
                  <select
                    value={preferredAccent}
                    onChange={(e) => setPreferredAccent(e.target.value)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-full text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer outline-none"
                    title="Pronunciation Accent"
                  >
                    <option value="US">US</option>
                    <option value="UK">UK</option>
                    <option value="AU">AU</option>
                  </select>
                </div>

                {/* Dark Mode Toggle */}
                <button
                  onClick={toggleDark}
                  title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all duration-200 text-base md:text-lg"
                >
                  {isDark ? '☀️' : '🌙'}
                </button>

                {/* Email pill — hidden on mobile */}
                <span className="hidden lg:block text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 truncate max-w-[160px]">
                  {session.user.email}
                </span>

                {/* Log Out — hidden on mobile (available in hamburger) */}
                <button
                  onClick={handleLogOut}
                  className="hidden md:block text-sm font-bold text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg border border-transparent hover:border-red-100 dark:hover:border-red-900/40 transition-all duration-200"
                >
                  Log Out
                </button>

                {/* Hamburger — mobile only */}
                <button
                  onClick={() => setMobileMenuOpen(o => !o)}
                  className="md:hidden w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                  aria-label="Toggle menu"
                >
                  <span className={`block w-4.5 h-0.5 bg-slate-600 dark:bg-slate-300 rounded transition-all duration-200 ${mobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
                  <span className={`block w-4.5 h-0.5 bg-slate-600 dark:bg-slate-300 rounded transition-all duration-200 ${mobileMenuOpen ? 'opacity-0' : ''}`} />
                  <span className={`block w-4.5 h-0.5 bg-slate-600 dark:bg-slate-300 rounded transition-all duration-200 ${mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
                </button>
              </div>
            </div>

            {/* Mobile Dropdown Menu */}
            {mobileMenuOpen && (
              <div className="md:hidden absolute top-full left-0 right-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 p-4 shadow-xl flex flex-col gap-2 z-50 transition-all">
                {navItems.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => handleNavClick(key)}
                    className={`w-full text-left px-4 py-4 rounded-xl text-lg font-bold transition-all ${currentView === key
                      ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                  >
                    {label}
                  </button>
                ))}

                {/* Mobile Accent Selector */}
                <div className="w-full mt-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-center justify-between border border-slate-100 dark:border-slate-700/50">
                  <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pronunciation Voice</span>
                  <select
                    value={preferredAccent}
                    onChange={(e) => setPreferredAccent(e.target.value)}
                    className="bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="US">US English</option>
                    <option value="UK">UK English</option>
                    <option value="AU">AU English</option>
                  </select>
                </div>

                <div className="mt-2 pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{session.user.email}</span>
                  <button
                    onClick={() => {
                      handleLogOut();
                      setMobileMenuOpen(false);
                    }}
                    className="text-lg font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-2 rounded-xl transition-all"
                  >
                    Log Out
                  </button>
                </div>
              </div>
            )}
          </header>

          {/* ── Main Content ── */}
          <main className="w-full max-w-6xl mx-auto px-4 md:px-6 py-5 md:py-8">

            {currentView === 'game' && (
              <>
                {/* Hero Section */}
                <div className="relative w-full bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-800 dark:via-slate-800 dark:to-slate-800 rounded-2xl md:rounded-3xl p-5 md:p-8 mb-5 md:mb-8 border border-indigo-100 dark:border-slate-700 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6 z-10">
                  <div className="flex-1 min-w-0">
                    <p className="text-blue-500 dark:text-blue-400 font-bold text-xs md:text-sm uppercase tracking-widest mb-1">Welcome back 👋</p>
                    <h2 className="text-2xl md:text-4xl font-black text-slate-800 dark:text-white tracking-tight leading-tight mb-1 md:mb-2">
                      Ready to expand your vocabulary?
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm md:text-lg max-w-lg">
                      Select a subject, read an article, and collect words to train in the Dojo.
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex flex-row md:flex-col items-center gap-2 md:gap-0 bg-white/80 dark:bg-slate-700/60 backdrop-blur-sm border border-white dark:border-slate-600 rounded-xl md:rounded-2xl px-5 md:px-8 py-3 md:py-5 shadow-sm">
                    <span className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-blue-500 to-indigo-600">{dailyStreak}</span>
                    <span className="text-slate-500 dark:text-slate-400 font-bold text-xs md:text-sm uppercase tracking-wider md:mt-1">Day Streak</span>
                  </div>
                </div>

                {/* Reading Session Card */}
                <div className="relative w-full bg-white dark:bg-slate-800 rounded-2xl md:rounded-3xl shadow-lg border border-slate-200/80 dark:border-slate-700 overflow-hidden z-10 transition-colors duration-300">
                  <Reader session={session} />
                </div>
              </>
            )}

            {currentView === 'admin' && <Admin />}
            {currentView === 'dictionary' && <Dictionary session={session} dailyStreak={dailyStreak} />}
            {currentView === 'dojo' && <Dojo session={session} />}

          </main>
        </div>
      )}
    </div>
  );
}

export default App;