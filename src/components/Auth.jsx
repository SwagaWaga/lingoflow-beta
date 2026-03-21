import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Turnstile } from '@marsidev/react-turnstile';

export default function Auth() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    const [turnstileToken, setTurnstileToken] = useState(null);
    const turnstileRef = useRef();

    const envKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
    const isPlaceholder = envKey === 'your_cloudflare_site_key_here';
    const finalSiteKey = (envKey && !isPlaceholder) ? envKey : '1x00000000000000000000AA';

    const callEdgeProxy = async (action) => {
        // 1. Smart Error: Stop them if they try to use an email address!
        if (username.includes('@')) {
            setMessage({ text: 'Please enter your username, not an email address.', type: 'error' });
            return;
        }

        if (!turnstileToken && action !== 'passkey') {
            setMessage({ text: 'Please complete the secure verification widget.', type: 'error' });
            return;
        }

        const formattedEmail = `${username.trim().toLowerCase()}@internal.axiom.app`;

        setIsLoading(true);
        setMessage({ text: '', type: '' });

        try {
            const { data, error } = await supabase.functions.invoke('authenticate', {
                body: { email: formattedEmail, password, turnstileToken, action }
            });

            if (error) throw new Error(error.message);
            if (data?.error) throw new Error(data.error);

            if (data?.data?.session) {
                await supabase.auth.setSession(data.data.session);
            } else if (action === 'signup') {
                setMessage({ text: 'Account created successfully! You can now log in.', type: 'success' });
                setUsername('');
                setPassword('');
                setTurnstileToken(null);
            }

        } catch (error) {
            // 2. Exact Error Mapping: Show the specific backend problem
            let errorText = error.message || `${action} failed.`;
            if (errorText.toLowerCase().includes('invalid login credentials')) {
                errorText = 'Incorrect username or password. Please try again.';
            }

            setMessage({ text: errorText, type: 'error' });
            setTurnstileToken(null);
        } finally {
            setIsLoading(false);
            turnstileRef.current?.reset();
            setTurnstileToken(null);
        }
    };

    const handleLogin = (e) => {
        e.preventDefault();
        callEdgeProxy('login');
    };

    const handleSignUp = (e) => {
        e.preventDefault();
        callEdgeProxy('signup');
    };

    return (
        <div className="flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 min-h-screen">
            {/* Dark Theme Container */}
            <div className="w-full max-w-md space-y-8 bg-[#0f172a] p-10 rounded-2xl shadow-2xl border border-slate-800">
                <div className="text-center">
                    <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-white">
                        Welcome to Axiom
                    </h2>
                    <p className="mt-2 text-sm text-slate-400">
                        Sign in or create an account to save your progress
                    </p>
                </div>

                <form className="mt-8 space-y-6">
                    <div className="space-y-4 rounded-md shadow-sm">
                        <div>
                            <label className="block text-sm font-bold text-slate-300 mb-1">Username</label>
                            <input
                                type="text"
                                required
                                className="relative block w-full appearance-none rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-3 text-white placeholder-slate-500 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm transition-all"
                                placeholder="Enter your username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                disabled={isLoading}
                                autoComplete="username"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-300 mb-1">Password</label>
                            <input
                                type="password"
                                required
                                className="relative block w-full appearance-none rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-3 text-white placeholder-slate-500 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm transition-all"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={isLoading}
                                autoComplete="current-password"
                            />
                        </div>
                    </div>

                    {/* Dark Theme Error/Success Messages */}
                    {message.text && (
                        <div className={`p-4 rounded-xl text-sm font-medium ${message.type === 'error'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}>
                            {message.text}
                        </div>
                    )}

                    <div className="flex justify-center w-full min-h-[65px] relative z-10">
                        {/* Switched Cloudflare to Dark Mode */}
                        <Turnstile
                            ref={turnstileRef}
                            siteKey={finalSiteKey}
                            onSuccess={(token) => setTurnstileToken(token)}
                            options={{ theme: 'dark' }}
                        />
                    </div>

                    <div className="flex flex-col space-y-3 pt-2 relative z-10">
                        <button
                            onClick={handleLogin}
                            disabled={isLoading || !username || !password || !turnstileToken}
                            className={`group relative flex w-full justify-center rounded-xl border border-transparent py-3 px-4 text-sm font-bold text-white transition-all shadow-md hover:-translate-y-0.5 ${isLoading || !username || !password || !turnstileToken
                                ? 'bg-indigo-600/50 cursor-not-allowed opacity-70'
                                : 'bg-indigo-600 hover:bg-indigo-500 hover:shadow-indigo-500/30'
                                }`}
                        >
                            Log In
                        </button>
                        <button
                            onClick={handleSignUp}
                            disabled={isLoading || !username || !password || !turnstileToken}
                            className={`group relative flex w-full justify-center rounded-xl border-2 py-3 px-4 text-sm font-bold transition-all ${isLoading || !username || !password || !turnstileToken
                                ? 'border-slate-700 text-slate-500 cursor-not-allowed'
                                : 'border-indigo-600 text-indigo-500 hover:bg-indigo-600/10'
                                }`}
                        >
                            Create Account
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}