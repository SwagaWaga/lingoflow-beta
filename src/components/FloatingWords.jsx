import { useMemo } from 'react';

const WORDS = [
    // Languages
    'English', 'Spanish', 'French', 'Mandarin', 'Arabic', 'German',
    'Japanese', 'Portuguese', 'Italian', 'Korean', 'Russian', 'Hindi',
    // Learning terms
    'Fluency', 'Grammar', 'Vocabulary', 'Syntax', 'Semantics', 'Morphology',
    'Phonetics', 'Rhetoric', 'Diction', 'Lexicon', 'Comprehension', 'Inference',
    'Etymology', 'Idiom', 'Metaphor', 'Collocation', 'Discourse', 'Register',
    // IELTS / Academic terms
    'Academic', 'Analysis', 'Thesis', 'Evidence', 'Argument', 'Evaluate',
    'Interpret', 'Synthesize', 'Annotate', 'Abstract', 'Paraphrase', 'Citation',
    // Axiom rank titles
    'Initiate', 'Scholar', 'Undergraduate', 'Researcher', 'Doctoral',
    'Professor', 'Laureate',
    // Motivational
    'Mastery', 'Progress', 'Practice', 'Focus', 'Discipline', 'Growth',
    'Curiosity', 'Knowledge', 'Wisdom', 'Discovery', 'Insight', 'Excellence',
];

function seededRandom(seed) {
    const x = Math.sin(seed + 1) * 10000;
    return x - Math.floor(x);
}

export default function FloatingWords() {
    const words = useMemo(() => {
        return Array.from({ length: 28 }, (_, i) => {
            const word = WORDS[i % WORDS.length];
            const left = seededRandom(i * 3) * 95;
            const delay = seededRandom(i * 7) * 22;
            const duration = 22 + seededRandom(i * 13) * 26;
            const size = 11 + Math.floor(seededRandom(i * 5) * 12);
            const opacity = 0.08 + seededRandom(i * 11) * 0.10; // 8%–18%

            return { word, left, delay, duration, size, opacity, id: i };
        });
    }, []);

    return (
        <div
            className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none"
            aria-hidden="true"
        >
            {words.map(({ word, left, delay, duration, size, opacity, id }) => (
                <span
                    key={id}
                    className="absolute bottom-[-60px] font-bold text-slate-400 dark:text-slate-600 whitespace-nowrap"
                    style={{
                        left: `${left}%`,
                        fontSize: `${size}px`,
                        opacity,
                        animation: `floatUp ${duration}s ${delay}s linear infinite`,
                        letterSpacing: '0.06em',
                    }}
                >
                    {word}
                </span>
            ))}
        </div>
    );
}

