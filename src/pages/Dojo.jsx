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

const callDojoAI = async (prompt) => {
    try {
        const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY_DOJO);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        return await result.response.text();
    } catch (error) {
        console.warn("Dojo AI Attempt 1 failed:", error.message);

        const errorMsg = error.message?.toLowerCase() || '';
        const isQuotaError = error.status === 429 || errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('too many requests');

        if (isQuotaError) {
            console.log("Quota exhausted. Switching to secondary fallback key (DOJO_2)...");
            try {
                const fallbackGenAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY_DOJO_2);
                const fallbackModel = fallbackGenAI.getGenerativeModel({ model: "gemini-2.5-flash" });
                const fallbackResult = await fallbackModel.generateContent(prompt);
                return await fallbackResult.response.text();
            } catch (fallbackError) {
                console.error("Dojo AI Attempt 2 failed:", fallbackError);
                throw new Error("The Dojo AI is currently resting to regain focus. Please try again in a moment.");
            }
        }

        throw new Error("The Dojo AI is currently resting to regain focus. Please try again in a moment.");
    }
};

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
        return saved ? JSON.parse(saved).currentPhase : 0;
    });
    const [survivingWords, setSurvivingWords] = useState(() => {
        const saved = localStorage.getItem('dojoSession');
        return saved ? JSON.parse(saved).survivingWords : [];
    });
    const [options, setOptions] = useState([]);
    const [isFinished, setIsFinished] = useState(false);
    const [textAnswer, setTextAnswer] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [trainedCount, setTrainedCount] = useState(0);

    // Phase 0 encoding state
    const [isRevealed, setIsRevealed] = useState(false);

    // AI Variables (Level 1)
    const [phase1Sentence, setPhase1Sentence] = useState("");
    const [isGeneratingPhase1, setIsGeneratingPhase1] = useState(false);
    const [timer, setTimer] = useState(15);

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
                const cooldownTime = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

                const { data, error } = await supabase
                    .from('user_vocabulary')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .lt('mastery_level', 4) // Exclude fully Mastered words
                    .or('last_practiced.is.null,last_practiced.lte.' + cooldownTime) // SRS cooldown logic
                    .order('last_practiced', { ascending: true, nullsFirst: true }) // Oldest first, prioritizing unpracticed
                    .limit(5);

                if (!data || data.length === 0) {
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
            const prompt = `You are an expert IELTS tutor. Create a C1-level fill-in-the-blank sentence for the target word '${targetWord}'. Replace the target word in the sentence with '______'. Generate 3 incorrect but grammatically plausible distractors. Return STRICTLY a JSON object with this exact structure: {"sentence": "...", "options": ["distractor1", "${targetWord}", "distractor2", "distractor3"], "answer": "${targetWord}"}. Do not include markdown formatting like \`\`\`json.`;

            let text = await callDojoAI(prompt);

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

    const fetchPhase1Sentence = async (targetWord) => {
        try {
            setAiError(null);
            setIsGeneratingPhase1(true);
            const prompt = `Write a single, complex IELTS Writing Task 2 sentence using the word '${targetWord}'. Replace the word '${targetWord}' with '_______'. Return ONLY the sentence, nothing else.`;

            let text = await callDojoAI(prompt);
            setPhase1Sentence(text.trim());
            setTimer(15);
        } catch (err) {
            console.error("Phase 1 AI Generation Error:", err);
            setAiError("Failed to generate combat scenario. Please try again.");
            setPhase1Sentence("Failed to load scenario.");
        } finally {
            setIsGeneratingPhase1(false);
        }
    };

    // Auto-fetch if DB naturally lands us on Phase 2
    useEffect(() => {
        if (practiceBatch.length === 0 || isFinished || currentIndex >= practiceBatch.length) return;

        const currentItem = practiceBatch[currentIndex];

        if (currentPhase === 1 && !phase1Sentence && !isGeneratingPhase1) {
            fetchPhase1Sentence(currentItem.word);
        } else if (currentPhase === 2 && !gptQuestion && !isGenerating) {
            fetchContextQuestion(currentItem.word);
        }
    }, [currentPhase, currentIndex, practiceBatch, isFinished]);

    // Timer Logic for Phase 1
    useEffect(() => {
        let interval = null;
        if (currentPhase === 1 && !isGeneratingPhase1 && timer > 0 && !feedback) {
            interval = setInterval(() => {
                setTimer(prev => prev - 1);
            }, 1000);
        } else if (timer === 0 && currentPhase === 1 && !feedback) {
            handleAnswer("TIMEOUT_FAIL");
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [currentPhase, isGeneratingPhase1, timer, feedback]);

    const handleAnswer = async (selectedWordOrEvent) => {
        let answer = selectedWordOrEvent;
        if (selectedWordOrEvent && selectedWordOrEvent.preventDefault) {
            selectedWordOrEvent.preventDefault();
            answer = textAnswer;
        }

        const currentItem = practiceBatch[currentIndex];

        let isCorrect = false;
        if (currentPhase === 1) {
            isCorrect = typeof answer === 'string' && answer.toLowerCase().trim() === currentItem.word.toLowerCase() && answer !== "TIMEOUT_FAIL";
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
            if (answer === "TIMEOUT_FAIL") {
                setFeedback(`Time's up! Correct answer: ${currentItem.word} 🧊`);
            } else {
                setFeedback(`Incorrect! Correct answer: ${currentItem.word} 🧊`);
            }
            dbNewLevel = Math.max(1, dbNewLevel - 1);
        }

        // Update Database in background
        if (session?.user?.id && currentItem?.word) {
            try {
                const payload = {
                    mastery_level: dbNewLevel || 1,
                    last_practiced: new Date().toISOString()
                };
                console.log("Sending to DB:", payload);

                await supabase
                    .from('user_vocabulary')
                    .update(payload)
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
            setPhase1Sentence("");

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
            setCurrentPhase(0);
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

            let aiText = await callDojoAI(prompt);

            let resultJson = null;

            if (aiText) {
                aiText = aiText.trim();
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
                feedback: err.message || "Failed to connect to grading server. Please try again."
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

    if (!isFinished && practiceBatch.length === 0) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <div className="bg-white dark:bg-slate-800 p-12 rounded-3xl text-center shadow-lg border border-slate-100 dark:border-slate-700 transition-colors">
                    <span className="text-6xl mb-6 block">🏆</span>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight mb-4">You are all caught up!</h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-lg max-w-lg mx-auto mb-8 leading-relaxed">
                        Incredible work. Your recently trained words are resting right now to build your long-term memory. Take a break, or read a new Article to discover more vocabulary.
                    </p>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="bg-orange-500 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-orange-600 hover:-translate-y-1 transition-all shadow-lg hover:shadow-orange-500/40"
                    >
                        Browse Articles
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

                {currentPhase === 0 && (
                    <div className="flex flex-col items-center justify-center space-y-8 py-4">
                        <span className="text-xs font-black text-blue-500 uppercase tracking-[0.2em] block mb-2">Phase 0: Memory Encoding</span>

                        <div className="flex items-center space-x-4">
                            <h2 className="text-5xl font-black text-slate-800 dark:text-white capitalize tracking-tight">
                                {currentItem.word}
                            </h2>
                            <button
                                onClick={() => {
                                    const utterance = new SpeechSynthesisUtterance(currentItem.word);
                                    utterance.lang = 'en-US';
                                    window.speechSynthesis.speak(utterance);
                                }}
                                className="p-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full hover:bg-blue-100 dark:hover:bg-slate-600 hover:text-blue-600 transition-colors shadow-sm"
                                title="Pronounce"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
                                    <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
                                    <path d="M15.932 7.757a.75.75 0 011.061 0 5.25 5.25 0 010 7.424.75.75 0 11-1.06-1.06 3.75 3.75 0 000-5.304.75.75 0 010-1.06z" />
                                </svg>
                            </button>
                        </div>

                        {!isRevealed ? (
                            <button
                                onClick={() => setIsRevealed(true)}
                                className="px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-extrabold text-xl rounded-2xl shadow-lg hover:shadow-blue-500/40 transition-all active:scale-95"
                            >
                                Reveal Meaning
                            </button>
                        ) : (
                            <div className="w-full text-left space-y-6 animate-fade-in">
                                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-700 rounded-2xl">
                                    {currentItem.category && (
                                        <span className="inline-block px-3 py-1 mb-3 text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 rounded-full uppercase tracking-wider">
                                            {currentItem.category}
                                        </span>
                                    )}
                                    <p className="text-xl font-medium text-slate-800 dark:text-slate-200 leading-relaxed mb-4">
                                        <span className="font-bold text-slate-400 text-sm block uppercase tracking-wider mb-2">Definition</span>
                                        {currentItem.definition}
                                    </p>

                                    {currentItem.context_sentence && (
                                        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                                            <span className="font-bold text-slate-400 text-sm block uppercase tracking-wider mb-2">Example Sentence</span>
                                            <div className="pl-4 border-l-4 border-indigo-500">
                                                <p className="text-lg text-slate-600 dark:text-slate-400 italic">
                                                    "{currentItem.context_sentence}"
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => {
                                        if (currentIndex + 1 < practiceBatch.length) {
                                            setCurrentIndex(prev => prev + 1);
                                            setIsRevealed(false);
                                        } else {
                                            setCurrentPhase(1);
                                            setCurrentIndex(0);
                                            setIsRevealed(false);
                                        }
                                    }}
                                    className="w-full px-8 py-4 bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white font-extrabold text-xl rounded-2xl shadow-lg hover:shadow-orange-500/40 transition-all active:scale-95 flex justify-center items-center"
                                >
                                    Next Word
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {currentPhase === 1 && (
                    <>
                        <span className="text-xs font-black text-orange-400 uppercase tracking-[0.2em] block mb-4">Phase 1: Contextual Combat</span>

                        {/* Timer Bar */}
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-3 rounded-full mb-6 overflow-hidden relative">
                            <div
                                className={`h-full transition-all duration-1000 ease-linear ${timer <= 5 ? 'bg-red-500' : 'bg-orange-500'}`}
                                style={{ width: `${(timer / 15) * 100}%` }}
                            ></div>
                        </div>

                        {aiError ? (
                            <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-6 rounded-2xl border border-red-200 dark:border-red-800 text-center mb-4">
                                <h3 className="font-bold mb-2">AI Generation Failed</h3>
                                <p className="mb-4 text-sm">{aiError}</p>
                                <button
                                    onClick={() => fetchPhase1Sentence(currentItem.word)}
                                    className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                                >
                                    Try Again
                                </button>
                            </div>
                        ) : isGeneratingPhase1 || !phase1Sentence ? (
                            <div className="flex flex-col items-center justify-center space-y-4 py-8">
                                <div className="flex items-center space-x-3 text-orange-500 animate-pulse">
                                    <div className="w-6 h-6 border-t-2 border-b-2 border-orange-500 rounded-full animate-spin"></div>
                                    <span className="font-bold">Generating combat scenario...</span>
                                </div>
                                <div className="w-full max-w-lg space-y-3">
                                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-full w-full animate-pulse"></div>
                                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-full w-5/6 mx-auto animate-pulse"></div>
                                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-full w-4/6 mx-auto animate-pulse"></div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-2xl lg:text-3xl font-medium text-slate-800 dark:text-white leading-snug italic py-4">
                                "{phase1Sentence}"
                            </p>
                        )}
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

            {(currentPhase === 0 || currentPhase === 1 || currentPhase === 2) && (
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
