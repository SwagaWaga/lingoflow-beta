import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import AxiomLogo from '../components/AxiomLogo';

export default function UpgradeSecurity() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    const handleUpgrade = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setMessage({ text: 'Passwords do not match.', type: 'error' });
            return;
        }
        if (password.length < 6) {
            setMessage({ text: 'Password must be at least 6 characters.', type: 'error' });
            return;
        }

        setIsLoading(true);
        setMessage({ text: '', type: '' });

        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            
            // Successfully linked! Global session state in App.jsx will automatically refresh
            // if we reload the application window to bypass the lock gate cleanly.
            window.location.reload();
        } catch (error) {
            setMessage({ text: error.message || 'Failed to securely link password.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4 relative z-50 transition-colors duration-300">
            <div className="w-full max-w-md space-y-8 bg-surface p-10 rounded-3xl shadow-2xl border border-blue-900/40">
                <div className="text-center flex flex-col items-center">
                    <AxiomLogo className="w-12 h-12 mb-4" />
                    <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-800 dark:text-white">
                        Upgrade Security
                    </h2>
                    <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                        You recently signed in via Google perfectly! However, Axiom has migrated to a custom zero-trust password infrastructure. <strong className="text-blue-500">Please establish a Master Password</strong> to permanently link your accounts without losing any of your vocabulary or reading progress.
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleUpgrade}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">New Master Password</label>
                            <input
                                type="password"
                                required
                                className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={isLoading}
                                autoComplete="new-password"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Confirm Password</label>
                            <input
                                type="password"
                                required
                                className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono"
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                disabled={isLoading}
                                autoComplete="new-password"
                            />
                        </div>
                    </div>

                    {message.text && (
                        <div className={`p-4 rounded-xl text-sm font-bold border-l-4 ${message.type === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-500' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-500'}`}>
                            {message.text}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading || !password || !confirmPassword}
                        className={`group relative flex w-full justify-center rounded-xl py-4 px-4 text-sm font-bold text-white transition-all shadow-lg hover:-translate-y-0.5 ${isLoading || !password || !confirmPassword ? 'bg-blue-400 dark:bg-blue-500/50 cursor-not-allowed opacity-70' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 hover:shadow-blue-500/30'}`}
                    >
                        Securely Link Credentials
                    </button>
                </form>
            </div>
        </div>
    );
}
