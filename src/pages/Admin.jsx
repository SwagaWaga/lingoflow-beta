import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Admin() {
    const [jsonInput, setJsonInput] = useState('');
    const [status, setStatus] = useState({ type: '', message: '' });
    const [isPublishing, setIsPublishing] = useState(false);

    const handlePublish = async () => {
        setStatus({ type: '', message: '' });

        if (!jsonInput.trim()) {
            setStatus({ type: 'error', message: 'Please paste article JSON data before publishing.' });
            return;
        }

        try {
            setIsPublishing(true);

            // Parse the JSON input
            const articleData = JSON.parse(jsonInput);

            // Validate the minimum required fields
            if (!articleData.title || !articleData.content_data) {
                throw new Error('Your JSON is missing required fields. Please ensure "title" and "content_data" exist.');
            }

            // Prepare payload
            const payload = {
                title: articleData.title,
                category: articleData.category || 'General',
                difficulty_level: articleData.difficulty_level || 'Beginner',
                content_data: articleData.content_data
            };

            if (articleData.id) {
                payload.id = articleData.id;
            }

            // Use Supabase client (auth state automatically provided by session)
            const { data, error } = await supabase
                .from('articles')
                .insert([payload])
                .select();

            if (error) {
                throw error;
            }

            // Handle Success
            setStatus({
                type: 'success',
                message: `Article "${payload.title}" published successfully!${data && data[0] && data[0].id ? ` (ID: ${data[0].id})` : ''}`
            });
            setJsonInput('');

        } catch (err) {
            console.error('Publish error:', err);
            if (err instanceof SyntaxError) {
                setStatus({ type: 'error', message: 'Invalid JSON format. Please check your syntax.' });
            } else {
                setStatus({ type: 'error', message: err.message || 'An error occurred during publishing.' });
            }
        } finally {
            setIsPublishing(false);
        }
    };

    return (
        <div className="w-full max-w-4xl bg-white shadow-xl rounded-2xl p-8 border border-gray-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center space-x-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                <span>Admin Dashboard - Article Upload</span>
            </h2>

            <div className="mb-6">
                <label htmlFor="json-input" className="block text-sm font-bold text-gray-700 mb-2">
                    Article JSON Payload
                </label>
                <textarea
                    id="json-input"
                    rows="14"
                    className="w-full p-4 border border-gray-300 rounded-xl bg-gray-50 text-gray-800 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-inner"
                    placeholder={`{\n  "title": "My New Article",\n  "category": "Travel",\n  "difficulty_level": "Intermediate",\n  "content_data": {\n    "segments": [],\n    "vocabulary": []\n  }\n}`}
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    disabled={isPublishing}
                ></textarea>
            </div>

            {status.message && (
                <div className={`mb-6 p-4 rounded-xl border-l-4 font-medium animate-fade-in ${status.type === 'error'
                    ? 'bg-red-50 text-red-700 border-red-500'
                    : 'bg-green-50 text-green-700 border-green-500'
                    }`}>
                    <div className="flex items-center space-x-2">
                        {status.type === 'error' ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        )}
                        <span>{status.message}</span>
                    </div>
                </div>
            )}

            <div className="flex justify-end">
                <button
                    onClick={handlePublish}
                    disabled={isPublishing}
                    className={`px-8 py-3 rounded-xl font-bold text-white shadow-lg transition-all duration-300 transform ${isPublishing
                        ? 'bg-blue-400 cursor-not-allowed scale-100'
                        : 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-500/30 hover:-translate-y-1'
                        }`}
                >
                    {isPublishing ? (
                        <span className="flex items-center space-x-2">
                            <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Publishing...</span>
                        </span>
                    ) : (
                        'Publish to Database'
                    )}
                </button>
            </div>

        </div>
    );
}
