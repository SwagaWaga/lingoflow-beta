import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default function Admin() {
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('Life Sciences & Biology');
    const [difficulty, setDifficulty] = useState('Advanced');
    const [content, setContent] = useState('');
    const [dnaEntries, setDnaEntries] = useState([{ word: "", category: "Lexicon", definition: "" }]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);
    const [quizQuestions, setQuizQuestions] = useState([]);
    const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    const handleEntryChange = (index, field, value) => {
        const newEntries = [...dnaEntries];
        newEntries[index][field] = value;
        setDnaEntries(newEntries);
    };

    const addEntry = () => {
        setDnaEntries([...dnaEntries, { word: "", category: "Lexicon", definition: "" }]);
    };

    const removeEntry = (index) => {
        const newEntries = dnaEntries.filter((_, i) => i !== index);
        setDnaEntries(newEntries);
    };

    const handleAutoExtract = async () => {
        if (!content.trim()) {
            alert("Please paste the article content first before attempting to extract vocabulary.");
            return;
        }

        try {
            setIsExtracting(true);
            setStatusMessage('');

            const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY_DOJO;
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

            const prompt = `You are an expert ESL (English as a Second Language) teacher preparing students for the IELTS exam. 
Read the following article text and extract exactly 5 to 10 high-value, advanced vocabulary words or phrases.
For each word, suggest an appropriate linguistic category. You MUST choose ONLY from the following categories:
["Academic", "Technical", "Lexicon", "Collocation", "Grammar", "Idiom", "Advanced", "Basic", "Informal"]

Whenever you provide a definition for a word, you must use simple, clear, and everyday English (B1/B2 level vocabulary). Do NOT use overly complex academic jargon or circular definitions. Keep the definition concise—strictly under 15 words if possible. It must be easy to read on a small flashcard.

Return your response STRICTLY as a raw JSON array of objects without any markdown formatting wrappers.
Example output format:
[
  {"word": "ubiquitous", "category": "Academic", "definition": "found or existing everywhere"},
  {"word": "machine learning", "category": "Technical", "definition": "the use of data to allow computers to learn without being programmed"}
]

Article Text:
${content}`;

            const result = await model.generateContent(prompt);
            let text = result.response.text();

            // Cleanup markdown if the model hallucinates it
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();

            const parsedWords = JSON.parse(text);

            if (Array.isArray(parsedWords)) {
                // If the user only has one empty default row, overwrite it. Otherwise append.
                if (dnaEntries.length === 1 && !dnaEntries[0].word.trim()) {
                    setDnaEntries(parsedWords);
                } else {
                    setDnaEntries(prev => [...prev, ...parsedWords]);
                }
            }
        } catch (err) {
            console.error("Auto-extract failed:", err);
            alert("Failed to auto-extract vocabulary. Check console for details.");
        } finally {
            setIsExtracting(false);
        }
    };

    const handleGenerateQuiz = async () => {
        if (!content.trim()) {
            alert("Please paste the article content first before attempting to generate a quiz.");
            return;
        }

        try {
            setIsGeneratingQuiz(true);
            setStatusMessage('');

            const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY_DOJO;
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

            const prompt = `You are an expert IELTS examiner.
Read the following article text and generate 3 to 5 multiple-choice reading comprehension questions based on the text.

The response MUST be a STRICT JSON array of objects.
Each object must have this EXACT structure:
{
  "question": "The question text",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct_answer": "The exact string of the correct option",
  "explanation": "A short sentence explaining why it is correct based on the text."
}

Do NOT wrap the response in markdown blocks like \`\`\`json. Return only the raw JSON array.

Article Text:
${content}`;

            const result = await model.generateContent(prompt);
            let text = result.response.text();

            text = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsedQuiz = JSON.parse(text);

            if (Array.isArray(parsedQuiz)) {
                setQuizQuestions(parsedQuiz);
            }
        } catch (err) {
            console.error("Quiz generation failed:", err);
            alert("Failed to generate quiz. Check console for details.");
        } finally {
            setIsGeneratingQuiz(false);
        }
    };

    const handleQuizChange = (index, field, value) => {
        const newQuiz = [...quizQuestions];
        newQuiz[index][field] = value;
        setQuizQuestions(newQuiz);
    };

    const handleQuizOptionChange = (qIndex, optIndex, value) => {
        const newQuiz = [...quizQuestions];
        newQuiz[qIndex].options[optIndex] = value;
        setQuizQuestions(newQuiz);
    };

    const addQuizQuestion = () => {
        setQuizQuestions([
            ...quizQuestions,
            { question: "", options: ["", "", "", ""], correct_answer: "", explanation: "" }
        ]);
    };

    const removeQuizQuestion = (index) => {
        const newQuiz = quizQuestions.filter((_, i) => i !== index);
        setQuizQuestions(newQuiz);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setStatusMessage('');

        try {
            let formattedContent;
            try {
                // Try to parse the pasted text as JSON
                formattedContent = JSON.parse(content);
            } catch (e) {
                // If it fails (it's just plain text), wrap it in our standard format
                // Ensuring it maintains the 'segments' array expected by reader.jsx
                formattedContent = {
                    segments: content.split('\n').filter(p => p.trim()).map(text => ({ text: text.trim() })),
                    quiz: quizQuestions
                };
            }

            // Always ensure the quiz questions are properly set even if the json parse succeeded but didn't have quiz array
            if (formattedContent && !formattedContent.quiz && quizQuestions.length > 0) {
                formattedContent.quiz = quizQuestions;
            } else if (formattedContent && formattedContent.quiz && quizQuestions.length > 0) {
                formattedContent.quiz = quizQuestions;
            }

            const parsedMap = dnaEntries.reduce((acc, current) => {
                const cleanWord = current.word.trim().toLowerCase();
                if (cleanWord) {
                    acc[cleanWord] = {
                        category: current.category,
                        definition: current.definition || ""
                    };
                }
                return acc;
            }, {});

            const { error } = await supabase
                .from('articles')
                .insert([{ title, category, difficulty_level: difficulty, content_data: formattedContent, dna_map: parsedMap }]);

            if (error) {
                setStatusMessage(error.message);
            } else {
                setStatusMessage("✅ Article uploaded successfully!");
                setTitle('');
                setCategory('Life Sciences & Biology');
                setDifficulty('Advanced');
                setContent('');
                setDnaEntries([{ word: "", category: "Lexicon", definition: "" }]);
                setQuizQuestions([]);
            }
        } catch (err) {
            setStatusMessage(err.message || 'An error occurred during publishing.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto my-10 bg-white shadow-xl rounded-2xl p-8 border border-gray-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
            <h2 className="text-2xl font-bold text-gray-800 mb-8 flex items-center space-x-2">
                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                <span>Upload Article</span>
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="title" className="block text-sm font-bold text-gray-700 mb-2">Title</label>
                    <input
                        id="title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full p-4 border border-gray-300 rounded-xl bg-gray-50 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                        placeholder="Article Title"
                        required
                        disabled={isSubmitting}
                    />
                </div>

                <div>
                    <label htmlFor="category" className="block text-sm font-bold text-gray-700 mb-2">Category</label>
                    <select
                        id="category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full p-4 border border-gray-300 rounded-xl bg-gray-50 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm appearance-none"
                        disabled={isSubmitting}
                    >
                        <option value="Life Sciences & Biology">Life Sciences & Biology</option>
                        <option value="Technology & Innovation">Technology & Innovation</option>
                        <option value="Global Geography & Environment">Global Geography & Environment</option>
                        <option value="History & Archaeology">History & Archaeology</option>
                        <option value="Psychology & Sociology">Psychology & Sociology</option>
                        <option value="Arts & Culture">Arts & Culture</option>
                    </select>
                </div>

                <div>
                    <label htmlFor="difficulty" className="block text-sm font-bold text-gray-700 mb-2">Difficulty</label>
                    <select
                        id="difficulty"
                        value={difficulty}
                        onChange={(e) => setDifficulty(e.target.value)}
                        className="w-full p-4 border border-gray-300 rounded-xl bg-gray-50 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm appearance-none"
                        disabled={isSubmitting}
                    >
                        <option value="Intermediate">Intermediate</option>
                        <option value="Advanced">Advanced</option>
                        <option value="IELTS Academic">IELTS Academic</option>
                    </select>
                </div>

                <div>
                    <label htmlFor="content" className="block text-sm font-bold text-gray-700 mb-2">Content</label>
                    <textarea
                        id="content"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        rows="12"
                        className="w-full p-4 border border-gray-300 rounded-xl bg-gray-50 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                        placeholder="Paste the full article content here..."
                        required
                        disabled={isSubmitting || isExtracting}
                    ></textarea>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-inner">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                        <label className="block text-sm font-bold text-gray-700">Vocabulary DNA & Quiz Builder</label>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={handleAutoExtract}
                                disabled={isSubmitting || isExtracting || isGeneratingQuiz || !content.trim()}
                                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold rounded-xl shadow hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm hover:-translate-y-0.5"
                            >
                                {isExtracting ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>Thinking...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>✨ Auto-Extract Vocabulary</span>
                                    </>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={handleGenerateQuiz}
                                disabled={isSubmitting || isExtracting || isGeneratingQuiz || !content.trim()}
                                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl shadow hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm hover:-translate-y-0.5"
                            >
                                {isGeneratingQuiz ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>Generating...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>📝 Generate Article Quiz</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {dnaEntries.map((entry, index) => (
                            <div key={index} className="flex flex-col gap-2 p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm">
                                <div className="flex gap-3 items-center">
                                    <input
                                        type="text"
                                        value={entry.word}
                                        onChange={(e) => handleEntryChange(index, "word", e.target.value)}
                                        placeholder="Target Word"
                                        className="flex-1 p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                                        disabled={isSubmitting || isExtracting}
                                    />
                                    <select
                                        value={entry.category}
                                        onChange={(e) => handleEntryChange(index, "category", e.target.value)}
                                        className="w-40 p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm appearance-none"
                                        disabled={isSubmitting || isExtracting}
                                    >
                                        <option value="Academic">Academic</option>
                                        <option value="Technical">Technical</option>
                                        <option value="Lexicon">Lexicon</option>
                                        <option value="Collocation">Collocation</option>
                                        <option value="Grammar">Grammar</option>
                                        <option value="Idiom">Idiom</option>
                                        <option value="Advanced">Advanced</option>
                                        <option value="Basic">Basic</option>
                                        <option value="Informal">Informal</option>
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => removeEntry(index)}
                                        className="w-12 h-12 flex items-center justify-center bg-white dark:bg-slate-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/40 hover:text-red-700 border border-gray-200 dark:border-slate-700 hover:border-red-200 rounded-xl font-bold transition-all shadow-sm shrink-0"
                                        title="Remove word"
                                        disabled={isSubmitting || isExtracting}
                                    >
                                        ✕
                                    </button>
                                </div>
                                <textarea
                                    value={entry.definition || ''}
                                    onChange={(e) => handleEntryChange(index, "definition", e.target.value)}
                                    placeholder="Definition (Optional)"
                                    rows="2"
                                    className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                                    disabled={isSubmitting || isExtracting}
                                />
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={addEntry}
                        className="mt-4 px-4 py-2 bg-white text-blue-600 hover:bg-blue-50 hover:text-blue-700 border border-gray-200 hover:border-blue-200 rounded-lg text-sm font-bold transition-all shadow-sm"
                        disabled={isSubmitting || isExtracting}
                    >
                        + Add Word
                    </button>
                </div>

                {/* Article Quiz Builder UI */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-inner mt-6">
                    <label className="block text-sm font-bold text-gray-700 mb-4">Article Quiz Builder</label>
                    <div className="space-y-6">
                        {quizQuestions.map((q, qIndex) => (
                            <div key={qIndex} className="p-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm relative">
                                <button
                                    type="button"
                                    onClick={() => removeQuizQuestion(qIndex)}
                                    className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/40 hover:text-red-700 border border-gray-200 dark:border-slate-700 hover:border-red-200 rounded-full font-bold transition-all shadow-md z-10"
                                    title="Remove Question"
                                    disabled={isSubmitting || isGeneratingQuiz}
                                >
                                    ✕
                                </button>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Question {qIndex + 1}</label>
                                        <input
                                            type="text"
                                            value={q.question}
                                            onChange={(e) => handleQuizChange(qIndex, "question", e.target.value)}
                                            placeholder="Enter the question text"
                                            className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm"
                                            disabled={isSubmitting || isGeneratingQuiz}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {q.options.map((opt, optIndex) => (
                                            <div key={optIndex} className="flex items-center">
                                                <span className="w-8 text-center font-bold text-slate-400 dark:text-slate-500">{String.fromCharCode(65 + optIndex)}</span>
                                                <input
                                                    type="text"
                                                    value={opt}
                                                    onChange={(e) => handleQuizOptionChange(qIndex, optIndex, e.target.value)}
                                                    placeholder={`Option ${optIndex + 1}`}
                                                    className="flex-1 p-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 shadow-sm text-sm"
                                                    disabled={isSubmitting || isGeneratingQuiz}
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex flex-col md:flex-row gap-4 pt-2">
                                        <div className="w-full md:w-1/3">
                                            <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Correct Answer</label>
                                            <select
                                                value={q.correct_answer}
                                                onChange={(e) => handleQuizChange(qIndex, "correct_answer", e.target.value)}
                                                className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 shadow-sm appearance-none text-sm"
                                                disabled={isSubmitting || isGeneratingQuiz}
                                            >
                                                <option value="" disabled>Select correct option...</option>
                                                {q.options.filter(o => o.trim()).map((opt, i) => (
                                                    <option key={i} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="w-full md:w-2/3">
                                            <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Explanation</label>
                                            <input
                                                type="text"
                                                value={q.explanation}
                                                onChange={(e) => handleQuizChange(qIndex, "explanation", e.target.value)}
                                                placeholder="Explanation for the correct answer"
                                                className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm text-sm"
                                                disabled={isSubmitting || isGeneratingQuiz}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={addQuizQuestion}
                        className="mt-6 px-4 py-2 bg-white text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 border border-gray-200 hover:border-emerald-200 rounded-lg text-sm font-bold transition-all shadow-sm"
                        disabled={isSubmitting || isGeneratingQuiz}
                    >
                        + Add Question
                    </button>
                </div>

                <div className="pt-4 flex flex-col items-end">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`px-8 py-3 rounded-xl font-bold text-white shadow-lg transition-all duration-300 transform ${isSubmitting
                            ? 'bg-blue-400 cursor-not-allowed scale-100'
                            : 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-500/30 hover:-translate-y-1'
                            }`}
                    >
                        {isSubmitting ? (
                            <span className="flex items-center space-x-2">
                                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Publishing...</span>
                            </span>
                        ) : 'Publish Article'}
                    </button>

                    {statusMessage && (
                        <div className={`mt-6 w-full p-4 rounded-xl border-l-4 font-medium animate-fade-in ${statusMessage.startsWith('✅')
                            ? 'bg-green-50 text-green-700 border-green-500'
                            : 'bg-red-50 text-red-700 border-red-500'
                            }`}>
                            {statusMessage}
                        </div>
                    )}
                </div>
            </form>
        </div>
    );
}
