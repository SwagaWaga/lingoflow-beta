import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { GoogleGenerativeAI } from '@google/generative-ai';

const FALLBACK_WORDS = [
    'analyze', 'context', 'significant', 'process', 'structure',
    'function', 'environment', 'variable', 'method', 'theory',
    'factor', 'occur', 'indicate', 'derive', 'assess',
    'concept', 'approach', 'establish', 'identify', 'require'
];

const maskText = (text, targetWord) => {
    if (!text || !targetWord) return '';
    const regex = new RegExp(targetWord, 'gi');
    return text.replace(regex, '_______');
}

export default function Dojo({ session }) {
    const [practiceBatch, setPracticeBatch] = useState(() => {
        const saved = localStorage.getItem('dojoSession');
        return saved ? JSON.parse(saved).practiceBatch : [];
    });
    const [currentIndex, setCurrentIndex] = useState(() => {
        const saved = localStorage.getItem('dojoSession');
        return saved ? JSON.parse(saved).currentIndex : 0;
    });
    const [currentPhase, setCurrentPhase] = useState(() => {
        const saved = localStorage.getItem('dojoSession');
        return saved ? JSON.parse(saved).currentPhase : 1;
    });
    const [survivingWords, setSurvivingWords] = useState(() => {
        const saved = localStorage.getItem('dojoSession');
        return saved ? JSON.parse(saved).survivingWords : [];
    });
    const [options, setOptions] = useState([]);
    const [isFinished, setIsFinished] = useState(false);
    const [textAnswer, setTextAnswer] = useState("");
    const [insufficientWords, setInsufficientWords] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [trainedCount, setTrainedCount] = useState(0);

    // AI Variables (Level 2)
    const [gptQuestion, setGptQuestion] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiError, setAiError] = useState(null);

    // AI Variables (Level 3)
    const [userSentence, setUserSentence] = useState("");
    const [isGrading, setIsGrading] = useState(false);
    const [aiFeedback, setAiFeedback] = useState(null);

    const [loading, setLoading] = useState(true);
    const [feedback, setFeedback] = useState("");
    const [error, setError] = useState(null);

    // DB Cleanup: Remove broken definition words
    useEffect(() => {
        async function cleanupDB() {
            if (!session?.user?.id) return;
            try {
                await supabase
                    .from('user_vocabulary')
                    .delete()
                    .eq('user_id', session.user.id)
                    .in('definition', ['Definition not found', 'Definition not found.', 'Failed to load definition.']);
            } catch (err) {
                console.error("Cleanup error:", err);
            }
        }
        cleanupDB();
    }, [session]);

    // Auto-Save Session Progress
    useEffect(() => {
        if (practiceBatch.length > 0) {
            const sessionData = { currentPhase, currentIndex, practiceBatch, survivingWords };
            localStorage.setItem('dojoSession', JSON.stringify(sessionData));
        }
    }, [currentPhase, currentIndex, practiceBatch, survivingWords]);

    // Fetch up to 5 words that need practice (Only if no active session)
    useEffect(() => {
        async function fetchTrainingData() {
            if (!session?.user?.id) {
                setLoading(false);
                return;
            }

            // Skip fetch if we successfully loaded a session from storage
            if (practiceBatch.length > 0) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                // 12 hours ago
                const cooldownLimit = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

                const { data, error } = await supabase
                    .from('user_vocabulary')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .lt('mastery_level', 4) // Exclude fully Mastered words
                    .or(`last_practiced.is.null,last_practiced.lte.${cooldownLimit}`) // SRS cooldown logic
                    .order('last_practiced', { ascending: true, nullsFirst: true }) // Oldest first, prioritizing unpracticed
                    .limit(5);

                if (data && data.length < 4) {
                    setInsufficientWords(true);
                    setPracticeBatch([]);
                } else {
                    setPracticeBatch(data || []);
                }
            } catch (err) {
                console.error("Error fetching Dojo data:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        fetchTrainingData();
    }, [session]);

    // Generate options when current word changes
    useEffect(() => {
        if (practiceBatch.length === 0 || isFinished || currentIndex >= practiceBatch.length) return;

        const currentWord = practiceBatch[currentIndex].word;

        // Build option pool
        const otherTrainingWords = practiceBatch.map(w => w.word).filter(w => w !== currentWord);
        const pool = [...otherTrainingWords, ...FALLBACK_WORDS].filter(w => w !== currentWord);

        // Shuffle and take 3
        const shuffledPool = pool.sort(() => 0.5 - Math.random());
        const incorrectOptions = Array.from(new Set(shuffledPool)).slice(0, 3);

        // Ensure we always have 3 wrong options
        while (incorrectOptions.length < 3) {
            const randomFallback = FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)];
            if (!incorrectOptions.includes(randomFallback) && randomFallback !== currentWord) {
                incorrectOptions.push(randomFallback);
            }
        }

        // Add correct word and shuffle final options
        const finalOptions = [...incorrectOptions, currentWord].sort(() => 0.5 - Math.random());
        setOptions(finalOptions);
    }, [currentIndex, practiceBatch, isFinished]);

    // Gemini SDK Fetcher with Dual-Key Architecture & Fallback
    const fetchContextQuestion = async (targetWord) => {
        try {
            setAiError(null);
            setIsGenerating(true);
            const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY_DOJO);
            const prompt = `You are an expert IELTS tutor. Create a C1-level fill-in-the-blank sentence for the target word '${targetWord}'. Replace the target word in the sentence with '______'. Generate 3 incorrect but grammatically plausible distractors. Return STRICTLY a JSON object with this exact structure: {"sentence": "...", "options": ["distractor1", "${targetWord}", "distractor2", "distractor3"], "answer": "${targetWord}"}. Do not include markdown formatting like \`\`\`json.`;

            let text = "";
            try {
                // First attempt: The fast 2.5 model
                const model15 = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
                const result = await model15.generateContent(prompt);
                text = await result.response.text();
            } catch (error) {
                console.warn("2.5-flash failed, falling back to gemini-2.0-flash...", error.message);
                // Fallback attempt: The universally available 2.0 model
                const model10 = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
                const fallbackResult = await model10.generateContent(prompt);
                text = await fallbackResult.response.text();
            }

            // Sanitize in case the model ignored the markdown rule
            text = text.replace(/```json|```/g, '').trim();

            const parsedData = JSON.parse(text);

            // Randomize Options
            parsedData.options = parsedData.options.sort(() => 0.5 - Math.random());
            setGptQuestion(parsedData);
        } catch (err) {
            console.error("Gemini SDK Generation Error:", err);
            setAiError(err.message || "Failed to connect to Gemini API.");
        } finally {
            setIsGenerating(false);
        }
    };

    // Auto-fetch if DB naturally lands us on Phase 2
    useEffect(() => {
        if (practiceBatch.length === 0 || isFinished || currentIndex >= practiceBatch.length) return;

        const currentItem = practiceBatch[currentIndex];
        if (currentPhase === 2 && !gptQuestion && !isGenerating) {
            fetchContextQuestion(currentItem.word);
        }
    }, [currentPhase, currentIndex, practiceBatch, isFinished]);

    const handleAnswer = async (selectedWordOrEvent) => {
        let answer = selectedWordOrEvent;
        if (selectedWordOrEvent && selectedWordOrEvent.preventDefault) {
            selectedWordOrEvent.preventDefault();
            answer = textAnswer;
        }

        const currentItem = practiceBatch[currentIndex];

        let isCorrect = false;
        if (currentPhase === 1) {
            isCorrect = typeof answer === 'string' && answer.toLowerCase().trim() === currentItem.word.toLowerCase();
        } else if (currentPhase === 2 && gptQuestion) {
            isCorrect = typeof answer === 'string' && answer.toLowerCase().trim() === gptQuestion.answer.toLowerCase();
        }

        let dbNewLevel = currentItem.mastery_level || 1;

        if (isCorrect) {
            setFeedback("Correct! 🔥");
            dbNewLevel = Math.max(dbNewLevel, currentPhase + 1);
            if (currentPhase === 1) {
                setSurvivingWords(prev => [...prev, currentItem]);
            }
        } else {
            setFeedback("Incorrect! 🧊");
            dbNewLevel = Math.max(1, dbNewLevel - 1);
        }

        // Update Database in background
        if (session?.user?.id) {
            try {
                await supabase
                    .from('user_vocabulary')
                    .update({
                        mastery_level: dbNewLevel,
                        last_practiced: new Date().toISOString()
                    })
                    .match({ user_id: session.user.id, word: currentItem.word });
            } catch (err) {
                console.error("Failed to update data:", err);
            }
        }

        // Move to next word or phase
        setTimeout(async () => {
            setFeedback("");
            setTextAnswer("");
            setUserSentence("");
            setAiFeedback(null);
            setGptQuestion(null);

            if (currentIndex + 1 < practiceBatch.length) {
                setCurrentIndex(prev => prev + 1);
            } else {
                if (currentPhase === 1) {
                    // Use functional update to ensure we read freshest array from closure
                    setSurvivingWords(latestSurvivors => {
                        if (latestSurvivors.length === 0) {
                            setCurrentPhase('defeat');
                        } else {
                            // Sieve passed! Advance to phase 2 with only the survivors
                            setPracticeBatch([...latestSurvivors].sort(() => 0.5 - Math.random()));
                            setCurrentIndex(0);
                            setCurrentPhase(2);
                        }
                        return []; // Clear tracking array
                    });
                } else {
                    // --- VICTORY BLOCK: SRS UPDATE ---
                    setIsSaving(true);

                    if (session?.user?.id) {
                        try {
                            // 1. Update Streak
                            await supabase.rpc('update_user_streak', { user_id_param: session.user.id });

                            // 2. Loop through and update SRS Timestamps sequentially
                            const now = new Date().toISOString();
                            for (const wordObj of practiceBatch) {
                                await supabase
                                    .from('user_vocabulary')
                                    .update({ last_practiced: now })
                                    .match({ user_id: session.user.id, word: wordObj.word });
                            }
                        } catch (err) {
                            console.error("Failed to save session progress:", err);
                        }
                    }

                    setTrainedCount(practiceBatch.length);
                    setIsSaving(false);
                    localStorage.removeItem('dojoSession');
                    setPracticeBatch([]);
                    setIsFinished(true);
                }
            }
        }, 1500);
    };

    const handleAbandonRun = () => {
        const confirmQuit = window.confirm("Are you sure you want to abandon this training session?");
        if (confirmQuit) {
            localStorage.removeItem('dojoSession');
            setCurrentPhase(1);
            setCurrentIndex(0);
            setSurvivingWords([]);
            setPracticeBatch([]); // Trigger a fresh batch fetch
        }
    };

    const handleGradeSentence = async (e) => {
        e.preventDefault();
        const currentItem = practiceBatch[currentIndex];

        if (!userSentence.trim()) return;

        try {
            setIsGrading(true);
            const prompt = `You are a helpful but strict IELTS tutor. The student must write an original sentence using the word '${currentItem.word}'. The word MUST be used with the exact same meaning it had in this original text: '${currentItem.context_sentence}'. Student's sentence: '${userSentence}'. Evaluate if the word is used correctly in that specific context and if the grammar is sound. Respond ONLY in strict JSON format like this: {"passed": true, "feedback": "Great job using it in a biological context!"} or {"passed": false, "feedback": "Grammar error, or you used the wrong definition of the word."}`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }]
                })
            });

            const data = await response.json();

            let resultJson = null;

            if (data.candidates && data.candidates[0] && data.candidates[0].content.parts[0].text) {
                let aiText = data.candidates[0].content.parts[0].text.trim();
                // Strip markdown formatting if AI included it
                if (aiText.startsWith('```json')) {
                    aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
                } else if (aiText.startsWith('```')) {
                    aiText = aiText.replace(/```/g, '').trim();
                }

                try {
                    resultJson = JSON.parse(aiText);
                } catch (parseErr) {
                    console.error("Failed to parse AI JSON response:", aiText);
                }
            }

            if (resultJson && typeof resultJson.passed === 'boolean') {
                setAiFeedback(resultJson);
            } else {
                // Fallback if parsing completely fails
                setAiFeedback({
                    passed: false,
                    feedback: "API formatting error. Please strictly check your grammar and try again."
                });
            }

        } catch (err) {
            console.error("Sentence grading error:", err);
            setAiFeedback({
                passed: false,
                feedback: "Failed to connect to grading server. Please try again."
            });
        } finally {
            setIsGrading(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto p-6 flex flex-col items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
                <p className="text-orange-600 dark:text-orange-400 font-bold text-xl animate-pulse">Entering the Dojo...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-4xl mx-auto p-6 text-center">
                <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-6 rounded-2xl border border-red-200 dark:border-red-800">
                    <h2 className="text-xl font-bold mb-2">Failed to load Training Data</h2>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    if (insufficientWords) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <div className="bg-white dark:bg-slate-800 p-12 rounded-3xl text-center shadow-lg border border-slate-100 dark:border-slate-700 transition-colors">
                    <span className="text-6xl mb-6 block">📚</span>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight mb-4">Not Enough Words!</h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-lg max-w-lg mx-auto mb-8 leading-relaxed">
                        You need at least 4 words in your Vault to enter the Dojo! Go read an article to collect more words.
                    </p>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="bg-orange-500 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-orange-600 hover:-translate-y-1 transition-all shadow-lg hover:shadow-orange-500/40"
                    >
                        Back to Library
                    </button>
                </div>
            </div>
        );
    }

    if (!isFinished && practiceBatch.length === 0) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <div className="bg-white dark:bg-slate-800 p-12 rounded-3xl text-center shadow-lg border border-slate-100 dark:border-slate-700 transition-colors">
                    <span className="text-6xl mb-6 block">🏆</span>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight mb-4">You are all caught up!</h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-lg max-w-lg mx-auto mb-8 leading-relaxed">
                        Incredible work. Your recently trained words are resting right now to build your long-term memory. Take a break, or go to the Vault to add new words.
                    </p>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="bg-orange-500 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-orange-600 hover:-translate-y-1 transition-all shadow-lg hover:shadow-orange-500/40"
                    >
                        Return to Vault
                    </button>
                </div>
            </div>
        );
    }

    if (isSaving) {
        return (
            <div className="max-w-4xl mx-auto p-6 flex flex-col items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
                <p className="text-orange-600 dark:text-orange-400 font-bold animate-pulse">Saving your mastery progress...</p>
            </div>
        );
    }

    if (isFinished) {
        return (
            <div className="max-w-4xl mx-auto p-6 min-h-[70vh] flex items-center justify-center">
                <div className="bg-white dark:bg-slate-800 p-12 rounded-3xl text-center shadow-2xl border-t-8 border-orange-500 w-full max-w-md transform transition-all hover:-translate-y-2">
                    <span className="text-6xl mb-6 block text-center animate-bounce">🎌</span>
                    <h2 className="text-4xl font-black text-slate-800 dark:text-white mb-4 tracking-tight">Dojo Complete!</h2>
                    <p className="text-xl font-medium text-slate-600 dark:text-slate-300 mb-8">You trained <strong className="text-orange-500">{trainedCount}</strong> words!</p>

                    <button
                        onClick={() => {
                            localStorage.removeItem('dojoSession');
                            window.location.reload();
                        }}
                        className="px-8 py-4 w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-extrabold text-xl rounded-2xl shadow-lg hover:shadow-orange-500/40 transition-all hover:scale-[1.02]"
                    >
                        Train Again
                    </button>
                    <p className="mt-4 text-xs text-slate-400 font-bold uppercase tracking-widest">Or navigate using the menu above</p>
                </div>
            </div>
        );
    }

    if (currentPhase === 'defeat') {
        return (
            <div className="max-w-4xl mx-auto p-6 min-h-[70vh] flex items-center justify-center">
                <div className="bg-white dark:bg-slate-800 p-12 rounded-3xl text-center shadow-2xl border-t-8 border-slate-800 w-full max-w-md transform transition-all hover:-translate-y-2">
                    <span className="text-6xl mb-6 block text-center animate-pulse">☠️</span>
                    <h2 className="text-4xl font-black text-slate-800 dark:text-white mb-4 tracking-tight">Dojo Defeat</h2>
                    <p className="text-lg font-medium text-slate-600 dark:text-slate-300 mb-8 leading-relaxed">The Dojo requires absolute focus. None of your words survived the first round.</p>

                    <button
                        onClick={() => {
                            localStorage.removeItem('dojoSession');
                            window.location.href = '/';
                        }}
                        className="px-8 py-4 w-full bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xl rounded-2xl shadow-lg hover:shadow-slate-500/40 transition-all hover:scale-[1.02]"
                    >
                        Return to Vault
                    </button>
                    <p className="mt-4 text-xs text-slate-400 font-bold uppercase tracking-widest">Train harder and try again.</p>
                </div>
            </div>
        );
    }

    // --- DEFENSIVE RENDERING GUARD ---
    // Prevents crashing if the component tries to render before state hooks have resolved the array
    if (!practiceBatch || practiceBatch.length === 0 || !practiceBatch[currentIndex]) {
        return (
            <div className="max-w-4xl mx-auto p-6 flex flex-col items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
                <p className="text-orange-600 dark:text-orange-400 font-bold animate-pulse">Initializing Dojo Session...</p>
            </div>
        );
    }

    const currentItem = practiceBatch[currentIndex];
    const level = currentItem.mastery_level || 1;
    const maskedContext = currentItem.context_sentence ? maskText(currentItem.context_sentence, currentItem.word) : "Context not available.";

    return (
        <div className="max-w-4xl mx-auto p-6 font-sans">
            <div className="flex justify-between items-center mb-8 px-4">
                <div className="bg-white dark:bg-slate-800 px-6 py-2 rounded-full shadow-sm border border-slate-200 dark:border-slate-700 font-bold text-slate-500 dark:text-slate-300 text-sm tracking-widest uppercase transition-colors">
                    Phase {currentPhase}: Round {currentIndex + 1} / {practiceBatch.length}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-700 mb-8 max-w-2xl mx-auto relative overflow-hidden group transition-colors">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-400 to-red-500 opacity-80 group-hover:opacity-100 transition-opacity"></div>

                {currentPhase === 1 && (
                    <>
                        <span className="text-xs font-black text-orange-400 uppercase tracking-[0.2em] block mb-4">Phase 1: Definition Match</span>
                        <p className="text-2xl lg:text-3xl font-medium text-slate-800 dark:text-white leading-snug">
                            {maskText(currentItem.definition, currentItem.word) || "Definition not found for this word."}
                        </p>
                    </>
                )}

                {currentPhase === 2 && (
                    <>
                        <span className="text-xs font-black text-orange-400 uppercase tracking-[0.2em] block mb-4">Phase 2: Context Mastery</span>
                        {aiError ? (
                            <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-6 rounded-2xl border border-red-200 dark:border-red-800 text-center mb-4">
                                <h3 className="font-bold mb-2">AI Generation Failed</h3>
                                <p className="mb-4 text-sm">{aiError}</p>
                                <button
                                    onClick={() => fetchContextQuestion(currentItem.word)}
                                    className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                                >
                                    Try Again
                                </button>
                            </div>
                        ) : isGenerating || !gptQuestion ? (
                            <div className="flex items-center space-x-3 text-orange-500 animate-pulse my-4">
                                <div className="w-6 h-6 border-t-2 border-b-2 border-orange-500 rounded-full animate-spin"></div>
                                <span className="font-bold">AI is writing a new scenario...</span>
                            </div>
                        ) : (
                            <p className="text-2xl lg:text-3xl font-medium text-slate-800 dark:text-white leading-snug italic">
                                "{gptQuestion.sentence}"
                            </p>
                        )}
                    </>
                )}

                {currentPhase >= 3 && !aiFeedback && (
                    <>
                        <span className="text-xs font-black text-orange-400 uppercase tracking-[0.2em] block mb-4">Level 3: Active Recall</span>
                        <p className="text-xl font-medium text-slate-800 dark:text-white leading-snug mb-6">
                            Write an original, academic sentence using the word: <span className="font-black text-blue-600 dark:text-blue-400 capitalize">'{currentItem.word}'</span>
                        </p>
                        <p className="text-sm text-gray-500 dark:text-slate-400 italic mb-4">Original context: "{currentItem.context_sentence}"</p>
                        <form onSubmit={handleGradeSentence} className="flex flex-col gap-4">
                            <textarea
                                value={userSentence}
                                onChange={(e) => setUserSentence(e.target.value)}
                                placeholder="Type your sentence here..."
                                disabled={isGrading}
                                rows={3}
                                className="w-full py-4 px-6 text-xl font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl focus:border-orange-500 dark:focus:border-orange-500 focus:ring focus:ring-orange-200 dark:focus:ring-orange-900 outline-none transition-all shadow-sm disabled:opacity-50"
                            />
                            <button
                                type="submit"
                                disabled={isGrading || !userSentence.trim()}
                                className="py-4 px-8 bg-gradient-to-r from-orange-500 to-red-500 text-white font-extrabold text-xl rounded-2xl shadow-lg hover:shadow-orange-500/40 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-center"
                            >
                                {isGrading ? "Grading..." : "Submit for Grading"}
                            </button>
                        </form>
                    </>
                )}

                {currentPhase >= 3 && aiFeedback && (
                    <>
                        <span className="text-xs font-black text-orange-400 uppercase tracking-[0.2em] block mb-4">Level 3: Results</span>
                        <div className={`p-6 rounded-2xl border-2 mb-6 ${aiFeedback.passed ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-900 dark:text-green-200' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'}`}>
                            <h3 className="text-2xl font-black mb-2 flex items-center gap-2">
                                {aiFeedback.passed ? '✅ Passed!' : '❌ Incorrect Usage'}
                            </h3>
                            <p className="text-lg font-medium leading-relaxed">
                                {aiFeedback.feedback}
                            </p>
                        </div>
                        <button
                            onClick={() => handleAnswer(aiFeedback.passed ? currentItem.word : 'incorrect')}
                            className="w-full py-4 px-8 bg-slate-800 text-white font-extrabold text-xl rounded-2xl shadow-lg hover:shadow-slate-500/40 transition-all active:scale-95 text-center"
                        >
                            Continue
                        </button>
                    </>
                )}

                {feedback && (
                    <div className={`absolute inset-0 z-10 flex items-center justify-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm transition-all duration-300`}>
                        <span className={`text-4xl font-black px-8 py-4 rounded-3xl shadow-2xl transform scale-110 ${feedback.includes('Correct') ? 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 rotate-[-2deg]' : 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rotate-[2deg]'}`}>
                            {feedback}
                        </span>
                    </div>
                )}
            </div>

            {currentPhase === 1 || currentPhase === 2 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                    {(currentPhase === 2 && gptQuestion ? gptQuestion.options : options).map((opt, idx) => (
                        <button
                            key={idx}
                            onClick={() => handleAnswer(opt)}
                            disabled={!!feedback || isGenerating}
                            className="py-6 px-8 text-xl font-bold tracking-tight text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-2xl hover:border-orange-400 dark:hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-slate-600 hover:text-orange-700 dark:hover:text-white transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
                        >
                            <span className="relative z-10">{opt}</span>
                        </button>
                    ))}
                </div>
            ) : null}

            {(currentPhase === 1 || currentPhase === 2) && (
                <div className="mt-8 flex justify-center">
                    <button
                        onClick={handleAbandonRun}
                        className="px-6 py-2 mt-4 bg-slate-800/60 border border-red-900/50 text-red-400 hover:bg-red-900/40 hover:text-red-300 rounded-full text-sm font-medium transition-all shadow-sm"
                    >
                        Abandon Training
                    </button>
                </div>
            )}
        </div>
    );
}
