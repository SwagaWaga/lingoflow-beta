export interface WordConnections {
  synonyms: string[];
  antonyms: string[];
  wordFamily: string;
  collocations: string[];
}

export interface VocabularyWord {
  id?: string;
  word: string;
  definition: string;
  part_of_speech?: string;
  context?: string;
  mastery_level: number;
  dna_type?: string;
  last_practiced?: string | null;
  word_connections?: WordConnections | null;
}
