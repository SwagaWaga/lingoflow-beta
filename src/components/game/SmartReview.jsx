import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function SmartReview({ collectedWords, session, onComplete }) {
    const [reviewWords, setReviewWords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!collectedWords || collectedWords.length === 0) {
            setLoading(false);
            return;
        }

        // Since Reader.jsx already fetches definitions and dna_types,
        // we can just directly initialize our review state.
        setReviewWords([...collectedWords]);
        setLoading(false);
    }, [collectedWords]);

    const handleDefinitionChange = (index, newTerm) => {
        const newReviewList = [...reviewWords];
        newReviewList[index].definition = newTerm;
        setReviewWords(newReviewList);
    };

    const handleSaveToVault = async () => {
        if (!session?.user?.id) return;

        try {
            setSaving(true);
            const payloadData = reviewWords.map(item => ({
                user_id: session.user.id,
                word: item.word,
                context_sentence: item.context,
                definition: item.definition,
                dna_type: item.dna_type,
                mastery_level: 1,
                last_practiced: new Date().toISOString()
            }));

            const { error: upsertError } = await supabase
                .from('user_vocabulary')
                .upsert(payloadData, { onConflict: 'user_id, word' });

            if (upsertError) throw upsertError;

            console.log("Smart Review words saved to vault!");
            if (onComplete) onComplete();
        } catch (err) {
            console.error("Error saving vocabulary:", err);
            setError("Failed to save words to your vault.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-6"></div>
                <h3 className="text-xl font-bold text-gray-700">AI is analyzing context...</h3>
                <p className="text-gray-500 mt-2">Generating exact definitions for your words.</p>
            </div>
        );
    }

    if (reviewWords.length === 0) {
        return (
            <div className="text-center py-20">
                <p className="text-gray-500 text-lg">No words collected. Go back and highlight some!</p>
                <button onClick={onComplete} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition">Back to Lobby</button>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="text-center mb-10">
                <h2 className="text-3xl font-black text-gray-800 tracking-tight">Smart Review</h2>
                <p className="text-gray-500 font-medium">Review the AI-generated definitions contextually. Feel free to translate or add notes before saving them to your Vault!</p>
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 mb-6 font-bold text-center">
                    {error}
                </div>
            )}

            <div className="space-y-6 mb-10">
                {reviewWords.map((item, idx) => {
                    const dnaColors = {
                        Academic: 'bg-blue-100 text-blue-800',
                        Technical: 'bg-purple-100 text-purple-800',
                        Informal: 'bg-yellow-100 text-yellow-800',
                        Advanced: 'bg-red-100 text-red-800',
                        Basic: 'bg-green-100 text-green-800'
                    };
                    const badgeClass = dnaColors[item.dna_type] || dnaColors.Basic;

                    return (
                        <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col group hover:border-blue-200 transition-colors">
                            <div className="mb-4">
                                <div className="flex items-center space-x-3 mb-2">
                                    <h3 className="text-2xl font-black text-blue-600 capitalize">{item.word}</h3>
                                    {item.dna_type && (
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${badgeClass}`}>
                                            {item.dna_type}
                                        </span>
                                    )}
                                </div>
                                <p className="text-gray-600 italic mt-2 border-l-4 border-gray-200 pl-4 py-1.5 bg-gray-50 rounded-r-lg">
                                    "{item.context}"
                                </p>
                            </div>

                            <div className="flex flex-col">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Definition / Translation notes</label>
                                <input
                                    type="text"
                                    value={item.definition}
                                    onChange={(e) => handleDefinitionChange(idx, e.target.value)}
                                    className="w-full bg-blue-50/50 border border-blue-100 rounded-xl px-4 py-3 text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            <button
                onClick={handleSaveToVault}
                disabled={saving}
                className="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xl font-black tracking-wide rounded-2xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-1 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {saving ? "Saving to Vault..." : "Confirm & Save to Vault"}
            </button>
        </div>
    );
}
