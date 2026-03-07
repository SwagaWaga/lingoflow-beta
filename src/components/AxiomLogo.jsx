// AxiomLogo.jsx — The Quotation Anchor mark for Axiom
// Two heavy, overlapping quote marks with a cyan→indigo gradient fill
export default function AxiomLogo({ className = 'w-8 h-8' }) {
    return (
        <svg
            className={`${className} shrink-0`}
            viewBox="0 0 48 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Axiom logo"
        >
            <defs>
                <linearGradient id="axiom-grad" x1="0" y1="0" x2="48" y2="40" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stop-color="#06b6d4" />
                    <stop offset="100%" stop-color="#6366f1" />
                </linearGradient>
            </defs>

            {/* ── Left quote mark ── */}
            {/* Top filled circle */}
            <circle cx="10" cy="10" r="7.5" fill="url(#axiom-grad)" />
            {/* Tapering descender: a teardrop path going down-left */}
            <path
                d="M10 17.5 C10 17.5 3 24 2.5 32 C2.2 36 5 38.5 8 37 C11 35.5 13 30 10 17.5Z"
                fill="url(#axiom-grad)"
            />

            {/* ── Right quote mark ── */}
            <circle cx="30" cy="10" r="7.5" fill="url(#axiom-grad)" />
            <path
                d="M30 17.5 C30 17.5 23 24 22.5 32 C22.2 36 25 38.5 28 37 C31 35.5 33 30 30 17.5Z"
                fill="url(#axiom-grad)"
            />
        </svg>
    );
}
