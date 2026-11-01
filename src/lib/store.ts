import { create } from "zustand";
import { get as idbGet, set as idbSet } from "idb-keyval";
import type { Deck, Explanation, Progress, Question } from "./types";

export type Screen = (
  | { name: "home" }
  | { name: "deck"; deckId: string }
  | { name: "cards"; deckId: string; onlyUnknown: boolean; shuffle: boolean }
  | { name: "quiz"; deckId: string; mode: QuizMode; count: number; shuffle: boolean; timed: boolean; ids?: string[] }
  | { name: "browse"; deckId: string }
  | { name: "settings" }
) & { uid?: number };

let uid = 0;

export type QuizMode = "practice" | "exam" | "learn" | "mistakes";

export interface Settings {
  accessCode: string;
  showOptionsOnCards: boolean;
  onboarded: boolean;
}

interface Streak {
  lastDay: string;
  days: number;
  answeredToday: number;
  correctToday: number;
}

interface Data {
  decks: Record<string, Deck>;
  deckOrder: string[];
  questions: Record<string, Question>;
  progress: Record<string, Progress>;
  explanations: Record<string, Explanation>;
  settings: Settings;
  streak: Streak;
}

interface State extends Data {
  hydrated: boolean;
  stack: Screen[];
  go: (s: Screen) => void;
  back: () => void;
  replace: (s: Screen) => void;
  addDeck: (name: string, files: string[], qs: Question[]) => string;
  renameDeck: (id: string, name: string) => void;
  deleteDeck: (id: string) => void;
  updateQuestion: (q: Question) => void;
  record: (qid: string, correct: boolean) => void;
  setExplanation: (qid: string, e: Explanation | null) => void;
  updateSettings: (s: Partial<Settings>) => void;
  resetProgress: () => void;
}

const today = () => new Date().toLocaleDateString("sv-SE");

const DEFAULT: Data = {
  decks: {},
  deckOrder: [],
  questions: {},
  progress: {},
  explanations: {},
  settings: { accessCode: "", showOptionsOnCards: false, onboarded: false },
  streak: { lastDay: "", days: 0, answeredToday: 0, correctToday: 0 },
};

const PERSISTED = Object.keys(DEFAULT) as (keyof Data)[];

export const emptyProgress = (): Progress => ({ seen: 0, correct: 0, wrong: 0, box: 0, lastSeen: 0 });
export const MASTERED_BOX = 3;

export const useStore = create<State>()((set) => ({
  ...DEFAULT,
  hydrated: false,
  stack: [{ name: "home" }],
  go: (s) => set((st) => ({ stack: [...st.stack, { ...s, uid: ++uid }] })),
  back: () => set((st) => ({ stack: st.stack.length > 1 ? st.stack.slice(0, -1) : st.stack })),
  replace: (s) => set((st) => ({ stack: [...st.stack.slice(0, -1), { ...s, uid: ++uid }] })),

  addDeck: (name, files, qs) => {
    const id = Math.random().toString(36).slice(2, 10);
    set((st) => {
      const questions = { ...st.questions };
      for (const q of qs) if (!questions[q.id]) questions[q.id] = q;
      const deck: Deck = { id, name, createdAt: Date.now(), sourceFiles: files, questionIds: qs.map((q) => q.id) };
      return { questions, decks: { ...st.decks, [id]: deck }, deckOrder: [id, ...st.deckOrder] };
    });
    return id;
  },
  renameDeck: (id, name) => set((st) => ({ decks: { ...st.decks, [id]: { ...st.decks[id], name } } })),
  deleteDeck: (id) =>
    set((st) => {
      const decks = { ...st.decks };
      delete decks[id];
      // Drop questions no other deck uses (progress for shared questions survives).
      const used = new Set(Object.values(decks).flatMap((d) => d.questionIds));
      const questions: Record<string, Question> = {};
      for (const [k, v] of Object.entries(st.questions)) if (used.has(k)) questions[k] = v;
      return { decks, questions, deckOrder: st.deckOrder.filter((d) => d !== id) };
    }),
  updateQuestion: (q) => set((st) => ({ questions: { ...st.questions, [q.id]: q } })),

  record: (qid, correct) =>
    set((st) => {
      const p = st.progress[qid] ?? emptyProgress();
      const next: Progress = {
        seen: p.seen + 1,
        correct: p.correct + (correct ? 1 : 0),
        wrong: p.wrong + (correct ? 0 : 1),
        box: correct ? Math.min(5, p.box + 1) : 0,
        lastSeen: Date.now(),
      };
      const d = today();
      let streak = st.streak;
      if (streak.lastDay !== d) {
        const y = new Date(Date.now() - 864e5).toLocaleDateString("sv-SE");
        streak = { lastDay: d, days: streak.lastDay === y ? streak.days + 1 : 1, answeredToday: 0, correctToday: 0 };
      }
      streak = { ...streak, answeredToday: streak.answeredToday + 1, correctToday: streak.correctToday + (correct ? 1 : 0) };
      return { progress: { ...st.progress, [qid]: next }, streak };
    }),
  setExplanation: (qid, e) =>
    set((st) => {
      const explanations = { ...st.explanations };
      if (e) explanations[qid] = e;
      else delete explanations[qid];
      return { explanations };
    }),
  updateSettings: (s) => set((st) => ({ settings: { ...st.settings, ...s } })),
  resetProgress: () => set({ progress: {}, streak: DEFAULT.streak }),
}));

/* ---------- persistence (IndexedDB) ---------- */

export async function hydrate() {
  try {
    const entries = await Promise.all(PERSISTED.map((k) => idbGet(`quizhar:${k}`)));
    const patch: Partial<Data> = {};
    PERSISTED.forEach((k, i) => {
      if (entries[i] !== undefined) (patch as Record<string, unknown>)[k] = entries[i];
    });
    patch.settings = { ...DEFAULT.settings, ...(patch.settings ?? {}) };
    useStore.setState({ ...patch, hydrated: true });
  } catch {
    useStore.setState({ hydrated: true });
  }
  navigator.storage?.persist?.().catch(() => {});

  const timers: Partial<Record<keyof Data, ReturnType<typeof setTimeout>>> = {};
  useStore.subscribe((st, prev) => {
    for (const k of PERSISTED) {
      if (st[k] === prev[k]) continue;
      clearTimeout(timers[k]);
      timers[k] = setTimeout(() => idbSet(`quizhar:${k}`, useStore.getState()[k]).catch(() => {}), 300);
    }
  });
}

/* ---------- selectors ---------- */

export function deckStats(deck: Deck, progress: Record<string, Progress>) {
  let fresh = 0,
    learning = 0,
    mastered = 0,
    mistakes = 0;
  for (const id of deck.questionIds) {
    const p = progress[id];
    if (!p || p.seen === 0) fresh++;
    else if (p.box >= MASTERED_BOX) mastered++;
    else learning++;
    if (p && p.wrong > 0 && p.box < MASTERED_BOX) mistakes++;
  }
  const total = deck.questionIds.length;
  return { total, fresh, learning, mastered, mistakes, pct: total ? Math.round((mastered / total) * 100) : 0 };
}
