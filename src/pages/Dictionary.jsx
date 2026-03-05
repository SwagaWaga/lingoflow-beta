import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import AchievementsBoard from '../components/AchievementsBoard';
import { useAccent } from '../context/AccentContext';

export default function Dictionary({ session, dailyStreak = 0 }) {
    const { preferredAccent } = useAccent();
    const [vaultWords, setVaultWords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [powerScore, setPowerScore] = useState(0);
    const [error, setError] = useState(null);
    const [editingWord, setEditingWord] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const audioRef = useRef(null);

    // Pause audio when leaving the Dictionary
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
        };
    }, []);

    // Helper for clean TTS execution
    const triggerTTS = (text, lang) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;

        // Ensure browser has loaded voice options and pick the best regional match
        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find(v => v.lang === lang) || voices.find(v => v.lang.startsWith(lang));
        if (voice) {
            utterance.voice = voice;
        }

        window.speechSynthesis.speak(utterance);
    };

    const handlePlayAudio = async (wordText) => {
        window.speechSynthesis.cancel();
        // Ensure we read the exact key saved by the Navbar
        const currentAccent = localStorage.getItem('accent') || 'US';
        const accentMap = { 'US': 'us', 'UK': 'uk', 'AU': 'au' };
        const ttsLangMap = { 'US': 'en-US', 'UK': 'en-GB', 'AU': 'en-AU' };
        try {
            const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${wordText}`);
            const data = await res.json();
            const phonetics = data[0]?.phonetics || [];
            // Look ONLY for the exact requested accent
            const targetAudio = phonetics.find(p => p.audio && p.audio.includes(`-${accentMap[currentAccent]}.mp3`))?.audio;

            if (targetAudio) {
                // Play the exact human match
                if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
                audioRef.current = new Audio(targetAudio);
                audioRef.current.play().catch(e => console.error("Audio error:", e));
            } else {
                // Force the robot to use the requested accent
                triggerTTS(wordText, ttsLangMap[currentAccent]);
            }
        } catch (error) {
            // If API completely fails, still use the correct robot accent
            triggerTTS(wordText, ttsLangMap[currentAccent]);
        }
    };

    useEffect(() => {
        async function fetchVocabulary() {
            if (!session?.user?.id) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const { data, error } = await supabase
                    .from('user_vocabulary')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .order('last_practiced', { ascending: false });

                if (error) throw error;

                setVaultWords(data || []);

                // Calculate power score based on mastery level
                let totalScore = 0;
                (data || []).forEach(wordObj => {
                    const level = wordObj.mastery_level || 1;
                    if (level === 1) totalScore += 1;
                    else if (level === 2) totalScore += 3;
                    else if (level === 3) totalScore += 5;
                    else if (level >= 4) totalScore += 10;
                });
                setPowerScore(totalScore);

            } catch (err) {
                console.error("Error fetching vocabulary vault:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        fetchVocabulary();
    }, [session]);

    const getEvolutionStage = (level = 1) => {
        if (level === 1) return { emoji: '🌱', title: 'Seed', color: 'bg-green-100 text-green-800 border-green-200' };
        if (level === 2) return { emoji: '🌿', title: 'Growing', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
        if (level === 3) return { emoji: '🌳', title: 'Strong', color: 'bg-teal-100 text-teal-800 border-teal-200' };
        if (level >= 4) return { emoji: '🔥', title: 'Mastered', color: 'bg-orange-100 text-orange-800 border-orange-200' };
        return { emoji: '🌱', title: 'Seed', color: 'bg-green-100 text-green-800 border-green-200' };
    };

    const calculateAcademicRank = (academicCount) => {
        if (academicCount < 25) return { title: "Initiate", current: academicCount, next: 25, barColor: "bg-gray-400", textColor: "text-gray-600" };
        if (academicCount < 75) return { title: "Novice Scholar", current: academicCount, next: 75, barColor: "bg-amber-600", textColor: "text-amber-700" };
        if (academicCount < 150) return { title: "Undergraduate", current: academicCount, next: 150, barColor: "bg-slate-400", textColor: "text-slate-600" };
        if (academicCount < 300) return { title: "Graduate Researcher", current: academicCount, next: 300, barColor: "bg-yellow-400", textColor: "text-yellow-600" };
        if (academicCount < 500) return { title: "Doctoral Candidate", current: academicCount, next: 500, barColor: "bg-emerald-500", textColor: "text-emerald-600" };
        if (academicCount < 750) return { title: "Tenured Professor", current: academicCount, next: 750, barColor: "bg-blue-500", textColor: "text-blue-600" };
        if (academicCount < 1000) return { title: "Department Head", current: academicCount, next: 1000, barColor: "bg-purple-500", textColor: "text-purple-600" };
        return {
            title: "Academic Laureate",
            current: academicCount,
            next: "MAX",
            barColor: "bg-gradient-to-r from-red-500 via-yellow-500 to-purple-500 bg-[length:200%_auto] animate-pulse",
            textColor: "text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-purple-500"
        };
    };

    const calculateDNAStats = (words) => {
        const stats = {
            Academic: 0,
            Technical: 0,
            Informal: 0,
            Advanced: 0,
            Basic: 0
        };

        words.forEach(word => {
            const dna = word.dna_type || 'Basic';
            if (stats[dna] !== undefined) {
                stats[dna]++;
            } else {
                stats.Basic++;
            }
        });

        return stats;
    };

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto p-6 flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-6xl mx-auto p-6 text-center">
                <div className="bg-red-50 text-red-700 p-6 rounded-2xl border border-red-200">
                    <h2 className="text-xl font-bold mb-2">Failed to load Dictionary</h2>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    const dnaStats = calculateDNAStats(vaultWords);
    const academicWordCount = vaultWords.filter(w => w.dna_type === 'Academic').length;
    const currentRank = calculateAcademicRank(academicWordCount);
    // Handle "MAX" state
    const rankProgressPercentage = currentRank.next === "MAX"
        ? 100
        : (currentRank.current / currentRank.next) * 100;

    const dnaCategories = [
        { key: 'Academic', color: 'bg-blue-500', bg: 'bg-blue-100', icon: '🎓' },
        { key: 'Technical', color: 'bg-purple-500', bg: 'bg-purple-100', icon: '⚙️' },
        { key: 'Advanced', color: 'bg-red-500', bg: 'bg-red-100', icon: '🔥' },
        { key: 'Informal', color: 'bg-yellow-400', bg: 'bg-yellow-100', icon: '🗣️' },
        { key: 'Basic', color: 'bg-green-500', bg: 'bg-green-100', icon: '🌱' },
    ];

    const handleSaveChanges = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const { error: updateError } = await supabase
                .from('user_vocabulary')
                .update({
                    word: editingWord.word,
                    definition: editingWord.definition,
                    dna_type: editingWord.dna_type || 'Basic'
                })
                .match({ id: editingWord.id });

            if (updateError) throw updateError;

            setVaultWords(prev => prev.map(w => w.id === editingWord.id ? editingWord : w));
            setEditingWord(null);
        } catch (err) {
            console.error("Error updating word:", err);
            alert("Failed to update word details.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-6 font-sans">
            {/* Gamified Banner */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl md:rounded-3xl p-5 md:p-8 mb-6 md:mb-8 text-white shadow-xl">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 md:gap-6">
                    <div className="flex-1 min-w-0">
                        <h1 className="text-2xl md:text-4xl font-extrabold mb-1 md:mb-2 tracking-tight">Your Dictionary Vault</h1>
                        <p className="text-indigo-100 text-sm md:text-lg font-medium opacity-90 mb-4 md:mb-6">Watch your vocabulary grow and evolve over time.</p>

                        {/* Rank Progress */}
                        <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-4 md:p-5 rounded-2xl w-full max-w-lg">
                            <div className="flex justify-between items-center mb-2">
                                <h2 className="font-bold text-base md:text-lg flex items-center">
                                    <span className="mr-2">🎓</span>
                                    <span className={currentRank.textColor}>{currentRank.title}</span>
                                </h2>
                                <span className="text-indigo-200 font-bold text-xs md:text-sm">
                                    {currentRank.current} / {currentRank.next === "MAX" ? '∞' : currentRank.next} Words
                                </span>
                            </div>
                            <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(255,255,255,0.5)] ${currentRank.barColor}`}
                                    style={{ width: `${rankProgressPercentage}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-sm border border-white/20 px-6 md:px-10 py-5 md:py-8 rounded-2xl md:rounded-3xl text-center shadow-inner w-full lg:w-auto">
                        <span className="block text-indigo-100 text-xs md:text-sm font-bold uppercase tracking-widest mb-1 md:mb-2">Vocabulary Power</span>
                        <span className="text-4xl md:text-6xl font-black drop-shadow-md">⚡ {powerScore}</span>
                    </div>
                </div>
            </div>

            {/* Achievements Board */}
            <AchievementsBoard userData={{
                totalWords: vaultWords.length,
                dnaCounts: dnaStats,
                streak: dailyStreak
            }} />

            {/* Vocabulary DNA Map */}
            {vaultWords.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-slate-200 dark:border-slate-700 mb-10 transition-colors">
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center">
                                <span className="mr-2">🧬</span> Vocabulary DNA Map
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 font-medium">Your linguistic profile based on collected words.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                        {dnaCategories.map(cat => {
                            const count = dnaStats[cat.key];
                            const percentage = vaultWords.length > 0 ? (count / vaultWords.length) * 100 : 0;

                            return (
                                <div key={cat.key} className="flex flex-col">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-bold text-slate-700 dark:text-slate-300 text-sm flex items-center">
                                            <span className="mr-1">{cat.icon}</span> {cat.key}
                                        </span>
                                        <span className="text-slate-500 dark:text-slate-400 text-xs font-bold bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">{count}</span>
                                    </div>
                                    <div className={`w-full h-3 rounded-full ${cat.bg} overflow-hidden`}>
                                        <div
                                            className={`h-full ${cat.color} rounded-full transition-all duration-1000 ease-out`}
                                            style={{ width: `${percentage}%` }}
                                        ></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {vaultWords.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 p-12 rounded-3xl text-center shadow-lg border border-slate-100 dark:border-slate-700 transition-colors">
                    <span className="text-6xl mb-6 block">📭</span>
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Your Vault is Empty</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-lg max-w-md mx-auto">Play a reading mission and collect words to see them grow here in your dictionary.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {vaultWords.map((wordObj) => {
                        const stage = getEvolutionStage(wordObj.mastery_level);
                        return (
                            <div key={wordObj.id || wordObj.word} className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-md border border-slate-100 dark:border-slate-700 hover:shadow-xl transition-all transform hover:-translate-y-1 relative overflow-hidden group flex flex-col h-full">
                                <div className="flex flex-wrap justify-between items-start mb-4 gap-y-2 w-full">
                                    <div className="flex flex-wrap items-center gap-3 min-w-0">
                                        <h3 className="text-2xl font-bold text-slate-800 dark:text-white capitalize tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate max-w-full">
                                            {wordObj.word}
                                        </h3>
                                        <div className="flex items-center space-x-2 shrink-0">
                                            <button
                                                onClick={() => setEditingWord(wordObj)}
                                                className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-indigo-500 dark:text-slate-300 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 transition-all flex items-center justify-center shadow-sm shrink-0"
                                                title="Edit Word"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                onClick={() => handlePlayAudio(wordObj.word)}
                                                className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-indigo-500 dark:text-slate-300 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 transition-all flex items-center justify-center shadow-sm shrink-0"
                                                title="Play Pronunciation"
                                            >
                                                🔊
                                            </button>
                                            <span className="ml-2 px-2 py-0.5 bg-slate-700 text-slate-300 text-[10px] font-bold uppercase tracking-widest rounded-full flex items-center justify-center shrink-0">
                                                {preferredAccent}
                                            </span>
                                        </div>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border flex items-center space-x-1 shrink-0 ${stage.color}`}>
                                        <span>{stage.emoji}</span>
                                        <span>{stage.title}</span>
                                    </span>
                                </div>

                                {wordObj.definition && (
                                    <div className="mb-4">
                                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Definition</span>
                                        <p className="text-slate-600 dark:text-slate-300 font-medium leading-snug line-clamp-3">{wordObj.definition}</p>
                                    </div>
                                )}

                                <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-700">
                                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1 flex items-center">
                                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        Last Practiced
                                    </span>
                                    <span className="text-slate-500 dark:text-slate-400 text-sm">{new Date(wordObj.last_practiced).toLocaleDateString()}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Edit Word Modal */}
            {editingWord && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 dark:border-slate-700 transform transition-all">
                        <h3 className="text-2xl font-bold mb-6 text-slate-800 dark:text-white flex items-center gap-2">
                            <span>✏️</span> Edit Word
                        </h3>
                        <form onSubmit={handleSaveChanges} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Word</label>
                                <input
                                    type="text"
                                    required
                                    value={editingWord.word}
                                    onChange={(e) => setEditingWord({ ...editingWord, word: e.target.value })}
                                    className="w-full p-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 shadow-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Definition</label>
                                <textarea
                                    required
                                    rows="4"
                                    value={editingWord.definition || ''}
                                    onChange={(e) => setEditingWord({ ...editingWord, definition: e.target.value })}
                                    className="w-full p-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 shadow-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">DNA Category</label>
                                <select
                                    value={editingWord.dna_type || 'Basic'}
                                    onChange={(e) => setEditingWord({ ...editingWord, dna_type: e.target.value })}
                                    className="w-full p-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 shadow-sm appearance-none"
                                >
                                    {dnaCategories.map(c => (
                                        <option key={c.key} value={c.key}>{c.key}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-4 justify-end pt-6 mt-6 border-t border-slate-100 dark:border-slate-700">
                                <button
                                    type="button"
                                    onClick={() => setEditingWord(null)}
                                    disabled={isSaving}
                                    className="px-6 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-6 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg flex items-center gap-2 transition-all disabled:opacity-50 hover:-translate-y-0.5"
                                >
                                    {isSaving ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
