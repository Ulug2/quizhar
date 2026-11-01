export interface Option {
  text: string;
  correct: boolean;
}

export interface Question {
  /** Stable hash of the normalized question + options: identical questions share one id. */
  id: string;
  text: string;
  /** Options in the exact order of the source file. Never shuffled. */
  options: Option[];
}

export interface Deck {
  id: string;
  name: string;
  createdAt: number;
  sourceFiles: string[];
  questionIds: string[];
}

export interface Progress {
  seen: number;
  correct: number;
  wrong: number;
  /** Leitner box 0..5. 0 = new/forgotten, 5 = mastered. */
  box: number;
  lastSeen: number;
}

export interface Explanation {
  why_correct: string;
  /** Missing on explanations cached before examples were added. */
  example?: string;
  wrong_options: { letter: string; why: string }[];
  mnemonic: string;
  key_link: string;
  summary: string;
}

export interface ParsedQuestion {
  text: string;
  options: Option[];
}

export const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
