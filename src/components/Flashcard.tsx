import React, { useState } from 'react';
import { VocabularyWord } from '../types/database';

interface FlashcardProps {
  wordObj: VocabularyWord;
  preferredAccent?: string;
  onEdit?: (word: VocabularyWord) => void;
  onPlayAudio?: (wordText: string) => void;
  onDelete?: (wordId: string | undefined) => void;
  onClose?: () => void;
}

export const Flashcard: React.FC<FlashcardProps> = ({ 
  wordObj, 
  preferredAccent,
  onEdit,
  onPlayAudio,
  onDelete,
  onClose
}) => {
  const [isFlipped, setIsFlipped] = useState(false);

  // Determine if the word has passed the early learning stages.
  // If mastery_level is undefined, 0, 1, or 2, this MUST evaluate to false.
  const currentPhase = wordObj.mastery_level || 0; 
  const isAdvancedPhase = Number(currentPhase) >= 3;

  return (
    <div 
      className="w-full h-full relative [perspective:1000px]"
    >
      {/* Inner card wrapper handling the 3D flip */}
      <div 
        className={`w-full h-full relative [transform-style:preserve-3d] transition-transform duration-500 ease-out ${
          isFlipped ? '[transform:rotateY(180deg)]' : ''
        }`}
      >
        {/* ── FRONT FACE ── */}
        <div className="absolute inset-0 w-full h-full bg-slate-900 rounded-none sm:rounded-2xl shadow-lg border-0 sm:border border-slate-700 [backface-visibility:hidden] flex flex-col overflow-hidden">

          {/* Top bar: accent badge + utility icons */}
          <div className="flex items-center justify-between px-5 pt-5 pb-2 shrink-0">
            {wordObj.dna_type ? (
              <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full bg-slate-700/60 text-slate-300 border border-slate-600/50">
                {wordObj.dna_type}
              </span>
            ) : <span />}

            <div className="flex items-center gap-2">
              {preferredAccent && (
                <span className="flex items-center justify-center shrink-0 px-1.5 py-0.5 bg-slate-700/80 text-slate-300 text-[9px] font-bold uppercase tracking-wider rounded">
                  {preferredAccent}
                </span>
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-600 rounded-xl transition-colors text-sm font-bold"
                  title="Close"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8 pb-28 flex flex-col items-center justify-center w-full">
            <h2 className="w-full min-w-0 text-3xl sm:text-5xl md:text-6xl font-black text-indigo-400 capitalize tracking-tight text-center leading-tight break-all sm:break-words text-wrap">
              {wordObj.word}
            </h2>
            <p className="mt-4 text-xs text-slate-500 font-medium tracking-widest uppercase opacity-70">
              Tap to see definition
            </p>
          </div>

          {/* ── Sticky Footer (Front) ── */}
          <div className="absolute bottom-0 left-0 w-full p-4 bg-slate-900/95 backdrop-blur-md border-t border-slate-700/50 flex justify-center gap-4 z-10 sm:rounded-b-2xl">
            {onPlayAudio && (
              <button
                onClick={() => onPlayAudio(wordObj.word)}
                className="min-h-[48px] px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white transition-all flex items-center gap-2 font-semibold text-sm active:scale-95"
                title="Play Pronunciation"
              >
                🔊 <span className="hidden sm:inline">Listen</span>
              </button>
            )}
            <button
              onClick={() => setIsFlipped(true)}
              className="min-h-[48px] px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all flex items-center gap-2 font-semibold text-sm active:scale-95 shadow-lg shadow-indigo-900/40"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Flip Card
            </button>
            {onEdit && (
              <button
                onClick={() => onEdit(wordObj)}
                className="min-h-[48px] px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white transition-all flex items-center gap-2 font-semibold text-sm active:scale-95"
                title="Edit Word"
              >
                ✏️
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(wordObj.id)}
                className="min-h-[48px] px-4 py-3 rounded-xl bg-slate-700 hover:bg-rose-700 text-slate-400 hover:text-white transition-all flex items-center gap-2 font-semibold text-sm active:scale-95"
                title="Delete Word"
              >
                🗑️
              </button>
            )}
          </div>
        </div>

        {/* ── BACK FACE ── */}
        <div className="absolute inset-0 w-full h-full bg-slate-900 rounded-none sm:rounded-2xl shadow-lg border-0 sm:border border-slate-700 [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col overflow-hidden">

          {/* Top bar */}
          <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-2 shrink-0">
            {/* Word + POS — min-w-0 lets this shrink so it never pushes the right side off-screen */}
            <div className="flex flex-col min-w-0 flex-1">
              <h3 className="text-lg sm:text-xl font-bold text-white capitalize break-all sm:break-words leading-snug">{wordObj.word}</h3>
              {wordObj.part_of_speech && (
                <span className="mt-1 self-start text-xs font-bold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md">
                  {wordObj.part_of_speech}
                </span>
              )}
            </div>
            {/* Controls — flex-shrink-0 guarantees they're never crushed */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {wordObj.dna_type && (
                <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full bg-slate-700/60 text-slate-300 border border-slate-600/50">
                  {wordObj.dna_type}
                </span>
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-600 rounded-xl transition-colors text-sm font-bold"
                  title="Close"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8 pb-28">
            {/* Definition */}
            <p className="text-base text-slate-300 font-medium leading-relaxed mb-3 pt-2">
              {wordObj.definition}
            </p>

            {/* Context sentence */}
            {wordObj.context && (
              <p className="text-sm italic text-slate-500 mb-4 border-l-2 border-slate-600 pl-3">
                "{wordObj.context}"
              </p>
            )}

            {/* Memory Hooks */}
            {wordObj.word_connections && (
              <div className="pt-5 border-t border-slate-700/50">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-3 font-bold">Memory Hooks</p>

                {wordObj.word_connections.synonyms?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5 font-bold">Synonyms</p>
                    <div className="flex flex-wrap gap-1.5">
                      {wordObj.word_connections.synonyms.map((s, i) => (
                        <span key={i} className="px-2.5 py-1 text-xs font-medium rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {wordObj.word_connections.antonyms?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5 font-bold">Antonyms</p>
                    <div className="flex flex-wrap gap-1.5">
                      {wordObj.word_connections.antonyms.map((a, i) => (
                        <span key={i} className="px-2.5 py-1 text-xs font-medium rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/20">{a}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* SPOILER LOCK: Only renders if isAdvancedPhase is true */}
                {isAdvancedPhase && wordObj.word_connections?.collocations && wordObj.word_connections.collocations.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5 font-bold">Collocations</p>
                    <div className="flex flex-wrap gap-1.5">
                      {wordObj.word_connections.collocations.map((collocation, idx) => (
                        <span key={idx} className="px-2.5 py-1 text-xs font-medium rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 break-words">
                          {collocation}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {wordObj.word_connections.wordFamily && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5 font-bold">Word Family</p>
                    <div className="border-l-2 border-indigo-500/50 pl-3 py-1">
                      <p className="text-sm text-slate-400 italic">{wordObj.word_connections.wordFamily}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Sticky Footer (Back) ── */}
          <div className="absolute bottom-0 left-0 w-full p-4 bg-slate-900/95 backdrop-blur-md border-t border-slate-700/50 flex justify-center gap-4 z-10 sm:rounded-b-2xl">
            {onPlayAudio && (
              <button
                onClick={() => onPlayAudio(wordObj.word)}
                className="min-h-[48px] px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white transition-all flex items-center gap-2 font-semibold text-sm active:scale-95"
                title="Play Pronunciation"
              >
                🔊 <span className="hidden sm:inline">Listen</span>
              </button>
            )}
            <button
              onClick={() => setIsFlipped(false)}
              className="min-h-[48px] px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white transition-all flex items-center gap-2 font-semibold text-sm active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Flip Back
            </button>
            {onEdit && (
              <button
                onClick={() => onEdit(wordObj)}
                className="min-h-[48px] px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white transition-all flex items-center gap-2 font-semibold text-sm active:scale-95"
                title="Edit Word"
              >
                ✏️
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(wordObj.id)}
                className="min-h-[48px] px-4 py-3 rounded-xl bg-slate-700 hover:bg-rose-700 text-slate-400 hover:text-white transition-all flex items-center gap-2 font-semibold text-sm active:scale-95"
                title="Delete Word"
              >
                🗑️
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
