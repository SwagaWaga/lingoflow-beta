import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import SmartReview from './SmartReview';

export default function Reader({ session }) {
  const [selectedCategory, setSelectedCategory] = useState(null);

  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [currentSegment, setCurrentSegment] = useState(0);
  const [xp, setXp] = useState(0);
  const [feedback, setFeedback] = useState("");

  const [gamePhase, setGamePhase] = useState('reading');
  const [collectedWords, setCollectedWords] = useState([]);

  const categories = [
    { id: 'biology_nature', name: 'Biology & Nature', icon: '🌿', color: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300' },
    { id: 'geography_environment', name: 'Geography & Environment', icon: '🌍', color: 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100 hover:border-sky-300' },
    { id: 'technology_innovation', name: 'Technology & Innovation', icon: '🚀', color: 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300' },
    { id: 'history_society', name: 'History & Society', icon: '🏛️', color: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 hover:border-amber-300' }
  ];

  useEffect(() => {
    async function fetchArticle() {
      if (!selectedCategory) return;

      try {
        setLoading(true);
        setError(null);
        const { data, error } = await supabase
          .from('articles')
          .select('*')
          .eq('category', selectedCategory)
          .limit(1)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            throw new Error(`No articles currently available in the "${selectedCategory}" category.`);
          }
          throw error;
        }

        setArticle(data);
        setCurrentSegment(0);
        setFeedback("");
        setCollectedWords([]);
        setGamePhase('reading');

        // Fetch user's initial XP
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('xp')
            .eq('id', user.id)
            .single();

          if (profile) setXp(profile.xp || 0);
        }

      } catch (err) {
        console.error('Error fetching article:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchArticle();
  }, [selectedCategory]);

  const extractSentence = (text, clickedWord) => {
    // Split text by period followed by space
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

    // Find the first sentence containing the raw clicked word
    const match = sentences.find(sentence =>
      sentence.toLowerCase().includes(clickedWord.toLowerCase())
    );

    return match ? match.trim() : text;
  };

  const handleWordClick = async (word, fullText) => {
    // Clean the word of punctuation before checking
    const cleanWord = word.toLowerCase().replace(/[.,!?;:()"'`]/g, "");

    // Prevent empty clicks
    if (!cleanWord) return;

    // Check if already collected
    const isAlreadyCollected = collectedWords.some(item => item.word === cleanWord);

    if (isAlreadyCollected) {
      setCollectedWords(prev => prev.filter(item => item.word !== cleanWord));
      setFeedback(`🗑️ Removed: ${cleanWord}`);
      setTimeout(() => setFeedback(""), 1500);
      return;
    }

    const contextSentence = extractSentence(fullText, word);

    setCollectedWords(prev => [...prev, { word: cleanWord, context: contextSentence }]);
    setFeedback(`✨ Collected: ${cleanWord}`);
    setTimeout(() => setFeedback(""), 1500);
  };

  const clearCategory = () => {
    setSelectedCategory(null);
    setArticle(null);
    setError(null);
    setCollectedWords([]);
    setGamePhase('reading');
  };

  if (!selectedCategory) {
    return (
      <div className="max-w-5xl mx-auto p-6 bg-slate-50 min-h-[70vh] font-sans flex items-center justify-center">
        <div className="w-full">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-extrabold text-slate-800 mb-4 tracking-tight">Select Your Research Subject</h2>
            <p className="text-slate-500 text-xl font-medium">Choose an academic category to begin your IELTS reading mission.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                className={`flex flex-col items-center justify-center p-10 rounded-3xl border-2 transition-all duration-300 transform hover:-translate-y-2 shadow-sm hover:shadow-2xl ${cat.color}`}
              >
                <span className="text-6xl mb-6 block drop-shadow-sm">{cat.icon}</span>
                <span className="font-bold text-xl text-center leading-tight">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-slate-50 min-h-[70vh] font-sans flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-blue-600 font-bold text-xl animate-pulse">Loading mission...</p>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-slate-50 min-h-[70vh] font-sans flex flex-col justify-center">
        <div className="bg-red-50 border border-red-200 p-8 rounded-2xl text-center shadow-sm">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-red-700 font-extrabold text-2xl mb-2">Mission Unavailable</h2>
          <p className="text-red-600 mb-6 text-lg">{error || "No articles found in database."}</p>
          <button
            onClick={clearCategory}
            className="px-6 py-3 bg-white text-red-600 font-bold rounded-xl shadow border border-red-100 hover:bg-red-50 transition-colors"
          >
            Choose Different Category
          </button>
        </div>
      </div>
    );
  }

  // Quiz Phase View
  if (gamePhase === 'quiz') {
    return (
      <SmartReview
        collectedWords={collectedWords}
        session={session}
        onComplete={clearCategory}
      />
    );
  }

  // Default Reading Phase
  const fullArticleText = article.content_data.segments.map(seg => seg.text).join('\n\n');

  return (
    <div className="max-w-3xl mx-auto p-6 bg-slate-50 min-h-[70vh] font-sans">

      {/* HUD (Heads-up Display) */}
      <div className="flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center space-x-4">
          <button
            onClick={clearCategory}
            className="text-slate-400 hover:text-blue-600 transition-colors flex items-center font-bold text-sm bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Change Category
          </button>
        </div>
        <div className="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-full font-bold shadow-sm transition-all text-lg flex items-center space-x-2">
          <span>✨</span>
          <span>{xp} XP</span>
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">{article.title}</h1>
        <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">{article.category}</span>
      </div>

      {/* Article Content */}
      <div className="bg-white p-8 rounded-3xl shadow-lg mb-8 border-l-4 border-blue-500 relative transition-all">
        <p className="text-xl leading-loose text-slate-700 whitespace-pre-wrap">
          {fullArticleText.split(" ").map((word, i) => {
            const cleanCheckWord = word.toLowerCase().replace(/[.,!?;:()"'`]/g, "");
            const isCollected = collectedWords.some(item => item.word === cleanCheckWord);

            return (
              <span
                key={i}
                onClick={() => handleWordClick(word, fullArticleText)}
                className={`cursor-pointer rounded px-1.5 py-0.5 transition-colors inline-block mx-0.5 ${isCollected
                  ? 'bg-yellow-200 text-yellow-900 border-b-2 border-yellow-400 font-medium'
                  : 'hover:bg-blue-100 hover:text-blue-800'
                  }`}
              >
                {word}
              </span>
            );
          })}
        </p>
      </div>

      {/* Vocabulary Vault & Actions */}
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        <div className="bg-slate-800 p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">🗃️</span>
            <h2 className="text-white font-bold text-xl">Vocabulary Vault</h2>
          </div>
          <span className="bg-slate-700 text-indigo-300 font-bold px-4 py-1.5 rounded-full border border-slate-600">
            {collectedWords.length} Words Collected
          </span>
        </div>

        <div className="p-6 bg-slate-50 min-h-[100px]">
          {collectedWords.length === 0 ? (
            <p className="text-slate-400 text-center italic py-4">Click any word in the article you want to learn to add it to your vault.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {collectedWords.map((item, idx) => (
                <span key={idx} className="bg-white border border-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl shadow-sm hover:border-blue-300 hover:text-blue-600 transition-colors cursor-default" title={item.context}>
                  {item.word}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 bg-white border-t border-slate-100">
          <button
            onClick={() => setGamePhase('quiz')}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold text-lg rounded-2xl shadow-lg hover:-translate-y-1 hover:shadow-blue-500/40 transition-all"
          >
            Finish & Start Smart Review 🚀
          </button>
        </div>
      </div>

      {/* Feedback Animation */}
      <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
        {feedback && (
          <div className="bg-slate-800 text-white px-8 py-3 rounded-full shadow-2xl font-bold text-lg animate-fade-in-up border border-slate-700">
            {feedback}
          </div>
        )}
      </div>
    </div>
  );
}