import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Dictionary({ session }) {
    const [vaultWords, setVaultWords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [powerScore, setPowerScore] = useState(0);
    const [error, setError] = useState(null);

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

    const dnaCategories = [
        { key: 'Academic', color: 'bg-blue-500', bg: 'bg-blue-100', icon: '🎓' },
        { key: 'Technical', color: 'bg-purple-500', bg: 'bg-purple-100', icon: '⚙️' },
        { key: 'Advanced', color: 'bg-red-500', bg: 'bg-red-100', icon: '🔥' },
        { key: 'Informal', color: 'bg-yellow-400', bg: 'bg-yellow-100', icon: '🗣️' },
        { key: 'Basic', color: 'bg-green-500', bg: 'bg-green-100', icon: '🌱' },
    ];

    return (
        <div className="max-w-6xl mx-auto p-6 font-sans">
            {/* Gamified Banner */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-8 mb-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-between">
                <div>
                    <h1 className="text-4xl font-extrabold mb-2 tracking-tight">Your Dictionary Vault</h1>
                    <p className="text-indigo-100 text-lg font-medium opacity-90">Watch your vocabulary grow and evolve over time.</p>
                </div>
                <div className="mt-6 md:mt-0 bg-white/10 backdrop-blur-sm border border-white/20 px-8 py-4 rounded-2xl text-center shadow-inner">
                    <span className="block text-indigo-100 text-sm font-bold uppercase tracking-widest mb-1">Vocabulary Power</span>
                    <span className="text-5xl font-black drop-shadow-md">⚡ {powerScore}</span>
                </div>
            </div>

            {/* Vocabulary DNA Map */}
            {vaultWords.length > 0 && (
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 mb-10">
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                                <span className="mr-2">🧬</span> Vocabulary DNA Map
                            </h2>
                            <p className="text-slate-500 font-medium">Your linguistic profile based on collected words.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                        {dnaCategories.map(cat => {
                            const count = dnaStats[cat.key];
                            const percentage = vaultWords.length > 0 ? (count / vaultWords.length) * 100 : 0;

                            return (
                                <div key={cat.key} className="flex flex-col">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-bold text-slate-700 text-sm flex items-center">
                                            <span className="mr-1">{cat.icon}</span> {cat.key}
                                        </span>
                                        <span className="text-slate-500 text-xs font-bold bg-slate-100 px-2 py-0.5 rounded-full">{count}</span>
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
                <div className="bg-white p-12 rounded-3xl text-center shadow-lg border border-slate-100">
                    <span className="text-6xl mb-6 block">📭</span>
                    <h3 className="text-2xl font-bold text-slate-800 mb-2">Your Vault is Empty</h3>
                    <p className="text-slate-500 text-lg max-w-md mx-auto">Play a reading mission and collect words to see them grow here in your dictionary.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {vaultWords.map((wordObj) => {
                        const stage = getEvolutionStage(wordObj.mastery_level);
                        return (
                            <div key={wordObj.id || wordObj.word} className="bg-white rounded-2xl p-6 shadow-md border border-slate-100 hover:shadow-xl transition-all transform hover:-translate-y-1 relative overflow-hidden group">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="text-2xl font-bold text-slate-800 capitalize tracking-tight group-hover:text-indigo-600 transition-colors">
                                        {wordObj.word}
                                    </h3>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border flex items-center space-x-1 ${stage.color}`}>
                                        <span>{stage.emoji}</span>
                                        <span>{stage.title}</span>
                                    </span>
                                </div>

                                {wordObj.definition && (
                                    <div className="mb-4">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Definition</span>
                                        <p className="text-slate-600 font-medium leading-snug">{wordObj.definition}</p>
                                    </div>
                                )}

                                <div className="mt-auto pt-4 border-t border-slate-100">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1 flex items-center">
                                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        Last Practiced
                                    </span>
                                    <span className="text-slate-500 text-sm">{new Date(wordObj.last_practiced).toLocaleDateString()}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
