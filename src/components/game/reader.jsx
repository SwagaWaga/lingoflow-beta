import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import SmartReview from './SmartReview';
import ReadingQuiz from './ReadingQuiz';

const CATEGORY_COLORS = [
  'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300',
  'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100 hover:border-sky-300',
  'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300',
  'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 hover:border-amber-300',
  'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100 hover:border-rose-300',
  'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100 hover:border-purple-300'
];

const CATEGORY_ICONS = ['📚', '🌍', '🔬', '🏛️', '💡', '🧠', '🌿', '🚀'];

function getCategoryColor(index) {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

function getCategoryIcon(index) {
  return CATEGORY_ICONS[index % CATEGORY_ICONS.length];
}

export default function Reader({ session }) {
  // --- Selection State ---
  const [allArticles, setAllArticles] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedArticleId, setSelectedArticleId] = useState(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);

  // --- Reading State ---
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [xp, setXp] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [gamePhase, setGamePhase] = useState('reading');
  const [collectedWords, setCollectedWords] = useState([]);

  // 1. Fetch metadata on mount
  useEffect(() => {
    async function fetchMetadata() {
      try {
        setIsLoadingMetadata(true);
        const { data, error } = await supabase
          .from('articles')
          .select('id, title, category, difficulty_level');

        if (error) throw error;
        setAllArticles(data || []);
      } catch (err) {
        console.error("Error fetching article metadata:", err);
        setError("Could not load article catalogue.");
      } finally {
        setIsLoadingMetadata(false);
      }
    }
    fetchMetadata();
  }, []);

  // Compute unique subjects
  const uniqueSubjects = useMemo(() => {
    // Filter out null/empty categories and get unique values
    const categories = allArticles
      .map(a => a.category)
      .filter(c => c && c.trim() !== '');
    return [...new Set(categories)].sort();
  }, [allArticles]);

  // Derived filtered list based on subject
  const currentSubjectArticles = useMemo(() => {
    if (!selectedSubject) return [];
    return allArticles.filter(a => a.category === selectedSubject);
  }, [allArticles, selectedSubject]);

  // 2. Fetch full article when an ID is selected
  useEffect(() => {
    async function fetchFullArticle() {
      if (!selectedArticleId) return;

      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase
          .from('articles')
          .select('*')
          .eq('id', selectedArticleId)
          .single();

        if (error) throw error;

        setArticle(data);
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
        console.error('Error fetching full article:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchFullArticle();
  }, [selectedArticleId]);


  const extractSentence = (text, clickedWord) => {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const match = sentences.find(sentence =>
      sentence.toLowerCase().includes(clickedWord.toLowerCase())
    );
    return match ? match.trim() : text;
  };

  const handleWordClick = async (word, fullText) => {
    const cleanWord = word.toLowerCase().replace(/[.,!?;:()"'`]/g, "");
    if (!cleanWord) return;

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

  const goBackToSubjects = () => {
    setSelectedSubject(null);
  };

  const clearSelection = () => {
    setSelectedArticleId(null);
    setArticle(null);
    setError(null);
    setCollectedWords([]);
    setGamePhase('reading');
  };

  // --- View 0: Initial Loading Metadata ---
  if (isLoadingMetadata) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-slate-50 min-h-[70vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-blue-600 font-bold text-xl animate-pulse">Loading catalogue...</p>
        </div>
      </div>
    );
  }

  // --- View 1: Subject Selection (No subject selected yet) ---
  if (!selectedSubject) {
    if (uniqueSubjects.length === 0) {
      return (
        <div className="max-w-2xl mx-auto p-6 bg-slate-50 min-h-[70vh] flex flex-col justify-center">
          <div className="bg-white border border-slate-200 p-8 rounded-2xl text-center shadow-sm">
            <div className="text-4xl mb-4">📭</div>
            <h2 className="text-slate-700 font-extrabold text-2xl mb-2">No Content Available</h2>
            <p className="text-slate-500 mb-6 text-lg">There are currently no articles in the database.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-5xl mx-auto p-6 bg-slate-50 min-h-[40vh] font-sans flex items-center justify-center">
        <div className="w-full">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-extrabold text-slate-800 mb-2 tracking-tight">Select a Subject</h2>
            <p className="text-slate-500 font-medium">Choose a category to find reading materials.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {uniqueSubjects.map((subject, index) => (
              <button
                key={subject}
                onClick={() => setSelectedSubject(subject)}
                className={`flex flex-col items-center justify-center p-8 rounded-2xl border-2 transition-all duration-300 transform hover:-translate-y-1 shadow-sm hover:shadow-xl ${getCategoryColor(index)}`}
              >
                <span className="text-4xl mb-4 block drop-shadow-sm">{getCategoryIcon(index)}</span>
                <span className="font-bold text-xl text-center leading-tight">{subject}</span>
                <span className="mt-2 text-sm opacity-75 font-semibold">
                  {allArticles.filter(a => a.category === subject).length} Articles
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- View 2: Article Selection (Subject selected, but no article ID) ---
  if (selectedSubject && !selectedArticleId) {
    return (
      <div className="max-w-3xl mx-auto p-6 bg-slate-50 min-h-[50vh] font-sans">
        <button
          onClick={goBackToSubjects}
          className="mb-6 flex items-center text-slate-500 hover:text-blue-600 font-bold transition-colors bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm hover:border-blue-300"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Subjects
        </button>

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-3xl font-extrabold text-slate-800">{selectedSubject} Articles</h2>
        </div>

        <div className="flex flex-col gap-4">
          {currentSubjectArticles.map(art => (
            <button
              key={art.id}
              onClick={() => setSelectedArticleId(art.id)}
              className="flex flex-col md:flex-row md:items-center justify-between bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all text-left"
            >
              <div>
                <h3 className="text-xl font-bold text-slate-800 mb-1">{art.title}</h3>
                <p className="text-sm text-slate-500 font-medium tracking-wide uppercase">Reading Module</p>
              </div>

              <div className="mt-4 md:mt-0 flex items-center">
                <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${art.difficulty_level === 'Intermediate' ? 'bg-indigo-100 text-indigo-700' :
                  art.difficulty_level === 'Advanced' ? 'bg-orange-100 text-orange-700' :
                    art.difficulty_level === 'Beginner' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-blue-100 text-blue-700'
                  }`}>
                  {art.difficulty_level || 'General'}
                </span>
              </div>
            </button>
          ))}
          {currentSubjectArticles.length === 0 && (
            <p className="text-slate-500 text-center py-8">No articles found in this category.</p>
          )}
        </div>
      </div>
    );
  }

  // --- Loading Article View ---
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
          <p className="text-red-600 mb-6 text-lg">{error || "Failed to load article."}</p>
          <button
            onClick={clearSelection}
            className="px-6 py-3 bg-white text-red-600 font-bold rounded-xl shadow border border-red-100 hover:bg-red-50 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // --- Comprehension Phase View ---
  if (gamePhase === 'comprehension') {
    return (
      <ReadingQuiz
        questions={article?.content_data?.quiz || []}
        article={article}
        onComplete={() => setGamePhase('quiz')} // 'quiz' actually triggers SmartReview
      />
    );
  }

  // --- Smart Review Phase View ---
  if (gamePhase === 'quiz') {
    return (
      <SmartReview
        collectedWords={collectedWords}
        session={session}
        onComplete={clearSelection}
      />
    );
  }

  // --- Reading Phase ---
  const fullArticleText = typeof article?.content_data === 'string'
    ? article.content_data
    : article?.content_data?.text
    || (article?.content_data?.segments ? article.content_data.segments.map(seg => seg.text).join('\n\n') : "No content available.");

  return (
    <div className="max-w-3xl mx-auto p-6 bg-slate-50 min-h-[70vh] font-sans">
      {/* HUD */}
      <div className="flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center space-x-4">
          <button
            onClick={clearSelection}
            className="text-slate-400 hover:text-blue-600 transition-colors flex items-center font-bold text-sm bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to Articles
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

      {/* Vocabulary Vault */}
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
            onClick={() => setGamePhase('comprehension')}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold text-lg rounded-2xl shadow-lg hover:-translate-y-1 hover:shadow-blue-500/40 transition-all"
          >
            Finish & Take Quiz 🚀
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