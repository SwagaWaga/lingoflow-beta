import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // You can also log the error to an error reporting service
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            // Premium dark-mode error state
            return (
                <div className="min-h-[70vh] flex items-center justify-center p-6 w-full h-full bg-slate-950 text-slate-200 font-sans">
                    <div className="bg-slate-900 p-12 rounded-3xl text-center shadow-2xl border border-red-900/50 w-full max-w-md">
                        <span className="text-6xl mb-6 block text-center animate-pulse drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">⚠️</span>
                        <h2 className="text-2xl font-black text-white mb-3 tracking-tight">System Malfunction</h2>
                        <p className="text-slate-400 font-medium text-base mb-8 leading-relaxed">
                            A module experienced a critical error. Our auto-recovery systems have paused execution to prevent corrupted mastery data.
                        </p>

                        <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 mb-8 text-left overflow-hidden">
                            <p className="text-red-400 font-mono text-xs break-all opacity-80">
                                {this.state.error?.toString() || "Unknown rendering exception."}
                            </p>
                        </div>

                        <button
                            onClick={() => window.location.reload()}
                            className="px-8 py-4 w-full bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 hover:border-red-500/50 font-bold text-lg rounded-2xl transition-all hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                        >
                            Refocus Application
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
