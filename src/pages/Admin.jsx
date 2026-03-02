import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Admin() {
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('Life Sciences & Biology');
    const [difficulty, setDifficulty] = useState('Advanced');
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

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
                    quiz: []
                };
            }

            const { error } = await supabase
                .from('articles')
                .insert([{ title, category, difficulty_level: difficulty, content_data: formattedContent }]);

            if (error) {
                setStatusMessage(error.message);
            } else {
                setStatusMessage("✅ Article uploaded successfully!");
                setTitle('');
                setCategory('Life Sciences & Biology');
                setDifficulty('Advanced');
                setContent('');
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
                        disabled={isSubmitting}
                    ></textarea>
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
