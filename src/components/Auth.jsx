import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Auth() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage({ text: '', type: '' });

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;
            // App.jsx will automatically handle the session change and re-render
        } catch (error) {
            setMessage({ text: error.message || 'Login failed', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage({ text: '', type: '' });

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) throw error;

            if (data?.user && data?.session === null) {
                setMessage({ text: 'Check your email for the confirmation link!', type: 'success' });
            } else {
                setMessage({ text: 'Signup successful!', type: 'success' });
            }

        } catch (error) {
            setMessage({ text: error.message || 'Signup failed', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="w-full max-w-md space-y-8 bg-white p-10 rounded-2xl shadow-xl border border-gray-100">
                <div className="text-center">
                    <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900">
                        Welcome to Axiom
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Sign in or create an account to save your progress
                    </p>
                </div>

                <form className="mt-8 space-y-6">
                    <div className="space-y-4 rounded-md shadow-sm">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Email address</label>
                            <input
                                type="email"
                                required
                                className="relative block w-full appearance-none rounded-xl border border-gray-300 px-3 py-3 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm transition-all"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
                            <input
                                type="password"
                                required
                                className="relative block w-full appearance-none rounded-xl border border-gray-300 px-3 py-3 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm transition-all"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    {message.text && (
                        <div className={`p-4 rounded-xl text-sm font-medium ${message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
                            }`}>
                            {message.text}
                        </div>
                    )}

                    <div className="flex flex-col space-y-3 pt-2">
                        <button
                            onClick={handleLogin}
                            disabled={isLoading || !email || !password}
                            className={`group relative flex w-full justify-center rounded-xl border border-transparent py-3 px-4 text-sm font-bold text-white transition-all shadow-md hover:-translate-y-0.5 ${isLoading || !email || !password ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-500/30'
                                }`}
                        >
                            Log In
                        </button>
                        <button
                            onClick={handleSignUp}
                            disabled={isLoading || !email || !password}
                            className={`group relative flex w-full justify-center rounded-xl border-2 py-3 px-4 text-sm font-bold transition-all ${isLoading || !email || !password ? 'border-gray-200 text-gray-400 cursor-not-allowed' : 'border-blue-600 text-blue-600 hover:bg-blue-50'
                                }`}
                        >
                            Sign Up
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
