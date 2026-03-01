import { useState, useEffect } from 'react';
import Reader from './components/game/reader';
import Auth from './components/Auth';
import Admin from './pages/Admin';
import Dictionary from './pages/Dictionary';
import Dojo from './pages/Dojo';
import { supabase } from './lib/supabaseClient';

function App() {
  const [session, setSession] = useState(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [currentView, setCurrentView] = useState('game');
  const [dailyStreak, setDailyStreak] = useState(0);

  // Original state for articles testing
  const [articles, setArticles] = useState([]);
  const [isLoadingArticles, setIsLoadingArticles] = useState(false);
  const [errorArticles, setErrorArticles] = useState(null);

  useEffect(() => {
    // 1. Initial Session Check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsCheckingSession(false);

      if (session?.user?.id) {
        supabase.from('profiles').select('current_streak').eq('id', session.user.id).single()
          .then(({ data }) => {
            if (data) setDailyStreak(data.current_streak || 0);
          });
      }
    });

    // 2. Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.id) {
        supabase.from('profiles').select('current_streak').eq('id', session.user.id).single()
          .then(({ data }) => {
            if (data) setDailyStreak(data.current_streak || 0);
          });
      } else {
        setDailyStreak(0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch articles ONLY if we have a session
  useEffect(() => {
    async function fetchArticles() {
      if (!session) return;

      try {
        setIsLoadingArticles(true);
        const { data, error } = await supabase.from('articles').select('*');

        if (error) {
          throw error;
        }

        setArticles(data);
      } catch (err) {
        console.error('Error fetching articles:', err);
        setErrorArticles(err.message);
      } finally {
        setIsLoadingArticles(false);
      }
    }

    fetchArticles();
  }, [session]);

  const handleLogOut = async () => {
    await supabase.auth.signOut();
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-blue-600 font-bold text-xl">Loading LingoFlow...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center">

      {!session ? (
        // Unauthenticated View
        <div className="w-full flex-1 flex flex-col items-center justify-center p-4">
          <Auth />
        </div>
      ) : (
        // Authenticated View
        <div className="w-full flex flex-col items-center p-8">

          <header className="w-full max-w-4xl flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-8">
            <div className="flex items-center space-x-6">
              <h1 className="text-2xl font-black text-blue-600 tracking-tight">LingoFlow</h1>
              <nav className="flex space-x-4">
                <button
                  onClick={() => setCurrentView('game')}
                  className={`text-sm font-bold transition-colors ${currentView === 'game' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  Play Game
                </button>
                {session?.user?.email === 'abdutigr@gmail.com' && (
                  <button
                    onClick={() => setCurrentView('admin')}
                    className={`text-sm font-bold transition-colors ${currentView === 'admin' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-900'}`}
                  >
                    Admin Panel
                  </button>
                )}
                <button
                  onClick={() => setCurrentView('dictionary')}
                  className={`text-sm font-bold transition-colors ${currentView === 'dictionary' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  Dictionary Vault
                </button>
                <button
                  onClick={() => setCurrentView('dojo')}
                  className={`text-sm font-bold transition-colors ${currentView === 'dojo' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  Training Dojo
                </button>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-200">
                <span className="text-orange-500 font-bold mr-2">🔥</span>
                <span className="text-orange-700 font-black">{dailyStreak} Day Streak</span>
              </div>
              <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
                {session.user.email}
              </span>
              <button
                onClick={handleLogOut}
                className="text-sm font-bold text-gray-500 hover:text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg transition-all"
              >
                Log Out
              </button>
            </div>
          </header>

          {currentView === 'game' && (
            <>
              {isLoadingArticles && (
                <p className="text-gray-500 animate-pulse mb-8">Loading articles...</p>
              )}

              {errorArticles && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-8 min-w-[300px] text-center">
                  <p className="font-bold">Error loading articles</p>
                  <p className="text-sm">{errorArticles}</p>
                </div>
              )}

              {!isLoadingArticles && !errorArticles && articles.length > 0 && (
                <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-100 w-full max-w-md transition-transform hover:-translate-y-1 hover:shadow-xl mb-8">
                  <h2 className="text-xl font-bold text-gray-800 mb-2">{articles[0].title}</h2>
                  <p className="text-gray-600 text-sm">
                    {articles[0].content_data ? 'Content data available' : 'No content preview available'}
                  </p>
                </div>
              )}

              <div className="w-full max-w-4xl bg-white rounded-xl shadow-xl p-6 border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
                <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center space-x-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                  <span>Reading Session</span>
                </h2>
                <Reader session={session} />
              </div>
            </>
          )}

          {currentView === 'admin' && (
            <Admin />
          )}

          {currentView === 'dictionary' && (
            <Dictionary session={session} />
          )}

          {currentView === 'dojo' && (
            <Dojo session={session} />
          )}

        </div>
      )}
    </div>
  );
}

export default App;