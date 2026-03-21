import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { playClickSound, playQuitSound } from '../utils/playSound';
import { gradeSentence } from '../utils/aiGrader';

// SRS Date Math Utility
const calculateSRS = (currentPhase, isCorrect) => {
    const now = new Date();
    if (!isCorrect) {
        return { newPhase: 1, nextReviewDate: now.toISOString() }; // Due immediately
    }

    let newPhase = currentPhase;
    let daysToAdd = 0;

    if (currentPhase === 1) {
        newPhase = 2;
        daysToAdd = 0; // Due immediately
    } else if (currentPhase === 2) {
        newPhase = 3;
        daysToAdd = 3;
    } else if (currentPhase === 3) {
        newPhase = 4; // Mastered
        daysToAdd = 14;
    }

    const nextReview = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    return { newPhase, nextReviewDate: nextReview.toISOString() };
};

export default function Dojo({ session }) {
    const [practiceBatch, setPracticeBatch] = useState([]);
    const [masterBatch, setMasterBatch] = useState([]);
    const [originalBatchCount, setOriginalBatchCount] = useState(0);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [currentSectionIndex, setCurrentSectionIndex] = useState(1);
    const [totalSections, setTotalSections] = useState(1);
    const [currentPhase, setCurrentPhase] = useState(0);
    const [options, setOptions] = useState([]);
    const [isSessionComplete, setIsSessionComplete] = useState(false);
    const [isThresholdLocked, setIsThresholdLocked] = useState(false);

    // Phase 0 encoding state
    const [isRevealed, setIsRevealed] = useState(false);

    // Phase 3: AI Sentence Grading
    const [userSentence, setUserSentence] = useState("");
    const [isGrading, setIsGrading] = useState(false);
    const [aiFeedback, setAiFeedback] = useState(null);

    // Phase 2 Worksheet State
    const [phase2Answers, setPhase2Answers] = useState({});
    const [isSubmittingPhase2, setIsSubmittingPhase2] = useState(false);
    const [phase2Results, setPhase2Results] = useState(null);

    const [loading, setLoading] = useState(true);
    const [feedback, setFeedback] = useState("");
    const [error, setError] = useState(null);

    // Diagnostics State
    const [diagnosticStats, setDiagnosticStats] = useState(null);

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

    // Diagnostic Fetch for Empty State
    useEffect(() => {
        async function fetchDiagnostics() {
            if (!session?.user?.id) return;
            if (!loading && practiceBatch.length === 0 && !isSessionComplete) {
                try {
                    const { data, error } = await supabase
                        .from('user_vocabulary')
                        .select('mastery_level, last_practiced, next_review_date')
                        .eq('user_id', session.user.id);

                    if (data && !error) {
                        const totalWords = data.length;
                        const masteredWords = data.filter(w => w.mastery_level >= 4).length;

                        const now = new Date();
                        const cooldownWords = data.filter(w => {
                            if (w.mastery_level >= 4) return false;
                            if (!w.next_review_date) return false;
                            return new Date(w.next_review_date) > now;
                        }).length;

                        setDiagnosticStats({
                            totalWords,
                            masteredWords,
                            cooldownWords
                        });
                    }
                } catch (err) {
                    console.error("Diagnostic fetch error:", err);
                }
            }
        }
        fetchDiagnostics();
    }, [practiceBatch.length, isSessionComplete, session, loading]);

    // Auto-Save Session Progress
    useEffect(() => {
        if (practiceBatch.length === 0 && masterBatch.length === 0) return;
        if (isSessionComplete) return;

        const sessionState = {
            practiceBatch,
            masterBatch,
            originalBatchCount,
            currentIndex,
            currentSectionIndex,
            totalSections,
            currentPhase,
            phase2Answers,
            timestamp: new Date().getTime()
        };
        localStorage.setItem('dojo_session_state', JSON.stringify(sessionState));
    }, [practiceBatch, masterBatch, originalBatchCount, currentIndex, currentSectionIndex, totalSections, currentPhase, phase2Answers, isSessionComplete]);

    const loadNextBucket = (remainingWords) => {
        if (!remainingWords || remainingWords.length === 0) {
            setPracticeBatch([]);
            setMasterBatch([]);
            setIsSessionComplete(true);
            localStorage.removeItem('dojo_session_state');
            return;
        }

        const SECTION_LIMIT = 5;

        const phase1Bucket = remainingWords.filter(w => (w.mastery_level || 1) <= 1);
        const phase2Bucket = remainingWords.filter(w => w.mastery_level === 2);
        const phase3Bucket = remainingWords.filter(w => w.mastery_level === 3);

        if (phase1Bucket.length > 0) {
            setPracticeBatch(phase1Bucket.slice(0, SECTION_LIMIT));
            setCurrentPhase(0);
            setCurrentIndex(0);
            setIsRevealed(false);
        } else if (phase2Bucket.length > 0) {
            setPracticeBatch(phase2Bucket.slice(0, SECTION_LIMIT));
            setCurrentPhase(2);
            setCurrentIndex(0);
        } else if (phase3Bucket.length > 0) {
            setPracticeBatch(phase3Bucket.slice(0, SECTION_LIMIT));
            setCurrentPhase(3);
            setCurrentIndex(0);
        } else {
            // Safety catch
            setIsSessionComplete(true);
        }
    };

    // SRS Data Fetch Logic
    const fetchDojoWords = async () => {
        if (!session?.user?.id) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            // Fetch up to 50 words due for review
            const { data: fetchedWords, error } = await supabase
                .from('user_vocabulary')
                .select('*')
                .eq('user_id', session.user.id)
                .lt('mastery_level', 4)
                .lte('next_review_date', new Date().toISOString())
                .order('next_review_date', { ascending: true, nullsFirst: true })
                .limit(20);

            if (error) throw error;

            if (!fetchedWords || fetchedWords.length === 0) {
                setMasterBatch([]);
                setPracticeBatch([]);
                setIsSessionComplete(true);
            } else {
                // Phase 1 requires a minimum of 4 words to prevent process-of-elimination guessing
                const rawPhase1 = fetchedWords.filter(w => (w.mastery_level || 1) <= 1);
                const phase1 = rawPhase1.length >= 4 ? rawPhase1 : [];
                const phase2 = fetchedWords.filter(w => w.mastery_level === 2);
                const phase3 = fetchedWords.filter(w => w.mastery_level === 3);

                const sessionWords = [...phase1, ...phase2, ...phase3];

                if (sessionWords.length === 0) {
                    // Words exist but none met the minimum threshold — show the lock screen
                    setIsThresholdLocked(true);
                    setPracticeBatch([]);
                    setMasterBatch([]);
                } else {
                    setMasterBatch(sessionWords);
                    setOriginalBatchCount(sessionWords.length);
                    setTotalSections(Math.ceil(sessionWords.length / 5));
                    setCurrentSectionIndex(1);
                    loadNextBucket(sessionWords);
                }
            }
        } catch (err) {
            console.error("Error fetching Dojo data:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Initial Fetch Setup
    useEffect(() => {
        if (practiceBatch.length > 0) {
            setLoading(false);
            return;
        }

        const initializeSession = async () => {
            const savedStateStr = localStorage.getItem('dojo_session_state');
            if (savedStateStr) {
                try {
                    const savedState = JSON.parse(savedStateStr);
                    const now = new Date().getTime();
                    // 24 hours expiration safeguard
                    if (now - savedState.timestamp < 24 * 60 * 60 * 1000) {
                        setPracticeBatch(savedState.practiceBatch || []);
                        setMasterBatch(savedState.masterBatch || []);
                        setOriginalBatchCount(savedState.originalBatchCount || 0);
                        setCurrentIndex(savedState.currentIndex || 0);
                        setCurrentSectionIndex(savedState.currentSectionIndex || 1);
                        setTotalSections(savedState.totalSections || 1);
                        setCurrentPhase(savedState.currentPhase || 0);
                        setPhase2Answers(savedState.phase2Answers || {});
                        setLoading(false);
                        return; // Successfully restored!
                    } else {
                        localStorage.removeItem('dojo_session_state');
                    }
                } catch (e) {
                    console.error("Failed to parse saved Dojo session", e);
                    localStorage.removeItem('dojo_session_state');
                }
            }
            
            await fetchDojoWords();
        };

        initializeSession();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session]);

    const handleTrainAgain = async () => {
        playClickSound();
        setLoading(true);
        setIsSessionComplete(false);
        setIsThresholdLocked(false);
        setPracticeBatch([]);
        setMasterBatch([]);

        try {
            await fetchDojoWords();
        } finally {
            setLoading(false);
        }
    };

    // Generate options when current word changes (Phase 1)
    useEffect(() => {
        if (!practiceBatch || practiceBatch.length === 0 || isSessionComplete || currentIndex >= practiceBatch.length) return;
        const sessionWords = practiceBatch.map(w => w.word);
        const finalOptions = [...sessionWords].sort(() => 0.5 - Math.random());
        setOptions(finalOptions);
    }, [currentIndex, practiceBatch, isSessionComplete]);

    // Background Streak Update on Completion
    useEffect(() => {
        const updateStreak = async () => {
            if (isSessionComplete && session?.user?.id) {
                try {
                    const { error } = await supabase.rpc('update_user_streak', { user_id_param: session.user.id });
                    if (error) throw error;
                } catch (err) {
                    console.error("Failed to update streak:", err);
                }
            }
        };
        updateStreak();
    }, [isSessionComplete, session]);

    const handleAnswer = async (selectedWordOrEvent) => {
        const answer = selectedWordOrEvent;

        const currentItem = practiceBatch?.[currentIndex];
        if (!currentItem) return;

        let isCorrect = typeof answer === 'string' && answer.toLowerCase().trim() === currentItem.word.toLowerCase();

        if (answer === "TIMEOUT_FAIL") isCorrect = false;

        if (isCorrect) {
            setFeedback("Correct! 🔥");
        } else {
            if (answer === "TIMEOUT_FAIL") {
                setFeedback(`Time's up! Correct answer: ${currentItem.word} 🧊`);
            } else {
                setFeedback(`Incorrect! Correct answer: ${currentItem.word} 🧊`);
            }
        }

        // --- SRS MATH & DB UPDATE ---
        const activePhase = (currentPhase === 0) ? 1 : currentPhase;
        const srsDelta = calculateSRS(activePhase, isCorrect);

        if (session?.user?.id) {
            try {
                await supabase
                    .from('user_vocabulary')
                    .update({
                        mastery_level: srsDelta.newPhase,
                        next_review_date: srsDelta.nextReviewDate
                    })
                    .match({ user_id: session.user.id, word: currentItem.word });
            } catch (err) {
                console.error("Failed to update SRS data:", err);
            }
        }

        setTimeout(async () => {
            setFeedback("");
            setUserSentence("");
            setAiFeedback(null);

            if (currentIndex + 1 < (practiceBatch?.length || 0)) {
                setCurrentIndex(prev => prev + 1);
            } else {
                // Phase Bucket Completed
                setCurrentSectionIndex(prev => prev + 1);
                const updatedMaster = (masterBatch || []).filter(w => !(practiceBatch || []).find(p => p.id === w.id));
                setMasterBatch(updatedMaster);
                loadNextBucket(updatedMaster);
            }
        }, 1500);
    };

    const handleAbandonRun = () => {
        playQuitSound();
        setPracticeBatch([]);
        setCurrentIndex(0);
        localStorage.removeItem('dojo_session_state');
        window.location.replace('/library');
    };

    const handlePhase2BatchSubmit = async () => {
        if (isSubmittingPhase2) return;
        setIsSubmittingPhase2(true);

        const results = (practiceBatch || []).map(wordObj => {
            const userAnswer = (phase2Answers?.[wordObj.id] || '').trim().toLowerCase();
            const correct = userAnswer === wordObj.word.toLowerCase();
            return { wordObj, correct };
        });
        setPhase2Results(results);

        if (session?.user?.id) {
            try {
                for (const { wordObj, correct } of results) {
                    const srsDelta = calculateSRS(2, correct);
                    await supabase
                        .from('user_vocabulary')
                        .update({
                            mastery_level: srsDelta.newPhase,
                            next_review_date: srsDelta.nextReviewDate
                        })
                        .match({ user_id: session.user.id, word: wordObj.word });
                }
            } catch (err) {
                console.error('Phase 2 bulk SRS update failed:', err);
            }
        }

        setIsSubmittingPhase2(false);
    };

    const handlePhase2Continue = () => {
        setPhase2Results(null);
        setPhase2Answers({});
        // Clean processed words out and move to next bucket
        setCurrentSectionIndex(prev => prev + 1);
        const updatedMaster = (masterBatch || []).filter(w => !(practiceBatch || []).find(p => p.id === w.id));
        setMasterBatch(updatedMaster);
        loadNextBucket(updatedMaster);
    };

    const handleGradeSentence = async (e) => {
        e.preventDefault();
        const currentItem = practiceBatch?.[currentIndex];

        if (!currentItem) return;
        if (!userSentence.trim()) return;

        if (!userSentence.toLowerCase().includes(currentItem.word.toLowerCase())) {
            setAiFeedback({
                isCorrect: false,
                feedback: "You must include the target word in your sentence.",
                improvedVersion: null
            });
            return;
        }

        try {
            setIsGrading(true);
            const result = await gradeSentence(
                currentItem.word,
                currentItem.definition || '',
                userSentence
            );
            setAiFeedback(result);
        } catch (err) {
            console.error("Sentence grading error:", err);
            setAiFeedback({
                isCorrect: false,
                feedback: err.message || "Failed to connect to grading server. Please try again.",
                improvedVersion: null
            });
        } finally {
            setIsGrading(false);
        }
    };

    const handlePhase3Continue = async (isCorrect) => {
        playClickSound();
        const currentItem = practiceBatch?.[currentIndex];
        if (!currentItem) return;

        const srsDelta = calculateSRS(3, isCorrect);

        if (session?.user?.id) {
            try {
                await supabase
                    .from('user_vocabulary')
                    .update({
                        mastery_level: srsDelta.newPhase,
                        next_review_date: srsDelta.nextReviewDate
                    })
                    .match({ user_id: session.user.id, word: currentItem.word });
            } catch (err) {
                console.error("Failed to update Phase 3 SRS data:", err);
            }
        }

        setUserSentence('');
        setAiFeedback(null);

        if (currentIndex + 1 < (practiceBatch?.length || 0)) {
            setCurrentIndex(prev => prev + 1);
        } else {
            setCurrentSectionIndex(prev => prev + 1);
            const updatedMaster = (masterBatch || []).filter(w => !(practiceBatch || []).find(p => p.id === w.id));
            setMasterBatch(updatedMaster);
            loadNextBucket(updatedMaster);
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

    if (isThresholdLocked) {
        return (
            <div className="max-w-4xl mx-auto p-6 min-h-[70vh] flex items-center justify-center">
                <div className="bg-white dark:bg-slate-800 p-12 rounded-3xl text-center shadow-lg border border-slate-100 dark:border-slate-700 w-full max-w-md transition-colors">
                    <span className="text-6xl mb-6 block">🔒</span>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight mb-3">
                        Not Enough Words to Train
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-base leading-relaxed mb-8">
                        You need at least <span className="font-black text-orange-500">4 due words</span> to initiate a training sequence. Head to the Library and extract more vocabulary to unlock the Dojo.
                    </p>
                    <button
                        onClick={() => { playQuitSound(); window.location.href = '/library'; }}
                        className="bg-orange-500 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-orange-600 hover:-translate-y-1 transition-all shadow-lg hover:shadow-orange-500/40 w-full"
                    >
                        Go to Library →
                    </button>
                </div>
            </div>
        );
    }

    if (isSessionComplete) {

        return (
            <div className="max-w-4xl mx-auto p-6 min-h-[70vh] flex items-center justify-center">
                <div className="bg-slate-900 p-12 rounded-3xl text-center shadow-2xl shadow-indigo-900/40 border border-slate-700 w-full max-w-md transform transition-all hover:scale-[1.01]">
                    <span className="text-6xl mb-6 block text-center animate-pulse drop-shadow-[0_0_15px_rgba(56,189,248,0.5)]">✨</span>
                    <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Training Session Complete</h2>
                    <p className="text-slate-400 font-medium text-base mb-8">Your neural pathways have been strengthened.</p>

                    <div className="space-y-4">
                        <button
                            onClick={handleTrainAgain}
                            className="px-8 py-4 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-lg rounded-2xl shadow-lg shadow-indigo-900/50 transition-all hover:-translate-y-1"
                        >
                            Start Another Session
                        </button>
                        <button
                            onClick={() => { playQuitSound(); window.location.href = '/library'; }}
                            className="px-8 py-4 w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-lg rounded-2xl border border-slate-700 transition-all"
                        >
                            Return to Library
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!isSessionComplete && (!practiceBatch || practiceBatch.length === 0)) {
        return (
            <div className="max-w-4xl mx-auto p-6 flex flex-col items-center justify-center min-h-[70vh]">
                <div className="bg-slate-900/80 backdrop-blur-xl p-10 md:p-12 rounded-3xl text-center shadow-2xl shadow-black/50 border border-slate-800 transition-all w-full max-w-md">
                    <span className="text-6xl mb-6 block drop-shadow-2xl">🏆</span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-3">
                        {!diagnosticStats || diagnosticStats.totalWords === 0 
                            ? "Your Dojo is Empty" 
                            : diagnosticStats.masteredWords === diagnosticStats.totalWords 
                                ? "Complete Mastery!" 
                                : "You are all caught up!"}
                    </h2>
                    <p className="text-slate-400 text-sm leading-relaxed max-w-sm mx-auto mb-2">
                        {!diagnosticStats || diagnosticStats.totalWords === 0 
                            ? "You haven't added any words to your Vault yet. Head over to the reading section to discover and save your first vocabulary words."
                            : diagnosticStats.masteredWords === diagnosticStats.totalWords 
                                ? "Incredible work. You have fully mastered every single word in your Vault! Read a new Article to find more challenging vocabulary."
                                : "Your words are currently resting to build your long-term memory. Take a break, or read a new Article to add more words to your queue."}
                    </p>

                    {diagnosticStats && (
                        <div className="grid grid-cols-2 gap-4 w-full mt-6 mb-8">
                            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 flex flex-col items-center justify-center transition-all hover:bg-slate-800/60 shadow-inner">
                                <span className="text-2xl font-black text-slate-300">{diagnosticStats.totalWords}</span>
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1 text-center leading-tight">Total Words</span>
                            </div>
                            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 flex flex-col items-center justify-center transition-all hover:bg-slate-800/60 shadow-inner">
                                <span className="text-2xl font-black text-emerald-400">{diagnosticStats.masteredWords}</span>
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1 text-center leading-tight">Mastered</span>
                            </div>
                            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 flex flex-col items-center justify-center transition-all hover:bg-slate-800/60 shadow-inner">
                                <span className="text-2xl font-black text-amber-400">{diagnosticStats.cooldownWords}</span>
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1 text-center leading-tight">On Cooldown</span>
                            </div>
                            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 flex flex-col items-center justify-center transition-all hover:bg-slate-800/60 shadow-inner">
                                <span className="text-2xl font-black text-orange-500">0</span>
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1 text-center leading-tight">Playable Now</span>
                            </div>
                        </div>
                    )}
                    
                    <button
                        onClick={() => { playClickSound(); window.location.href = '/'; }}
                        className="w-full bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 hover:-translate-y-0.5"
                    >
                        Browse Articles
                    </button>
                </div>
            </div>
        );
    }

    // --- DEFENSIVE RENDERING GUARD ---
    // Prevents crashing if the component tries to render before state hooks have resolved the array
    if (!practiceBatch || practiceBatch.length === 0) return null;

    if (!practiceBatch[currentIndex]) {
        return (
            <div className="max-w-4xl mx-auto p-6 flex flex-col items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
                <p className="text-orange-600 dark:text-orange-400 font-bold animate-pulse">Initializing Dojo Session...</p>
            </div>
        );
    }

    const currentItem = practiceBatch[currentIndex];
    
    // Debug log requested by user to trace the missing word_connections
    console.log("FLASHCARD RENDER - Current Word Data:", currentItem);

    return (
        <div className="max-w-4xl mx-auto p-6 font-sans">
            {/* Session Progress Bar */}
            {practiceBatch && practiceBatch.length > 0 && (
                <div className="mb-8 px-4">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Section Progress</span>
                        <span className="text-sm font-bold text-slate-400">
                            Word {currentIndex + 1} of {practiceBatch.length}
                        </span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${Math.min(100, ((currentIndex + 1) / practiceBatch.length) * 100)}%` }}
                        />
                    </div>
                </div>
            )}

            <div className="bg-surface p-6 sm:p-10 rounded-3xl sm:rounded-[2.5rem] shadow-xl border border-border mb-8 max-w-2xl mx-auto relative overflow-hidden group transition-colors duration-300 h-[80vh] sm:h-auto min-h-[500px] flex flex-col">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-400 to-red-500 opacity-80 group-hover:opacity-100 transition-opacity"></div>

                {currentPhase === 0 && (
                    <div className="flex flex-col flex-1 w-full h-full overflow-hidden">
                        {/* Header Zone */}
                        <div className="flex-shrink-0 flex flex-col items-center mb-4 sm:mb-6 pt-2">
                            <span className="text-xs font-black text-blue-500 uppercase tracking-[0.2em] block mb-2">Phase 0: Memory Encoding</span>

                            <div className="flex flex-row items-center justify-center w-full gap-3 px-2 sm:px-8">
                                <h2 className="flex-1 min-w-0 text-2xl sm:text-5xl font-black text-slate-800 dark:text-white capitalize tracking-tight text-center break-words hyphens-auto">
                                    {currentItem.word}
                                </h2>
                                <button
                                    onClick={() => {
                                        const utterance = new SpeechSynthesisUtterance(currentItem.word);
                                        utterance.lang = 'en-US';
                                        window.speechSynthesis.speak(utterance);
                                    }}
                                    className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full hover:bg-blue-100 dark:hover:bg-slate-600 hover:text-blue-600 transition-colors shadow-sm"
                                    title="Pronounce"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
                                        <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
                                        <path d="M15.932 7.757a.75.75 0 011.061 0 5.25 5.25 0 010 7.424.75.75 0 11-1.06-1.06 3.75 3.75 0 000-5.304.75.75 0 010-1.06z" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Body Zone (Scrollable) */}
                        <div className="flex-1 overflow-y-auto w-full px-1 sm:px-4 custom-scrollbar">
                            {!isRevealed ? (
                                <div className="h-full flex items-center justify-center">
                                    <button
                                        onClick={() => setIsRevealed(true)}
                                        className="px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-extrabold text-xl rounded-2xl shadow-lg hover:shadow-blue-500/40 transition-all active:scale-95"
                                    >
                                        Reveal Meaning
                                    </button>
                                </div>
                            ) : (
                                <div className="w-full text-left space-y-4 sm:space-y-6 animate-fade-in pb-4">
                                    <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-700 rounded-2xl">
                                        {currentItem.category && (
                                            <span className="inline-block px-2 py-1 sm:px-3 sm:py-1 mb-2 sm:mb-3 text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 rounded-full uppercase tracking-wider">
                                                {currentItem.category}
                                            </span>
                                        )}
                                        <p className="text-lg sm:text-xl font-medium text-slate-800 dark:text-slate-200 leading-relaxed mb-3 sm:mb-4">
                                            <span className="font-bold text-slate-400 text-[10px] sm:text-sm block uppercase tracking-wider mb-1 sm:mb-2">Definition</span>
                                            {currentItem.definition}
                                        </p>

                                        {currentItem.context_sentence && (
                                            <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-slate-200 dark:border-slate-700">
                                                <span className="font-bold text-slate-400 text-[10px] sm:text-sm block uppercase tracking-wider mb-2">Example Sentence</span>
                                                <div className="pl-3 sm:pl-4 border-l-4 border-indigo-500">
                                                    <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 italic">
                                                        "{currentItem.context_sentence}"
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* EXTRACTION HOOKS INJECTION: Phase 0 Memory Encoding */}
                                        {currentItem.word_connections && (
                                            <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-slate-200 dark:border-slate-700">
                                                <span className="font-bold text-slate-400 text-[10px] sm:text-sm block uppercase tracking-wider mb-2 sm:mb-3">Memory Hooks</span>
                                                <div className="flex flex-col gap-2 sm:gap-3">
                                                    {currentItem.word_connections.synonyms?.length > 0 && (
                                                        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
                                                            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mr-1">Synonyms:</span>
                                                            {currentItem.word_connections.synonyms.map(syn => (
                                                                <span key={syn} className="px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-medium rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                                                    {syn}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {/* NUCLEAR LOCK: Only render if we can prove the phase is >= 3 */}
                                                    {Number(currentPhase) >= 3 && currentItem.word_connections?.collocations?.length > 0 ? (
                                                        <div className="mt-3 sm:mt-6 pt-3 sm:pt-6 border-t border-slate-700/50">
                                                            <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 mb-2 sm:mb-3 uppercase tracking-wider">Collocations</h4>
                                                            <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                                                {currentItem.word_connections.collocations.map((collocation, idx) => (
                                                                    <span key={idx} className="px-2 py-0.5 sm:px-3 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 break-words">
                                                                        {collocation}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Zone (Action Buttons) */}
                        {isRevealed && (
                            <div className="flex-shrink-0 w-full pt-4 mt-2 border-t border-slate-700/50">
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
                                    className="w-full px-8 py-3 sm:py-4 bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white font-extrabold text-lg sm:text-xl rounded-2xl shadow-lg hover:shadow-orange-500/40 transition-all active:scale-95 flex justify-center items-center"
                                >
                                    Next Word
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {currentPhase === 1 && (
                    <>
                        <span className="text-xs font-black text-blue-500 uppercase tracking-[0.2em] block mb-4">Phase 1: Definition Match</span>

                        <div className="flex flex-col items-center justify-center space-y-6 py-4">
                            <p className="text-xl lg:text-2xl font-medium text-slate-800 dark:text-slate-200 leading-relaxed text-center max-w-lg">
                                "{currentItem.definition}"
                            </p>
                            {currentItem.category && (
                                <span className="px-3 py-1 text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 rounded-full uppercase tracking-wider">
                                    {currentItem.category}
                                </span>
                            )}

                            {/* EXTRACTION HOOKS INJECTION: Phase 1 Definition Match */}
                            {currentItem.word_connections && (
                                <div className="mt-2 w-full max-w-lg">
                                    <div className="flex flex-col items-center justify-center gap-3">
                                        {currentItem.word_connections.synonyms?.length > 0 && (
                                            <div className="flex items-center justify-center flex-wrap gap-2">
                                                {currentItem.word_connections.synonyms.map(syn => (
                                                    <span key={syn} className="px-2.5 py-1 text-xs font-medium rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                                        {syn}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {/* NUCLEAR LOCK: Only render if we can prove the phase is >= 3 */}
                                        {Number(currentPhase) >= 3 && currentItem.word_connections?.collocations?.length > 0 ? (
                                            <div className="mt-6 pt-6 border-t border-slate-700/50 w-full text-left">
                                                <h4 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">Collocations</h4>
                                                <div className="flex flex-wrap gap-2 justify-center">
                                                    {currentItem.word_connections.collocations.map((collocation, idx) => (
                                                        <span key={idx} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 break-words">
                                                            {collocation}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {currentPhase === 2 && (
                    <div className="flex flex-col gap-0">
                        <span className="text-xs font-black text-orange-400 uppercase tracking-[0.2em] block mb-5">Phase 2: Gap-Fill Worksheet</span>

                        {/* Results view after submission */}
                        {phase2Results ? (
                            <div className="flex flex-col gap-4">
                                <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-1">Results</p>
                                {phase2Results.map(({ wordObj, correct }) => (
                                    <div
                                        key={wordObj.id}
                                        className={`flex flex-col gap-3 p-4 rounded-2xl border-2 transition-all ${correct
                                            ? 'border-green-600/40 bg-green-900/20'
                                            : 'border-red-600/40 bg-red-900/20'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-black text-base mb-0.5 ${correct ? 'text-green-400' : 'text-red-400'}`}>
                                                    {correct ? '✅' : '❌'} {wordObj.word}
                                                </p>
                                                <p className="text-slate-400 text-xs">
                                                    Your answer: <span className="font-bold text-slate-300">{(phase2Answers[wordObj.id] || '').trim() || '(blank)'}</span>
                                                </p>
                                            </div>
                                            <span className={`text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap ${correct ? 'bg-green-700/40 text-green-300' : 'bg-red-700/40 text-red-300'
                                                }`}>
                                                {correct ? 'Phase 3 →' : 'Back to Phase 1'}
                                            </span>
                                        </div>

                                        {/* Phase 2 Memory Hooks Reinforcement */}
                                        {wordObj.word_connections && (
                                            <div className="w-full mt-3 pt-3 border-t border-slate-700/50 flex flex-col gap-2">
                                                {wordObj.word_connections.wordFamily && (
                                                    <div className="flex flex-col mb-1">
                                                        <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Word Family</span>
                                                        <p className="border-l-2 border-indigo-500/50 pl-3 py-1 text-sm text-slate-400 italic">
                                                            {wordObj.word_connections.wordFamily}
                                                        </p>
                                                    </div>
                                                )}
                                                {/* NUCLEAR LOCK: Only render if we can prove the phase is >= 3 */}
                                                {Number(currentPhase) >= 3 && wordObj.word_connections?.collocations?.length > 0 ? (
                                                    <div className="mt-6 pt-6 border-t border-slate-700/50">
                                                        <h4 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">Collocations</h4>
                                                        <div className="flex flex-wrap gap-2">
                                                            {wordObj.word_connections.collocations.map((collocation, idx) => (
                                                                <span key={idx} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 break-words">
                                                                    {collocation}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <button
                                    onClick={() => { playClickSound(); handlePhase2Continue(); }}
                                    className="mt-3 w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-extrabold text-lg rounded-2xl shadow-lg hover:shadow-orange-500/40 transition-all active:scale-95"
                                >
                                    Continue to Phase 3 →
                                </button>
                            </div>
                        ) : (
                            /* Worksheet view */
                            <div className="flex flex-col gap-5">
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    Fill in the blank with the correct word for each sentence.
                                </p>

                                {practiceBatch.map((wordObj, idx) => {
                                    // Escape special regex chars in the word, then replace case-insensitively
                                    const escapedWord = wordObj.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                    const gapRegex = new RegExp(`\\b${escapedWord}\\b`, 'gi');

                                    const BLANK = '[ _____ ]';
                                    let displayContext = wordObj.context
                                        ? wordObj.context.replace(gapRegex, BLANK)
                                        : '';

                                    // Fallback: if context was empty or replacement didn't fire (word not found)
                                    const isFallback = !displayContext || displayContext === wordObj.context;
                                    if (isFallback) {
                                        displayContext = `Definition: ${wordObj.definition || 'No definition available.'}`;
                                    }

                                    // Split around the blank so we can style it as a highlighted span
                                    const parts = displayContext.split(BLANK);
                                    const hasBlank = parts.length > 1;

                                    return (
                                        <div key={wordObj.id} className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 flex flex-col gap-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">#{idx + 1}</span>
                                                {isFallback && (
                                                    <span className="text-xs font-semibold text-amber-500/80 bg-amber-900/20 border border-amber-700/30 px-2 py-0.5 rounded-full">
                                                        Definition clue
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-lg text-slate-200 leading-relaxed font-medium">
                                                {hasBlank ? (
                                                    <>
                                                        {parts[0]}
                                                        <span className="inline-block bg-cyan-900/40 border-b-2 border-cyan-400 text-cyan-300 font-black px-2 mx-1 rounded-sm tracking-widest">
                                                            _____
                                                        </span>
                                                        {parts.slice(1).join(BLANK)}
                                                    </>
                                                ) : (
                                                    <span className="italic">{displayContext}</span>
                                                )}
                                            </p>
                                            <input
                                                type="text"
                                                value={phase2Answers[wordObj.id] || ''}
                                                onChange={e => setPhase2Answers(prev => ({ ...prev, [wordObj.id]: e.target.value }))}
                                                placeholder="Type the missing word..."
                                                disabled={isSubmittingPhase2}
                                                className="w-full bg-slate-900 border-b-2 border-cyan-500 focus:border-orange-400 text-white px-3 py-2 outline-none rounded-t-lg transition-colors placeholder:text-slate-600 text-base font-semibold"
                                            />
                                        </div>
                                    );
                                })}

                                <button
                                    onClick={() => { playClickSound(); handlePhase2BatchSubmit(); }}
                                    disabled={isSubmittingPhase2}
                                    className="mt-2 w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-extrabold text-lg rounded-2xl shadow-lg hover:shadow-orange-500/40 transition-all active:scale-95 flex items-center justify-center gap-3"
                                >
                                    {isSubmittingPhase2 ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                            </svg>
                                            <span>Grading...</span>
                                        </>
                                    ) : (
                                        <span>Submit Phase 2 Worksheet ✏️</span>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {currentPhase === 3 && !aiFeedback && (
                    <div className="flex flex-col gap-4">
                        <span className="text-xs font-black text-orange-400 uppercase tracking-[0.2em] block mb-2">Phase 3: Active Production</span>
                        <p className="text-xl font-medium text-slate-700 dark:text-white leading-snug mb-1">
                            Write an IELTS-style sentence using the word: <span className="font-black text-blue-600 dark:text-blue-400 capitalize">'{currentItem.word}'</span>
                        </p>

                        {/* Phase 3 Memory Hooks Reinforcement */}
                        {currentItem.word_connections?.collocations?.length > 0 && (
                            <div className="mb-4">
                                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-2">💡 Suggested Usage (Collocations)</span>
                                <div className="flex flex-wrap gap-2">
                                    {currentItem.word_connections.collocations.map((col, i) => (
                                        <span key={i} className="px-2.5 py-1 text-xs font-medium rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                            {col}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleGradeSentence} className="flex flex-col gap-4">
                            <textarea
                                value={userSentence}
                                onChange={(e) => setUserSentence(e.target.value)}
                                placeholder="Type your sentence here..."
                                disabled={isGrading}
                                rows={4}
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
                    </div>
                )}

                {currentPhase === 3 && aiFeedback && (
                    <div className="flex flex-col gap-4">
                        <span className="text-xs font-black text-orange-400 uppercase tracking-[0.2em] block mb-2">Phase 3: Results</span>

                        {/* Feedback Card */}
                        <div className={`p-6 rounded-2xl border-2 mb-2 transition-all ${aiFeedback.isCorrect
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-400 dark:border-green-700 text-green-900 dark:text-green-200'
                            : 'bg-red-50 dark:bg-red-900/20 border-red-400 dark:border-red-700 text-red-900 dark:text-red-200'
                            }`}>
                            <h3 className="text-2xl font-black mb-3 flex items-center gap-2">
                                {aiFeedback.isCorrect ? '✅ IELTS Band 9 Quality!' : '❌ Needs Improvement'}
                            </h3>
                            <p className="text-lg font-medium leading-relaxed">
                                {aiFeedback.feedback}
                            </p>
                            {aiFeedback.improvedVersion && (
                                <div className={`mt-5 p-4 rounded-xl border ${aiFeedback.isCorrect
                                    ? 'bg-green-100/60 dark:bg-green-950/50 border-green-300 dark:border-green-800'
                                    : 'bg-red-100/60 dark:bg-red-950/50 border-red-300 dark:border-red-800'
                                    }`}>
                                    <span className="text-xs font-black uppercase tracking-widest block mb-2 opacity-60">
                                        {aiFeedback.isCorrect ? '✨ Band-9 Version' : '💡 Corrected Version'}
                                    </span>
                                    <p className="italic font-semibold text-slate-800 dark:text-slate-100 leading-relaxed">
                                        "{aiFeedback.improvedVersion}"
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        {aiFeedback.isCorrect ? (
                            <button
                                onClick={() => handlePhase3Continue(true)}
                                className="w-full py-4 px-8 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-extrabold text-xl rounded-2xl shadow-lg hover:shadow-green-500/40 transition-all active:scale-95 text-center"
                            >
                                Continue → Phase 4 Mastery 🏆
                            </button>
                        ) : (
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => {
                                        playClickSound();
                                        setAiFeedback(null);
                                        setUserSentence('');
                                    }}
                                    className="w-full py-4 px-8 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-extrabold text-xl rounded-2xl shadow-lg transition-all active:scale-95 text-center"
                                >
                                    Try Again ↺
                                </button>
                                <button
                                    onClick={() => handlePhase3Continue(false)}
                                    className="w-full py-3 px-8 bg-transparent border border-slate-600 hover:border-red-500 text-slate-400 hover:text-red-400 font-bold text-sm rounded-2xl transition-all active:scale-95 text-center"
                                >
                                    Skip &amp; Drop to Phase 1
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {feedback && (
                    <div className={`absolute inset-0 z-10 flex items-center justify-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm transition-all duration-300`}>
                        <span className={`text-4xl font-black px-8 py-4 rounded-3xl shadow-2xl border transform scale-110 ${feedback.includes('Correct')
                            ? 'bg-green-900/80 border-green-500 text-green-200 rotate-[-2deg]'
                            : 'bg-red-950/80 border border-red-600 text-red-200 rotate-[2deg]'
                            }`}>
                            {feedback}
                        </span>
                    </div>
                )}
            </div>

            {currentPhase === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                    {options.map((opt, idx) => (
                        <button
                            key={idx}
                            onClick={() => { playClickSound(); handleAnswer(opt); }}
                            disabled={!!feedback}
                            className="py-6 px-8 text-xl font-bold tracking-tight text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-2xl hover:border-orange-400 dark:hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-slate-600 hover:text-orange-700 dark:hover:text-white transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
                        >
                            <span className="relative z-10">{opt}</span>
                        </button>
                    ))}
                </div>
            )}

            {(currentPhase >= 0 && currentPhase <= 3) && (
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
