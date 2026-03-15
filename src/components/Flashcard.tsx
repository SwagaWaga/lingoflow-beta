import React, { useState } from 'react';
import { VocabularyWord } from '../types/database';

interface FlashcardProps {
  wordObj: VocabularyWord;
}

export const Flashcard: React.FC<FlashcardProps> = ({ wordObj }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div 
      className="w-full max-w-md aspect-[4/3] mx-auto cursor-pointer [perspective:1000px] group"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      {/* Inner card wrapper handling the 3D flip */}
      <div 
        className={`w-full h-full relative [transform-style:preserve-3d] transition-transform duration-500 ease-out ${
          isFlipped ? '[transform:rotateY(180deg)]' : ''
        }`}
      >
        {/* Front Face */}
        <div className="absolute inset-0 w-full h-full bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 [backface-visibility:hidden] flex flex-col items-center justify-center p-6 group-hover:-translate-y-1 group-hover:shadow-xl transition-all">
          <h2 className="text-4xl md:text-5xl font-black text-indigo-600 dark:text-indigo-400 capitalize tracking-tight text-center">
            {wordObj.word}
          </h2>
          <div className="absolute bottom-6 flex items-center text-xs text-slate-400 font-medium tracking-widest uppercase opacity-60 group-hover:opacity-100 transition-opacity">
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Tap to flip
          </div>
        </div>

        {/* Back Face */}
        <div className="absolute inset-0 w-full h-full bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col items-center justify-center p-8 group-hover:-translate-y-1 group-hover:shadow-xl transition-all">
          <div className="flex-1 w-full flex flex-col items-center justify-center text-center">
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white capitalize mb-4">
              {wordObj.word}
            </h3>
            {wordObj.part_of_speech && (
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-md mb-3">
                    {wordObj.part_of_speech}
                </span>
            )}
            <p className="text-lg text-slate-600 dark:text-slate-300 font-medium mb-6 leading-relaxed max-w-sm">
              {wordObj.definition}
            </p>
            {wordObj.context && (
              <p className="text-sm italic text-slate-500 dark:text-slate-400 max-w-sm">
                "{wordObj.context}"
              </p>
            )}
          </div>
          <div className="absolute bottom-6 flex items-center text-xs text-slate-400 font-medium tracking-widest uppercase opacity-60 group-hover:opacity-100 transition-opacity">
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Tap to flip back
          </div>
        </div>
      </div>
    </div>
  );
};
