import React, { useState } from 'react';

export default function ReadingQuiz({ questions: propQuestions, article, onComplete }) {
    const [questions, setQuestions] = useState(propQuestions && propQuestions.length > 0 ? propQuestions : (article?.content_data?.quiz || []));
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [showExplanation, setShowExplanation] = useState(false);

    const handleOptionClick = (option) => {
        if (selectedAnswer !== null) return; // Prevent multiple clicks
        setSelectedAnswer(option);
        setShowExplanation(true);
    };

    const handleNext = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setSelectedAnswer(null);
            setShowExplanation(false);
        } else {
            if (onComplete) onComplete();
        }
    };

    if (questions.length === 0) {
        return (
            <div className="max-w-2xl mx-auto p-12 bg-white dark:bg-slate-800 rounded-3xl shadow flex flex-col items-center justify-center font-sans border border-slate-200 dark:border-slate-700 text-center transition-colors">
                <span className="text-5xl mb-4 block">📭</span>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight mb-2">No quiz available</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">This article doesn't have a reading comprehension test assigned to it yet.</p>
                <button
                    onClick={onComplete}
                    className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 hover:shadow-blue-500/40 transition-all hover:-translate-y-0.5"
                >
                    Skip to Vocabulary Review
                </button>
            </div>
        );
    }

    const currentQuestion = questions[currentQuestionIndex];
    const isCorrect = selectedAnswer === currentQuestion.answer;

    return (
        <div className="max-w-3xl mx-auto p-4 md:p-6 font-sans">
            <div className="mb-5 md:mb-8">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Reading Comprehension</span>
                    <span className="text-xs md:text-sm font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full">
                        Q {currentQuestionIndex + 1} / {questions.length}
                    </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div
                        className="bg-blue-600 h-full transition-all duration-300"
                        style={{ width: `${((currentQuestionIndex) / questions.length) * 100}%` }}
                    ></div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 md:p-8 rounded-2xl md:rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 mb-4 md:mb-6 transition-colors">
                <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white mb-5 md:mb-8 leading-snug md:leading-relaxed">
                    {currentQuestion.question}
                </h2>

                <div className="space-y-4">
                    {currentQuestion.options.map((option, idx) => {
                        let buttonStyle = "bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 hover:border-slate-300";

                        if (showExplanation) {
                            if (option === currentQuestion.answer) {
                                buttonStyle = "bg-green-100 dark:bg-green-900/40 border-green-500 dark:border-green-600 text-green-900 dark:text-green-200 ring-2 ring-green-200 dark:ring-green-900 font-bold";
                            } else if (option === selectedAnswer) {
                                buttonStyle = "bg-red-100 dark:bg-red-900/40 border-red-500 dark:border-red-600 text-red-900 dark:text-red-200 font-bold";
                            } else {
                                buttonStyle = "bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500 opacity-50 cursor-not-allowed";
                            }
                        }

                        return (
                            <button
                                key={idx}
                                onClick={() => handleOptionClick(option)}
                                disabled={showExplanation}
                                className={`w-full text-left p-4 md:p-4 py-4 rounded-xl border-2 font-medium transition-all ${buttonStyle} disabled:cursor-auto`}
                            >
                                <div className="flex items-center">
                                    <span className="w-9 h-9 md:w-8 md:h-8 rounded-full bg-white dark:bg-slate-600 shadow-sm flex items-center justify-center font-bold mr-3 md:mr-4 text-slate-500 dark:text-slate-300 flex-shrink-0 text-sm">
                                        {String.fromCharCode(65 + idx)}
                                    </span>
                                    <span className="leading-snug text-sm md:text-base">{option}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {showExplanation && (
                <div className={`p-4 md:p-6 rounded-xl md:rounded-2xl mb-6 md:mb-8 animate-fade-in-up border ${isCorrect
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-900 dark:text-green-200'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
                    }`}>
                    <div className="flex items-center mb-2 md:mb-3">
                        <span className="text-xl md:text-2xl mr-2">{isCorrect ? '✅' : '❌'}</span>
                        <h3 className="font-bold text-base md:text-lg">{isCorrect ? 'Correct!' : 'Incorrect'}</h3>
                    </div>
                    {!isCorrect && (
                        <p className="font-bold mb-1 md:mb-2 text-sm md:text-base">
                            Correct Answer: <span className="underline decoration-2">{currentQuestion.answer}</span>
                        </p>
                    )}
                    <p className="opacity-90 leading-relaxed font-medium text-sm md:text-base">
                        {currentQuestion.explanation}
                    </p>
                </div>
            )}

            {showExplanation && (
                <button
                    onClick={handleNext}
                    className="w-full py-4 bg-blue-600 text-white font-extrabold text-lg rounded-2xl shadow-lg hover:-translate-y-1 hover:shadow-blue-500/40 transition-all hover:bg-blue-700"
                >
                    {currentQuestionIndex < questions.length - 1 ? "Next Question" : "Review Vocabulary 🚀"}
                </button>
            )}
        </div>
    );
}
