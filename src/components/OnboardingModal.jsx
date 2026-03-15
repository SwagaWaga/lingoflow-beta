import { useState, useEffect } from 'react';
import AxiomLogo from './AxiomLogo';


// ─── Step data ────────────────────────────────────────────────────────────────
const STEPS = [
    {
        icon: '📚',
        num: '01',
        title: 'The Library',
        desc: 'Read high-level IELTS articles and highlight unfamiliar vocabulary to build your word list.',
        color: 'from-blue-500/20 to-blue-600/5',
        border: 'border-blue-500/20',
        numColor: 'text-blue-500/40',
        titleColor: 'text-blue-400',
    },
    {
        icon: '⚡',
        num: '02',
        title: 'The Vault',
        desc: 'Extract target words and build your personal dictionary with definitions and context.',
        color: 'from-purple-500/20 to-purple-600/5',
        border: 'border-purple-500/20',
        numColor: 'text-purple-500/40',
        titleColor: 'text-purple-400',
    },
    {
        icon: '🥋',
        num: '03',
        title: 'The Dojo',
        desc: 'Master vocabulary through our 5-phase cognitive training, ending in active sentence production.',
        color: 'from-cyan-500/20 to-cyan-600/5',
        border: 'border-cyan-500/20',
        numColor: 'text-cyan-500/40',
        titleColor: 'text-cyan-400',
    },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function OnboardingModal({ isOpen, onClose }) {
    const [visible, setVisible] = useState(false);
    const [animateIn, setAnimateIn] = useState(false);

    // Manage entrance / exit animation
    useEffect(() => {
        if (isOpen) {
            setVisible(true);
            // Slight delay so the CSS transition fires
            const t = setTimeout(() => setAnimateIn(true), 20);
            return () => clearTimeout(t);
        } else {
            setAnimateIn(false);
            const t = setTimeout(() => setVisible(false), 400);
            return () => clearTimeout(t);
        }
    }, [isOpen]);

    if (!visible) return null;

    return (
        /* ── Backdrop ── */
        <div
            className={`fixed inset-0 z-[80] flex items-center justify-center px-4
                bg-black/80 backdrop-blur-sm
                transition-opacity duration-400
                ${animateIn ? 'opacity-100' : 'opacity-0'}`}
        >
            {/* ── Modal card ── */}
            <div
                className={`relative w-full max-w-lg bg-slate-900 border border-slate-700/80
                    rounded-2xl shadow-2xl shadow-black/60
                    transition-all duration-400 ease-[cubic-bezier(0.32,0.72,0,1)]
                    ${animateIn ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="onboarding-title"
            >
                {/* Gradient accent line */}
                <div className="absolute top-0 left-0 w-full h-0.5 rounded-t-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" />

                {/* X close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-all duration-200"
                    aria-label="Close"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                </button>


                <div className="p-8 pt-10">
                    {/* ── Logo + Headline ── */}
                    <div className="flex flex-col items-center text-center mb-9">
                        <div className="relative mb-5">
                            <div className="absolute inset-0 blur-2xl scale-150 bg-cyan-500/20 rounded-full" />
                            <AxiomLogo className="w-14 h-14 relative" />
                        </div>
                        <h1 id="onboarding-title" className="text-3xl font-extrabold text-slate-100 tracking-tight leading-tight mb-2">
                            Welcome to Axiom.
                        </h1>
                        <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
                            Your end-to-end vocabulary mastery system. Here's how the loop works.
                        </p>
                    </div>

                    {/* ── 3-Step Loop ── */}
                    <div className="space-y-3 mb-9">
                        {STEPS.map((step) => (
                            <div
                                key={step.num}
                                className={`relative flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r ${step.color} border ${step.border}`}
                            >
                                {/* Big ghost number */}
                                <span className={`absolute right-4 top-2 text-5xl font-black leading-none select-none pointer-events-none ${step.numColor}`}>
                                    {step.num}
                                </span>

                                {/* Icon */}
                                <span className="text-2xl leading-none flex-shrink-0 mt-0.5">{step.icon}</span>

                                {/* Text */}
                                <div className="flex-1 pr-8">
                                    <p className={`text-sm font-bold mb-0.5 ${step.titleColor}`}>{step.title}</p>
                                    <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── CTA ── */}
                    <button
                        onClick={onClose}
                        className="w-full py-3.5 rounded-xl font-extrabold text-white text-sm tracking-wide
                            bg-gradient-to-r from-cyan-500 to-blue-600
                            hover:from-cyan-400 hover:to-blue-500
                            shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30
                            transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
                    >
                        Begin Mastery →
                    </button>

                    <p className="text-center text-[11px] text-slate-600 mt-4">
                        You can revisit this guide any time via Settings.
                    </p>
                </div>
            </div>
        </div>
    );
}
