import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

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
    const [trainingWords, setTrainingWords] = useState([]);
    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const [options, setOptions] = useState([]);
    const [isFinished, setIsFinished] = useState(false);
    const [textAnswer, setTextAnswer] = useState("");

    // AI Variables (Level 2)
    const [aiSentence, setAiSentence] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);

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

    // Fetch up to 10 words that need practice
    useEffect(() => {
        async function fetchTrainingData() {
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
                    .lt('mastery_level', 4) // Only words not fully mastered
                    .order('last_practiced', { ascending: true }) // Oldest first
                    .limit(10);

                if (error) throw error;

                setTrainingWords(data || []);
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
        if (trainingWords.length === 0 || isFinished || currentWordIndex >= trainingWords.length) return;

        const currentWord = trainingWords[currentWordIndex].word;

        // Build option pool
        const otherTrainingWords = trainingWords.map(w => w.word).filter(w => w !== currentWord);
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
    }, [currentWordIndex, trainingWords, isFinished]);

    // Generate AI Context for Level 2
    useEffect(() => {
        if (trainingWords.length === 0 || isFinished || currentWordIndex >= trainingWords.length) return;

        const currentItem = trainingWords[currentWordIndex];
        const level = currentItem.mastery_level || 1;

        if (level === 2) {
            let isMounted = true;
            async function generateSentence() {
                try {
                    setIsGenerating(true);
                    setAiSentence("");
                    const prompt = `Write a single, clear sentence using the word '${currentItem.word}'. The sentence MUST be about the exact same topic as this original sentence: '${currentItem.context_sentence}'. Keep the vocabulary at an accessible, high-school IELTS level. Do not use overly complex jargon. Return ONLY the sentence.`;

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
                    let generated = "AI failed to generate a sentence. Using fallback.";
                    if (data.candidates && data.candidates[0] && data.candidates[0].content.parts[0].text) {
                        generated = data.candidates[0].content.parts[0].text.trim();
                    }
                    if (isMounted) setAiSentence(generated);
                } catch (err) {
                    console.error("AI Generation Error", err);
                    if (isMounted) setAiSentence(`Fallback context: The scientist researched the ${currentItem.word}.`);
                } finally {
                    if (isMounted) setIsGenerating(false);
                }
            }
            generateSentence();
            return () => { isMounted = false; };
        } else {
            setAiSentence("");
        }
    }, [currentWordIndex, trainingWords, isFinished]);

    const handleAnswer = async (selectedWordOrEvent) => {
        let answer = selectedWordOrEvent;
        if (selectedWordOrEvent && selectedWordOrEvent.preventDefault) {
            selectedWordOrEvent.preventDefault();
            answer = textAnswer;
        }

        const currentItem = trainingWords[currentWordIndex];
        const isCorrect = typeof answer === 'string' && answer.toLowerCase().trim() === currentItem.word.toLowerCase();

        let newLevel = currentItem.mastery_level || 1;

        if (isCorrect) {
            newLevel += 1;
            setFeedback("Correct! 🔥");
        } else {
            newLevel = 1; // Demotion!
            setFeedback("Incorrect! 🧊");
        }

        // Update Database in background for the word only
        if (session?.user?.id) {
            try {
                await supabase
                    .from('user_vocabulary')
                    .update({
                        mastery_level: newLevel,
                        last_practiced: new Date().toISOString()
                    })
                    .match({ user_id: session.user.id, word: currentItem.word });
            } catch (err) {
                console.error("Failed to update data:", err);
            }
        }

        // Wait 1 second before next word or finishing
        setTimeout(async () => {
            setFeedback("");
            setTextAnswer("");
            setUserSentence("");
            setAiFeedback(null);

            if (currentWordIndex + 1 < trainingWords.length) {
                setCurrentWordIndex(prev => prev + 1);
            } else {

                // --- Evaluate Daily Streak on Finish ---
                if (session?.user?.id) {
                    const { error } = await supabase.rpc('update_user_streak', {
                        user_id_param: session.user.id
                    });
                    if (error) console.error("Error updating streak:", error);
                }

                setIsFinished(true);
            }
        }, 1000);
    };

    const handleGradeSentence = async (e) => {
        e.preventDefault();
        const currentItem = trainingWords[currentWordIndex];

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
                <p className="text-orange-600 font-bold text-xl animate-pulse">Entering the Dojo...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-4xl mx-auto p-6 text-center">
                <div className="bg-red-50 text-red-700 p-6 rounded-2xl border border-red-200">
                    <h2 className="text-xl font-bold mb-2">Failed to load Training Data</h2>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    if (!isFinished && trainingWords.length === 0) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <div className="bg-white p-12 rounded-3xl text-center shadow-lg border border-slate-100">
                    <span className="text-6xl mb-6 block text-center">🏆</span>
                    <h3 className="text-3xl font-bold text-slate-800 mb-4 tracking-tight">You are a Master!</h3>
                    <p className="text-slate-500 text-lg max-w-lg mx-auto">There are currently no words that need practicing. Go read some more articles to discover new vocabulary!</p>
                </div>
            </div>
        );
    }

    if (isFinished) {
        return (
            <div className="max-w-4xl mx-auto p-6 min-h-[70vh] flex items-center justify-center">
                <div className="bg-white p-12 rounded-3xl text-center shadow-2xl border-t-8 border-orange-500 w-full max-w-md transform transition-all hover:-translate-y-2">
                    <span className="text-6xl mb-6 block text-center animate-bounce">🎌</span>
                    <h2 className="text-4xl font-black text-slate-800 mb-4 tracking-tight">Dojo Complete!</h2>
                    <p className="text-xl font-medium text-slate-600 mb-8">You trained <strong className="text-orange-500">10</strong> words!</p>

                    <button
                        onClick={() => window.location.reload()} // For simplicity, reset the whole view route or trigger parent if passed a prop. Since App controls 'currentView', usually we pass a prop. For now, we leave as is or user can just click nav buttons.
                        className="px-8 py-4 w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-extrabold text-xl rounded-2xl shadow-lg hover:shadow-orange-500/40 transition-all hover:scale-[1.02]"
                    >
                        Train Again
                    </button>
                    <p className="mt-4 text-xs text-slate-400 font-bold uppercase tracking-widest">Or navigate using the menu above</p>
                </div>
            </div>
        );
    }

    const currentItem = trainingWords[currentWordIndex];
    const level = currentItem.mastery_level || 1;
    const maskedContext = currentItem.context_sentence ? maskText(currentItem.context_sentence, currentItem.word) : "Context not available.";

    return (
        <div className="max-w-4xl mx-auto p-6 font-sans">
            <div className="flex justify-between items-center mb-8 px-4">
                <div className="bg-white px-6 py-2 rounded-full shadow-sm border border-slate-200 font-bold text-slate-500 text-sm tracking-widest uppercase">
                    Round {currentWordIndex + 1} / {trainingWords.length}
                </div>
            </div>

            <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100 mb-8 max-w-2xl mx-auto relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-400 to-red-500 opacity-80 group-hover:opacity-100 transition-opacity"></div>

                {level === 1 && (
                    <>
                        <span className="text-xs font-black text-orange-400 uppercase tracking-[0.2em] block mb-4">Level 1: Definition Match</span>
                        <p className="text-2xl lg:text-3xl font-medium text-slate-800 leading-snug">
                            {maskText(currentItem.definition, currentItem.word) || "Definition not found for this word."}
                        </p>
                    </>
                )}

                {level === 2 && (
                    <>
                        <span className="text-xs font-black text-orange-400 uppercase tracking-[0.2em] block mb-4">Level 2: Context Match</span>
                        {isGenerating ? (
                            <div className="flex items-center space-x-3 text-orange-500 animate-pulse my-4">
                                <div className="w-6 h-6 border-t-2 border-b-2 border-orange-500 rounded-full animate-spin"></div>
                                <span className="font-bold">AI is calculating a new scenario...</span>
                            </div>
                        ) : (
                            <p className="text-2xl lg:text-3xl font-medium text-slate-800 leading-snug italic">
                                "{aiSentence ? maskText(aiSentence, currentItem.word) : maskedContext}"
                            </p>
                        )}
                    </>
                )}

                {level >= 3 && !aiFeedback && (
                    <>
                        <span className="text-xs font-black text-orange-400 uppercase tracking-[0.2em] block mb-4">Level 3: Active Recall</span>
                        <p className="text-xl font-medium text-slate-800 leading-snug mb-6">
                            Write an original, academic sentence using the word: <span className="font-black text-blue-600 capitalize">'{currentItem.word}'</span>
                        </p>
                        <p className="text-sm text-gray-500 italic mb-4">Original context: "{currentItem.context_sentence}"</p>
                        <form onSubmit={handleGradeSentence} className="flex flex-col gap-4">
                            <textarea
                                value={userSentence}
                                onChange={(e) => setUserSentence(e.target.value)}
                                placeholder="Type your sentence here..."
                                disabled={isGrading}
                                rows={3}
                                className="w-full py-4 px-6 text-xl font-medium text-slate-700 bg-white border-2 border-slate-200 rounded-2xl focus:border-orange-500 focus:ring focus:ring-orange-200 outline-none transition-all shadow-sm disabled:opacity-50"
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

                {level >= 3 && aiFeedback && (
                    <>
                        <span className="text-xs font-black text-orange-400 uppercase tracking-[0.2em] block mb-4">Level 3: Results</span>
                        <div className={`p-6 rounded-2xl border-2 mb-6 ${aiFeedback.passed ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
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
                    <div className={`absolute inset-0 z-10 flex items-center justify-center bg-white/90 backdrop-blur-sm transition-all duration-300`}>
                        <span className={`text-4xl font-black px-8 py-4 rounded-3xl shadow-2xl transform scale-110 ${feedback.includes('Correct') ? 'bg-green-100 text-green-600 rotate-[-2deg]' : 'bg-red-100 text-red-600 rotate-[2deg]'}`}>
                            {feedback}
                        </span>
                    </div>
                )}
            </div>

            {level === 1 || level === 2 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                    {options.map((opt, idx) => (
                        <button
                            key={idx}
                            onClick={() => handleAnswer(opt)}
                            disabled={!!feedback || isGenerating}
                            className="py-6 px-8 text-xl font-bold tracking-tight text-slate-700 bg-white border-2 border-slate-200 rounded-2xl hover:border-orange-400 hover:bg-orange-50 hover:text-orange-700 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
                        >
                            <span className="relative z-10">{opt}</span>
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
