import React, { useState } from 'react';
import { VocabularyWord } from '../types/database';

interface FlashcardProps {
  wordObj: VocabularyWord;
  preferredAccent?: string;
  onEdit?: (word: VocabularyWord) => void;
  onPlayAudio?: (wordText: string) => void;
  onDelete?: (wordId: string | undefined) => void;
}

export const Flashcard: React.FC<FlashcardProps> = ({ 
  wordObj, 
  preferredAccent,
  onEdit,
  onPlayAudio,
  onDelete
}) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div 
      className="w-full h-full cursor-pointer relative [perspective:1000px] group"
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
          
          {/* Action Icons - Fade in on Hover */}
          <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
            {preferredAccent && (
                <span className="flex items-center justify-center shrink-0 mr-1 px-1.5 py-0.5 bg-slate-700/80 text-slate-300 text-[9px] font-bold uppercase tracking-wider rounded">
                    {preferredAccent}
                </span>
            )}
            {onEdit && (
                <button
                    onClick={(e) => { e.stopPropagation(); onEdit(wordObj); }}
                    className="text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-600 p-1.5 rounded-md transition-colors"
                    title="Edit Word"
                >
                    ✏️
                </button>
            )}
            {onPlayAudio && (
                <button
                    onClick={(e) => { e.stopPropagation(); onPlayAudio(wordObj.word); }}
                    className="text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-600 p-1.5 rounded-md transition-colors"
                    title="Play Pronunciation"
                >
                    🔊
                </button>
            )}
            {onDelete && (
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(wordObj.id); }}
                    className="text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-600 p-1.5 rounded-md transition-colors"
                    title="Delete Word"
                >
                    🗑️
                </button>
            )}
          </div>

          {/* DNA Type Badge — top left */}
          {wordObj.dna_type && (
            <div className="absolute top-4 left-4">
              <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full bg-slate-700/60 text-slate-300 border border-slate-600/50">
                {wordObj.dna_type}
              </span>
            </div>
          )}

          <h2 className="text-4xl md:text-5xl font-black text-indigo-600 dark:text-indigo-400 capitalize tracking-tight text-center">
            {wordObj.word}
          </h2>
          <div className="absolute bottom-6 flex items-center text-xs text-slate-400 font-medium tracking-widest uppercase opacity-60 group-hover:opacity-100 transition-opacity">
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Tap to flip
          </div>
        </div>

        {/* Back Face */}
        <div className="absolute inset-0 w-full h-full bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 [backface-visibility:hidden] [transform:rotateY(180deg)] overflow-y-auto">
          <div className="flex flex-col justify-start h-full p-8">

            {/* Header row: word + badges */}
            <div className="flex items-start justify-between mb-4 gap-3">
              <div>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white capitalize leading-tight">
                  {wordObj.word}
                </h3>
                {wordObj.part_of_speech && (
                  <span className="inline-block mt-1.5 text-xs font-bold uppercase tracking-widest text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-md">
                    {wordObj.part_of_speech}
                  </span>
                )}
              </div>
              {wordObj.dna_type && (
                <span className="shrink-0 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full bg-slate-700/60 text-slate-300 border border-slate-600/50">
                  {wordObj.dna_type}
                </span>
              )}
            </div>

            {/* Definition */}
            <p className="text-base text-slate-600 dark:text-slate-300 font-medium leading-relaxed mb-3">
              {wordObj.definition}
            </p>

            {/* Context sentence */}
            {wordObj.context && (
              <p className="text-sm italic text-slate-500 dark:text-slate-400 mb-4">
                "{wordObj.context}"
              </p>
            )}

            {/* Memory Hooks */}
            {wordObj.word_connections && (
              <div className="mt-auto pt-5 border-t border-slate-700/50">
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

                {wordObj.word_connections.collocations?.length > 0 && wordObj.mastery_level > 2 && (
                  <div className="mb-3">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5 font-bold">Collocations</p>
                    <div className="flex flex-wrap gap-1.5">
                      {wordObj.word_connections.collocations.map((c, i) => (
                        <span key={i} className="px-2.5 py-1 text-xs font-medium rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">{c}</span>
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

          {/* Flip-back hint */}
          <div className="absolute bottom-4 right-5 flex items-center text-xs text-slate-500 font-medium tracking-widest uppercase">
            <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Flip back
          </div>
        </div>
      </div>
    </div>
  );
};
