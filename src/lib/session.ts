import { MASTERED_BOX, type QuizMode } from "./store";
import type { Deck, Progress } from "./types";

export function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const isMastered = (p?: Progress) => !!p && p.box >= MASTERED_BOX;
const isMistake = (p?: Progress) => !!p && p.wrong > 0 && p.box < MASTERED_BOX;

/** Question ids for a session. Only the order of questions may change; answer options never move. */
export function pickQuestions(
  deck: Deck,
  progress: Record<string, Progress>,
  opts: { mode?: QuizMode | "cards"; count?: number; shuffle?: boolean; onlyUnknown?: boolean },
): string[] {
  let ids = deck.questionIds;
  if (opts.onlyUnknown) ids = ids.filter((id) => !isMastered(progress[id]));
  if (opts.mode === "mistakes") ids = ids.filter((id) => isMistake(progress[id]));
  if (opts.mode === "learn") {
    // Least-known first, then in file order.
    ids = ids
      .filter((id) => !isMastered(progress[id]))
      .map((id, i) => ({ id, i, box: progress[id]?.box ?? -1 }))
      .sort((a, b) => b.box - a.box || a.i - b.i)
      .map((x) => x.id);
  }
  if (opts.shuffle || opts.mode === "mistakes") ids = shuffled(ids);
  if (opts.count && opts.count > 0) ids = ids.slice(0, opts.count);
  return ids;
}
