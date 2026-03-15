import React, { useState } from 'react';
import { VocabularyWord } from '../types/database';
import { playClickSound, playQuitSound } from '../utils/playSound';

interface VaultWordCardProps {
    wordObj: VocabularyWord;
    stage: { title: string; emoji: string; color: string };
    preferredAccent: string;
    onClickCard: () => void;
    onEdit: (word: VocabularyWord) => void;
    onPlayAudio: (wordText: string) => void;
    onDelete: (wordId: string | undefined) => void;
}

export default function VaultWordCard({
    wordObj,
    stage,
    preferredAccent,
    onClickCard,
    onEdit,
    onPlayAudio,
    onDelete
}: VaultWordCardProps) {
    return (
        <div 
            className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 hover:bg-slate-800/60 transition-colors relative group w-full cursor-pointer"
            onClick={onClickCard}
        >
            <div className="flex flex-col h-full w-full relative">
                
                {/* Word & Badge */}
                <div className="flex-1 w-full pt-1">
                    <h3 className="text-2xl font-bold text-white capitalize tracking-tight mb-3 truncate max-w-[80%]">
                        {wordObj.word}
                    </h3>
                    
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-md border" style={{
                       // Extrapolate the colors based on the passed stage color classes
                       backgroundColor: stage.color.includes('green') ? 'rgba(16, 185, 129, 0.1)' : 
                                        stage.color.includes('emerald') ? 'rgba(16, 185, 129, 0.1)' :
                                        stage.color.includes('teal') ? 'rgba(20, 184, 166, 0.1)' :
                                        stage.color.includes('orange') ? 'rgba(249, 115, 22, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                       color: stage.color.includes('green') ? '#34d399' : 
                              stage.color.includes('emerald') ? '#34d399' :
                              stage.color.includes('teal') ? '#2dd4bf' :
                              stage.color.includes('orange') ? '#fb923c' : '#34d399',
                       borderColor: stage.color.includes('green') ? 'rgba(16, 185, 129, 0.2)' : 
                                    stage.color.includes('emerald') ? 'rgba(16, 185, 129, 0.2)' :
                                    stage.color.includes('teal') ? 'rgba(20, 184, 166, 0.2)' :
                                    stage.color.includes('orange') ? 'rgba(249, 115, 22, 0.2)' : 'rgba(16, 185, 129, 0.2)'
                    }}>
                        <span>{stage.emoji}</span>
                        <span>{stage.title}</span>
                    </span>
                </div>

                {/* Hidden Layout for Actions - Fades in on Hover */}
                <div className="absolute top-0 right-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <span className="flex items-center justify-center shrink-0 mr-1 px-1.5 py-0.5 bg-slate-700/80 text-slate-300 text-[9px] font-bold uppercase tracking-wider rounded">
                        {preferredAccent}
                    </span>
                    <button
                        onClick={(e) => { e.stopPropagation(); playClickSound(); onEdit(wordObj); }}
                        className="text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-600 p-1.5 rounded-md transition-colors"
                        title="Edit Word"
                    >
                        ✏️
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onPlayAudio(wordObj.word); }}
                        className="text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-600 p-1.5 rounded-md transition-colors"
                        title="Play Pronunciation"
                    >
                        🔊
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); playQuitSound(); onDelete(wordObj.id); }}
                        className="text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-600 p-1.5 rounded-md transition-colors"
                        title="Delete Word"
                    >
                        🗑️
                    </button>
                </div>

            </div>
        </div>
    );
}
