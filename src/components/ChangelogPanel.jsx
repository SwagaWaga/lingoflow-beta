import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

// ─── Badge config ─────────────────────────────────────────────────────────────
const BADGE = {
    feature: {
        label: 'Feature',
        bg: 'bg-emerald-500/15',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
        dot: 'bg-emerald-400',
        glow: 'shadow-emerald-500/20',
        timelineBg: 'bg-emerald-500/20',
        timelineBorder: 'border-emerald-500/40',
    },
    update: {
        label: 'Update',
        bg: 'bg-blue-500/15',
        text: 'text-blue-400',
        border: 'border-blue-500/30',
        dot: 'bg-blue-400',
        glow: 'shadow-blue-500/20',
        timelineBg: 'bg-blue-500/20',
        timelineBorder: 'border-blue-500/40',
    },
    fix: {
        label: 'Fix',
        bg: 'bg-amber-500/15',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
        dot: 'bg-amber-400',
        glow: 'shadow-amber-500/20',
        timelineBg: 'bg-amber-500/20',
        timelineBorder: 'border-amber-500/40',
    },
};

// ─── Skeleton loader ──────────────────────────────────────────────────────────
function SkeletonRelease() {
    return (
        <div className="relative flex gap-5 animate-pulse">
            <div className="flex flex-col items-center flex-shrink-0 w-5">
                <div className="w-3.5 h-3.5 rounded-full bg-slate-700 mt-1" />
                <div className="flex-1 w-px bg-slate-800 my-2 min-h-[60px]" />
            </div>
            <div className="flex-1 pb-8">
                <div className="flex items-center gap-2 mb-3">
                    <div className="h-5 w-16 rounded-full bg-slate-700" />
                    <div className="h-4 w-10 rounded bg-slate-800" />
                    <div className="h-4 w-20 rounded bg-slate-800 ml-auto" />
                </div>
                <div className="h-4 w-3/4 rounded bg-slate-700 mb-3" />
                <div className="space-y-2">
                    <div className="h-3 w-full rounded bg-slate-800" />
                    <div className="h-3 w-5/6 rounded bg-slate-800" />
                    <div className="h-3 w-4/5 rounded bg-slate-800" />
                </div>
            </div>
        </div>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ChangelogPanel({ isOpen, onClose }) {
    const panelRef = useRef(null);
    const [releases, setReleases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);

    // Fetch from Supabase whenever the panel opens
    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;

        async function fetchReleases() {
            setLoading(true);
            setFetchError(null);
            const { data, error } = await supabase
                .from('changelog')
                .select('*')
                .order('release_date', { ascending: false });

            if (cancelled) return;
            if (error) {
                setFetchError(error.message);
            } else {
                setReleases(data ?? []);
            }
            setLoading(false);
        }

        fetchReleases();
        return () => { cancelled = true; };
    }, [isOpen]);

    // Close on Escape key
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        if (isOpen) document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    // Lock body scroll when open
    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    // Format release_date (YYYY-MM-DD) to a readable string
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        try {
            return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <>
            {/* ── Backdrop ── */}
            <div
                onClick={onClose}
                className={`fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
            />

            {/* ── Slide-over Panel ── */}
            <aside
                ref={panelRef}
                className={`fixed top-0 right-0 h-full z-[70] w-full max-w-md flex flex-col
          bg-slate-900/95 backdrop-blur-md border-l border-slate-700/60
          shadow-2xl shadow-black/60
          transition-transform duration-400 ease-[cubic-bezier(0.32,0.72,0,1)]
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
                aria-label="What's New"
                role="dialog"
                aria-modal="true"
            >
                {/* ── Header ── */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700/50 flex-shrink-0">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <span className="text-xl">✨</span>
                            <h2 className="text-lg font-extrabold text-white tracking-tight">What's New</h2>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 pl-8">Axiom release history &amp; changelog</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center
              text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700/80
              border border-slate-700/50 hover:border-slate-600
              transition-all duration-200 hover:scale-110 active:scale-95"
                        aria-label="Close changelog"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* ── Body ── */}
                <div className="flex-1 overflow-y-auto px-6 py-6 custom-scroll">

                    {/* Loading skeletons */}
                    {loading && (
                        <div className="space-y-0">
                            <SkeletonRelease />
                            <SkeletonRelease />
                            <SkeletonRelease />
                        </div>
                    )}

                    {/* Error state */}
                    {!loading && fetchError && (
                        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                            <span className="text-3xl">⚠️</span>
                            <p className="text-sm font-bold text-red-400">Failed to load changelog</p>
                            <p className="text-xs text-slate-500">{fetchError}</p>
                        </div>
                    )}

                    {/* Empty state */}
                    {!loading && !fetchError && releases.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                            <span className="text-4xl opacity-40">📭</span>
                            <p className="text-sm font-bold text-slate-400">No updates yet</p>
                            <p className="text-xs text-slate-600">Check back after the next release.</p>
                        </div>
                    )}

                    {/* Timeline */}
                    {!loading && !fetchError && releases.length > 0 && (
                        <div className="space-y-0">
                            {releases.map((release, i) => {
                                const b = BADGE[release.type] ?? BADGE.update;
                                const isLast = i === releases.length - 1;
                                // details may be stored as text[] (Postgres array) or as a JS string[]
                                const details = Array.isArray(release.details) ? release.details : [];

                                return (
                                    <div key={release.id ?? release.version} className="relative flex gap-5">
                                        {/* Timeline spine */}
                                        <div className="flex flex-col items-center flex-shrink-0 w-5">
                                            <div className={`w-3.5 h-3.5 rounded-full border-2 ${b.timelineBorder} ${b.timelineBg} flex items-center justify-center mt-1 flex-shrink-0 shadow-lg ${b.glow}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${b.dot}`} />
                                            </div>
                                            {!isLast && (
                                                <div className="flex-1 w-px bg-gradient-to-b from-slate-600/50 to-slate-700/20 my-2" />
                                            )}
                                        </div>

                                        {/* Card */}
                                        <div className="flex-1 pb-8">
                                            {/* Meta row */}
                                            <div className="flex items-center gap-2 flex-wrap mb-3">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${b.bg} ${b.text} ${b.border}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${b.dot}`} />
                                                    {b.label}
                                                </span>
                                                <span className="text-blue-400 text-xs font-mono font-bold">{release.version}</span>
                                                <span className="text-slate-500 text-xs ml-auto">{formatDate(release.release_date)}</span>
                                            </div>

                                            {/* Title */}
                                            <h3 className="text-sm font-bold text-slate-100 mb-2.5 leading-snug">{release.title}</h3>

                                            {/* Details list */}
                                            <ul className="space-y-1.5">
                                                {details.map((detail, j) => (
                                                    <li key={j} className="flex items-start gap-2 text-xs text-slate-400 leading-relaxed">
                                                        <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-600 flex-shrink-0" />
                                                        {detail}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Footer stamp */}
                    {!loading && (
                        <div className="pt-2 pb-4 text-center">
                            <p className="text-[11px] text-slate-600 font-semibold uppercase tracking-widest">— Built with Axiom —</p>
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
}
