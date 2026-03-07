import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Admin() {
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('Science');
    const [subSubject, setSubSubject] = useState('');
    const [difficulty, setDifficulty] = useState('Advanced');
    const [content, setContent] = useState('');
    const [bulkVocabContent, setBulkVocabContent] = useState('');
    const [quizContent, setQuizContent] = useState('');
    const [dnaEntries, setDnaEntries] = useState([{ word: "", category: "Lexicon", subject: "", definition: "" }]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [quizQuestions, setQuizQuestions] = useState([]);
    const [statusMessage, setStatusMessage] = useState('');
    const [loadingDefinitions, setLoadingDefinitions] = useState({});

    const fetchDefinition = async (index) => {
        const entry = dnaEntries[index];
        const word = entry.word.trim();

        if (!word) {
            alert("Please enter a target word first.");
            return;
        }

        if (entry.definition && entry.definition.trim().length > 0) {
            return; // Skip if a definition already exists
        }

        setLoadingDefinitions(prev => ({ ...prev, [index]: true }));

        try {
            const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);

            if (response.ok) {
                const data = await response.json();

                // Safely extract the first meaningful definition
                if (data[0]?.meanings[0]?.definitions[0]?.definition) {
                    const cleanDef = data[0].meanings[0].definitions[0].definition;
                    handleEntryChange(index, "definition", cleanDef);
                }
            } else {
                console.warn(`Definition not found for "${word}" (Status: ${response.status})`);
            }
        } catch (error) {
            console.error("Error fetching dictionary definition:", error);
        } finally {
            setLoadingDefinitions(prev => ({ ...prev, [index]: false }));
        }
    };

    const handleEntryChange = (index, field, value) => {
        const newEntries = [...dnaEntries];
        newEntries[index][field] = value;
        setDnaEntries(newEntries);
    };

    const addEntry = () => {
        setDnaEntries([...dnaEntries, { word: "", category: "Lexicon", subject: "", definition: "" }]);
    };

    const removeEntry = (index) => {
        const newEntries = dnaEntries.filter((_, i) => i !== index);
        setDnaEntries(newEntries);
    };

    const handleBulkParse = () => {
        if (!bulkVocabContent.trim()) {
            alert("Please paste the bulk import content first.");
            return;
        }

        const lines = bulkVocabContent.split('\n');
        const parsedWords = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split('|').map(p => p.trim());
            if (parts.length >= 4 && parts[0] && parts[3]) {
                parsedWords.push({
                    word: parts[0],
                    category: parts[1] || 'Lexicon',
                    subject: parts[2] || '',
                    definition: parts[3]
                });
            } else {
                alert(`Syntax error on line ${i + 1}: incorrect format. Skipping.`);
            }
        }

        if (parsedWords.length > 0) {
            if (dnaEntries.length === 1 && !dnaEntries[0].word.trim()) {
                setDnaEntries(parsedWords);
            } else {
                setDnaEntries(prev => [...prev, ...parsedWords]);
            }
            setBulkVocabContent('');
        }
    };

    const handleBulkQuizParse = () => {
        if (!quizContent.trim()) {
            alert("Please paste the bulk quiz import content first.");
            return;
        }

        const lines = quizContent.split('\n');
        const parsedQuiz = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split('|').map(p => p.trim());
            // Need exactly 7 segments
            if (parts.length >= 7) {
                const correctOptionNumber = parseInt(parts[5], 10);
                if (correctOptionNumber >= 1 && correctOptionNumber <= 4) {
                    parsedQuiz.push({
                        question: parts[0],
                        options: [parts[1], parts[2], parts[3], parts[4]],
                        // Option array is 0-indexed, but correctOptionNumber is 1-4.
                        // Wait: index 1 was option 1 in the parts array. But options[] has it at index 0.
                        // we can just map the string value using parts[correctOptionNumber] because correct option 1 is at index 1 of parts array.
                        correct_answer: parts[correctOptionNumber],
                        explanation: parts[6]
                    });
                } else {
                    alert(`Syntax error on line ${i + 1}: Correct Option Number must be between 1 and 4. Skipping.`);
                }
            } else {
                alert(`Syntax error on line ${i + 1}: Expected 7 segments but found ${parts.length}. Skipping.`);
            }
        }

        if (parsedQuiz.length > 0) {
            setQuizQuestions(prev => [...prev, ...parsedQuiz]);
            setQuizContent(''); // Clear after successful parse
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
                        subject: current.subject || "",
                        definition: current.definition || ""
                    };
                }
                return acc;
            }, {});

            const { error } = await supabase
                .from('articles')
                .insert([{ title, category, sub_subject: subSubject.trim() || null, difficulty_level: difficulty, content_data: formattedContent, dna_map: parsedMap }]);

            if (error) {
                setStatusMessage(error.message);
            } else {
                setStatusMessage("✅ Article uploaded successfully!");
                setTitle('');
                setCategory('Science');
                setSubSubject('');
                setDifficulty('Advanced');
                setContent('');
                setQuizContent('');
                setBulkVocabContent('');
                setDnaEntries([{ word: "", category: "Lexicon", subject: "", definition: "" }]);
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
                        <option value="Science">Science</option>
                        <option value="Technology">Technology</option>
                        <option value="Psychology">Psychology</option>
                        <option value="Environment">Environment</option>
                        <option value="Society">Society</option>
                    </select>
                </div>

                <div>
                    <label htmlFor="subSubject" className="block text-sm font-bold text-gray-700 mb-2">Sub-Subject <span className="font-normal text-gray-400">(optional tag, e.g. Biology, AI, Climate)</span></label>
                    <input
                        id="subSubject"
                        type="text"
                        value={subSubject}
                        onChange={(e) => setSubSubject(e.target.value)}
                        className="w-full p-4 border border-gray-300 rounded-xl bg-gray-50 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                        placeholder="e.g. Biology, AI, Climate, Culture..."
                        disabled={isSubmitting}
                    />
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
                        disabled={isSubmitting}
                    ></textarea>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-inner">
                    <label className="block text-sm font-bold text-gray-700 mb-4">Vocabulary DNA Builder</label>

                    <div className="mb-6 space-y-4">
                        <textarea
                            value={bulkVocabContent}
                            onChange={(e) => setBulkVocabContent(e.target.value)}
                            rows="4"
                            className="w-full p-3 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all shadow-sm"
                            placeholder="Paste bulk words here using the format: Word | Category | Subject | Definition"
                            disabled={isSubmitting}
                        ></textarea>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={handleBulkParse}
                                disabled={isSubmitting || !bulkVocabContent.trim()}
                                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold rounded-xl shadow hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm hover:-translate-y-0.5"
                            >
                                <span>⚡ Parse Bulk Import</span>
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
                                        disabled={isSubmitting}
                                    />
                                    <select
                                        value={entry.category}
                                        onChange={(e) => handleEntryChange(index, "category", e.target.value)}
                                        className="w-40 p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm appearance-none"
                                        disabled={isSubmitting}
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
                                        disabled={isSubmitting}
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div className="relative">
                                    <textarea
                                        value={entry.definition || ''}
                                        onChange={(e) => handleEntryChange(index, "definition", e.target.value)}
                                        placeholder="Definition (Optional)"
                                        rows="2"
                                        className="w-full p-3 pr-14 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                                        disabled={isSubmitting}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fetchDefinition(index)}
                                        disabled={isSubmitting || loadingDefinitions[index]}
                                        className="absolute right-3 top-3 p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-50"
                                        title="Generate dictionary definition"
                                    >
                                        {loadingDefinitions[index] ? (
                                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        ) : (
                                            "✨"
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={addEntry}
                        className="mt-4 px-4 py-2 bg-white text-blue-600 hover:bg-blue-50 hover:text-blue-700 border border-gray-200 hover:border-blue-200 rounded-lg text-sm font-bold transition-all shadow-sm"
                        disabled={isSubmitting}
                    >
                        + Add Word
                    </button>
                </div>

                {/* Article Quiz Builder UI */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-inner mt-6">
                    <label className="block text-sm font-bold text-gray-700 mb-4">Article Quiz Builder</label>

                    <div className="mb-6 space-y-4">
                        <textarea
                            value={quizContent}
                            onChange={(e) => setQuizContent(e.target.value)}
                            rows="4"
                            className="w-full p-4 border border-gray-300 rounded-xl bg-white text-gray-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm"
                            placeholder="Question | Option 1 | Option 2 | Option 3 | Option 4 | Correct Option Number (1-4) | Explanation"
                            disabled={isSubmitting}
                        ></textarea>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={handleBulkQuizParse}
                                disabled={isSubmitting || !quizContent.trim()}
                                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl shadow hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm hover:-translate-y-0.5"
                            >
                                <span>⚡ Parse Quiz Import</span>
                            </button>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {quizQuestions.map((q, qIndex) => (
                            <div key={qIndex} className="p-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm relative">
                                <button
                                    type="button"
                                    onClick={() => removeQuizQuestion(qIndex)}
                                    className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/40 hover:text-red-700 border border-gray-200 dark:border-slate-700 hover:border-red-200 rounded-full font-bold transition-all shadow-md z-10"
                                    title="Remove Question"
                                    disabled={isSubmitting}
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
                                            disabled={isSubmitting}
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
                                                    disabled={isSubmitting}
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
                                                disabled={isSubmitting}
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
                                                disabled={isSubmitting}
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
                        disabled={isSubmitting}
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
