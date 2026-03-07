import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import SmartReview from './SmartReview';
import ReadingQuiz from './ReadingQuiz';
import { useAccent } from '../../context/AccentContext';
import { GoogleGenerativeAI } from '@google/generative-ai';

const CATEGORY_COLORS = [
  'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300',
  'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100 hover:border-sky-300',
  'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300',
  'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 hover:border-amber-300',
  'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100 hover:border-rose-300',
  'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100 hover:border-purple-300'
];

const IELTS_SUBJECTS = [
  { name: 'Science', icon: '🔬', subSubjects: ['Biology', 'Physics', 'Health'] },
  { name: 'Technology', icon: '💻', subSubjects: ['AI', 'Innovation', 'Engineering'] },
  { name: 'Psychology', icon: '🧠', subSubjects: ['Behavior', 'Cognition', 'Mind'] },
  { name: 'Environment', icon: '🌍', subSubjects: ['Climate', 'Ecology', 'Nature'] },
  { name: 'Society', icon: '🏛️', subSubjects: ['Culture', 'History', 'Politics'] }
];

function getCategoryColor(index) {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

export default function Reader({ session }) {
  const { preferredAccent } = useAccent();
  // --- Selection State ---
  const [allArticles, setAllArticles] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedArticleId, setSelectedArticleId] = useState(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('All');

  // --- Reading State ---
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [xp, setXp] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [gamePhase, setGamePhase] = useState('reading');
  const [collectedWords, setCollectedWords] = useState([]);
  const [isAnalyzingWord, setIsAnalyzingWord] = useState(false);

  // 1. Fetch metadata on mount
  useEffect(() => {
    async function fetchMetadata() {
      try {
        setIsLoadingMetadata(true);
        const { data, error } = await supabase
          .from('articles')
          .select('id, title, category, sub_subject, difficulty_level');

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

    if (isAnalyzingWord) {
      setFeedback("⏳ Please wait, AI is analyzing the previous word...");
      setTimeout(() => setFeedback(""), 2000);
      return;
    }

    const isAlreadyCollected = collectedWords.some(item => item.word === cleanWord);

    if (isAlreadyCollected) {
      setCollectedWords(prev => prev.filter(item => item.word !== cleanWord));
      setFeedback(`🗑️ Removed: ${cleanWord}`);
      setTimeout(() => setFeedback(""), 1500);
      return;
    }

    const contextString = extractSentence(fullText, word);
    setIsAnalyzingWord(true);
    setFeedback(`⏳ Analyzing: ${cleanWord}...`);

    try {
      // 1. Check Local Cache (Supabase)
      let hasCache = false;
      let aiDefinition = "";
      let aiDnaType = "Basic";
      let aiAudioUrl = null;

      if (session?.user?.id) {
        const { data: cachedWord, error: dbErr } = await supabase
          .from('user_vocabulary')
          .select('definition, dna_type, audio_url')
          .eq('user_id', session.user.id)
          .eq('word', cleanWord)
          .maybeSingle();

        if (cachedWord && cachedWord.definition && cachedWord.definition !== "Definition not found") {
          aiDefinition = cachedWord.definition;
          aiDnaType = cachedWord.dna_type || "Basic";
          aiAudioUrl = cachedWord.audio_url || null;
          hasCache = true;
        }
      }

      // 2. Polyglot API Architecture if not in cache
      if (!hasCache) {

        // --- Step 2a: Pre-computed DNA Classification & Prefilled Definition ---
        const dnaData = article?.dna_map?.[cleanWord.toLowerCase()];
        aiDnaType = typeof dnaData === 'string' ? dnaData : (dnaData?.category || "Lexicon");
        if (typeof dnaData === 'object' && dnaData?.definition) {
          aiDefinition = dnaData.definition;
        }

        // --- Step 2b: Free Dictionary API for Audio (definition removed) ---
        try {
          const dictRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`);
          if (dictRes.ok) {
            const dictData = await dictRes.json();

            // Safely extract audio URL based on user preference
            if (dictData[0]?.phonetics && dictData[0].phonetics.length > 0) {
              const validAudios = dictData[0].phonetics.filter(p => p.audio && p.audio.length > 0);
              if (validAudios.length > 0) {
                const requestedAudio = validAudios.find(p => p.audio.toLowerCase().includes(`-${preferredAccent.toLowerCase()}.`));
                aiAudioUrl = requestedAudio ? requestedAudio.audio : validAudios[0].audio;
              }
            }
          }
        } catch (dictErr) {
          console.warn("Free Dictionary API failed to get audio.", dictErr);
        }

        // --- Step 2c: LLM for Contextual Definitions ---
        if (!aiDefinition) {
          try {
            console.log("Generating context-aware definition via LLM...");
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const prompt = `Act as an expert IELTS teacher. Look at the word '${cleanWord}' and read this specific sentence: '${contextString}'. Define the word EXACTLY as it is used in this specific context. If it is part of a phrase (like 'gray matter'), define the phrase. Keep the definition under 15 words, simple, and do not provide the standard dictionary definition if it conflicts with the context. Return ONLY the definition text without any markdown or quotes.`;
            const result = await model.generateContent(prompt);
            const text = result.response.text();

            if (text && text.trim()) {
              aiDefinition = text.replace(/^["']|["']$/g, '').trim();
            } else {
              aiDefinition = "Definition not found. Please review manually.";
            }
          } catch (aiErr) {
            console.warn("LLM Fallback failed:", aiErr);
            aiDefinition = "Definition not found. Please review manually.";
          }
        }
      }

      setCollectedWords(prev => [...prev, {
        word: cleanWord,
        context: contextString,
        definition: aiDefinition,
        dna_type: aiDnaType,
        audio_url: aiAudioUrl
      }]);

      if (hasCache) {
        setFeedback(`✨ Restored from Vault: ${cleanWord}`);
      } else {
        setFeedback(`✨ Analyzed & Collected: ${cleanWord}`);
      }
      setTimeout(() => setFeedback(""), 2000);

    } catch (err) {
      console.error("Analysis failed:", err);
      setFeedback(`❌ Error analyzing ${cleanWord}`);
      setTimeout(() => setFeedback(""), 2000);
    } finally {
      setIsAnalyzingWord(false);
    }
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
      <div className="p-6 min-h-[70vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-blue-600 dark:text-blue-400 font-bold text-xl animate-pulse">Loading catalogue...</p>
        </div>
      </div>
    );
  }

  // --- View 1: Subject Selection (No subject selected yet) ---
  if (!selectedSubject) {
    if (allArticles.length === 0) {
      return (
        <div className="p-6 min-h-[70vh] flex flex-col justify-center">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 rounded-2xl text-center shadow-sm">
            <div className="text-4xl mb-4">📭</div>
            <h2 className="text-slate-700 dark:text-white font-extrabold text-2xl mb-2">No Content Available</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6 text-lg">There are currently no articles in the database.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="p-8 font-sans">
        <div className="w-full">
          <div className="mb-8">
            <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight mb-1">Choose a Subject</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Pick a topic you're curious about to find reading materials.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {IELTS_SUBJECTS.map((subject, index) => {
              const articleCount = allArticles.filter(a => a.category === subject.name).length;
              return (
                <button
                  key={subject.name}
                  onClick={() => setSelectedSubject(subject.name)}
                  className="group flex flex-col items-start justify-between min-h-48 h-full p-7 rounded-2xl border transition-all duration-200 ease-in-out cursor-pointer bg-slate-800/60 border-slate-700/50 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-black/30 hover:border-slate-500/80 active:scale-95 shadow-sm"
                >
                  <div className="w-full text-left flex flex-col h-full">
                    <span className="text-4xl mb-4 block drop-shadow-sm transition-transform duration-300 group-hover:scale-110">{subject.icon}</span>
                    <div className="flex-grow">
                      <span className="font-black text-lg leading-tight block mb-1 text-slate-100">{subject.name}</span>
                      <span className="text-sm font-semibold text-slate-400">
                        {articleCount} Article{articleCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3 w-full">
                      {[...(subject.subSubjects || [])].sort((a, b) => a.localeCompare(b)).map(sub => (
                        <span key={sub} className="text-xs px-2 py-1 rounded-full font-medium border bg-slate-900/60 border-slate-600/60 text-slate-400 group-hover:border-slate-500 group-hover:text-slate-300 transition-colors">
                          {sub}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    );
  }

  if (selectedSubject && !selectedArticleId) {
    // Derive available filter tags from real sub_subject values in fetched articles
    const availableFilters = [...new Set(
      currentSubjectArticles
        .map(a => a.sub_subject)
        .filter(s => s && s.trim() !== '')
    )].sort((a, b) => a.localeCompare(b));

    // Filter articles by sub_subject
    const filteredArticles = selectedFilter === 'All'
      ? currentSubjectArticles
      : currentSubjectArticles.filter(art => art.sub_subject === selectedFilter);

    return (
      <div className="p-8 font-sans">
        <button
          onClick={() => { goBackToSubjects(); setSelectedFilter('All'); }}
          className="mb-6 flex items-center text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-bold transition-colors bg-slate-100 dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-800 text-sm group"
        >
          <svg className="w-4 h-4 mr-2 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Subjects
        </button>

        <div className="mb-4">
          <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{selectedSubject}</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">{currentSubjectArticles.length} article{currentSubjectArticles.length !== 1 ? 's' : ''} available</p>
        </div>

        {/* Filter Bar */}
        {availableFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setSelectedFilter('All')}
              className={`px-4 py-1.5 rounded-full text-sm font-bold border transition-all duration-200 active:scale-95 ${selectedFilter === 'All'
                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/30'
                : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:bg-slate-700 hover:text-slate-200'
                }`}
            >
              All
            </button>
            {availableFilters.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedFilter(tag)}
                className={`px-4 py-1.5 rounded-full text-sm font-bold border transition-all duration-200 active:scale-95 ${selectedFilter === tag
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/30'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:bg-slate-700 hover:text-slate-200'
                  }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-4">
          {filteredArticles.map(art => (
            <button
              key={art.id}
              onClick={() => setSelectedArticleId(art.id)}
              className="group flex flex-col md:flex-row md:items-center justify-between bg-slate-800/60 p-5 rounded-2xl border border-slate-700/50 hover:border-slate-500/80 hover:shadow-xl hover:shadow-black/20 transition-all duration-200 ease-in-out text-left hover:-translate-y-0.5 active:scale-[0.99]"
            >
              <div>
                <h3 className="text-lg font-black text-slate-100 mb-1 group-hover:text-blue-400 transition-colors">{art.title}</h3>
                <p className="text-sm text-slate-500 font-semibold uppercase tracking-wide">Reading Module</p>
              </div>

              <div className="mt-4 md:mt-0 flex items-center space-x-3">
                <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${art.difficulty_level === 'Intermediate' ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' :
                  art.difficulty_level === 'Advanced' ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' :
                    art.difficulty_level === 'Beginner' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' :
                      'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  }`}>
                  {art.difficulty_level || 'General'}
                </span>
                <span className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity font-black">→</span>
              </div>
            </button>
          ))}
          {filteredArticles.length === 0 && (
            <div className="py-16 text-center">
              <div className="text-4xl mb-4">🔍</div>
              <p className="text-slate-600 dark:text-slate-400 font-bold text-lg">
                No articles found for <span className="text-blue-500">{selectedFilter}</span> yet.
              </p>
              <button
                onClick={() => setSelectedFilter('All')}
                className="mt-4 px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold text-sm transition-all"
              >
                Show All Articles
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Loading Article View ---
  if (loading) {
    return (
      <div className="p-6 min-h-[70vh] font-sans flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-blue-600 dark:text-blue-400 font-bold text-xl animate-pulse">Loading mission...</p>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="p-6 min-h-[70vh] font-sans flex flex-col justify-center">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-8 rounded-2xl text-center shadow-sm">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-red-700 dark:text-red-400 font-extrabold text-2xl mb-2">Mission Unavailable</h2>
          <p className="text-red-600 dark:text-red-300 mb-6 text-lg">{error || "Failed to load article."}</p>
          <button
            onClick={clearSelection}
            className="px-6 py-3 bg-white dark:bg-slate-700 text-red-600 dark:text-red-300 font-bold rounded-xl shadow border border-red-100 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
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
    <div className="max-w-3xl mx-auto p-4 md:p-6 min-h-[70vh] font-sans">
      {/* HUD */}
      <div className="flex justify-between items-center mb-5 md:mb-8 bg-white dark:bg-slate-800 p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
        <div className="flex items-center space-x-4">
          <button
            onClick={clearSelection}
            className="text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center font-bold text-sm bg-slate-50 dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-600 hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to Articles
          </button>
        </div>
        <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-3 md:px-4 py-1.5 md:py-2 rounded-full font-bold shadow-sm transition-all text-sm md:text-lg flex items-center space-x-1.5 md:space-x-2">
          <span>✨</span>
          <span>{xp} XP</span>
        </div>
      </div>

      <div className="mb-4 md:mb-6 flex flex-wrap items-start md:items-center justify-between gap-2">
        <h1 className="text-xl md:text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">{article.title}</h1>
        <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex-shrink-0">{article.category}</span>
      </div>

      {/* Article Content */}
      <div className="bg-white dark:bg-slate-800 p-4 md:p-8 rounded-2xl md:rounded-3xl shadow-lg mb-6 md:mb-8 border-l-4 border-blue-500 relative transition-colors">
        <div className="text-base md:text-xl text-slate-700 dark:text-slate-200">
          {fullArticleText.split('\n').map((paragraph, pIdx) => {
            if (!paragraph.trim()) return null;

            return (
              <p key={pIdx} className="mb-6 leading-loose block text-left">
                {paragraph.split(/\s+/).map((word, wIdx) => {
                  if (!word) return null;
                  const cleanCheckWord = word.toLowerCase().replace(/[.,!?;:()"'`]/g, "");
                  const isCollected = collectedWords.some(item => item.word === cleanCheckWord);

                  return (
                    <span key={`${pIdx}-${wIdx}`}>
                      <button
                        onClick={() => handleWordClick(word, fullArticleText)}
                        className={`inline-block py-1 rounded transition-colors ${isCollected
                          ? 'bg-yellow-200 dark:bg-yellow-700/60 text-yellow-900 dark:text-yellow-100 border-b-2 border-yellow-400 dark:border-yellow-600 font-medium px-1'
                          : 'hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                      >
                        {word}
                      </button>
                      {" "}
                    </span>
                  );
                })}
              </p>
            );
          })}
        </div>
      </div>

      {/* Vocabulary Vault */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl overflow-hidden border border-slate-100 dark:border-slate-700 transition-colors">
        <div className="bg-slate-800 dark:bg-slate-900 p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">🗃️</span>
            <h2 className="text-white font-bold text-xl">Vocabulary Vault</h2>
          </div>
          <span className="bg-slate-700 dark:bg-slate-800 text-indigo-300 font-bold px-4 py-1.5 rounded-full border border-slate-600">
            {collectedWords.length} Words Collected
          </span>
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 min-h-[100px]">
          {collectedWords.length === 0 ? (
            <p className="text-slate-400 dark:text-slate-500 text-center italic py-4">Click any word in the article you want to learn to add it to your vault.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {collectedWords.map((item, idx) => (
                <span key={idx} className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold px-4 py-2 rounded-xl shadow-sm hover:border-blue-300 hover:text-blue-600 transition-colors cursor-default" title={item.context}>
                  {item.word}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
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