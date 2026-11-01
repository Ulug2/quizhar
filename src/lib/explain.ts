import { useEffect, useState } from "react";
import { create } from "zustand";
import { useStore } from "./store";
import { ApiError, fetchExplanation } from "./api";
import type { Explanation, Question } from "./types";

const inflight = new Map<string, Promise<Explanation>>();

/** Fetches (once) and caches the explanation for a question. */
export function loadExplanation(q: Question): Promise<Explanation> {
  const cached = useStore.getState().explanations[q.id];
  if (cached) return Promise.resolve(cached);
  let p = inflight.get(q.id);
  if (!p) {
    p = fetchExplanation(q)
      .then((e) => {
        useStore.getState().setExplanation(q.id, e);
        return e;
      })
      .finally(() => inflight.delete(q.id));
    inflight.set(q.id, p);
  }
  return p;
}

export function explainError(e: unknown): string {
  return e instanceof ApiError ? e.message : "Не получилось загрузить объяснение.";
}

/** The explanation for a question, loading it if it isn't cached yet. */
export function useExplanation(q: Question | null | undefined) {
  const explanation = useStore((s) => (q ? s.explanations[q.id] : undefined));
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const id = q?.id;
  useEffect(() => {
    setError(null);
    if (!q || explanation) return;
    let alive = true;
    loadExplanation(q).catch((e) => alive && setError(explainError(e)));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, !!explanation, attempt]);
  return { explanation, error, retry: () => setAttempt((a) => a + 1) };
}

/* ---------- background seeding after an upload ---------- */

const CONCURRENCY = 6;

interface SeedState {
  /** Set when seeding stopped because of a problem the user has to fix (no code, offline…). */
  error: string | null;
  running: boolean;
}
export const useSeed = create<SeedState>(() => ({ error: null, running: false }));

const queue: Question[] = [];
const queued = new Set<string>();
let active = 0;

function pump() {
  while (active < CONCURRENCY && queue.length) {
    const q = queue.shift()!;
    if (useStore.getState().explanations[q.id]) {
      queued.delete(q.id);
      continue;
    }
    active++;
    loadExplanation(q)
      .then(() => queued.delete(q.id))
      .catch((e) => {
        const code = e instanceof ApiError ? e.code : "server_error";
        if (code === "rate_limited" || code === "api_error" || code === "server_error") {
          // Temporary: try this one again a bit later.
          setTimeout(() => {
            queue.push(q);
            pump();
          }, 8000);
          return;
        }
        // Needs the user (wrong code, offline, no key): stop and say so.
        queue.length = 0;
        queued.clear();
        useSeed.setState({ error: explainError(e) });
      })
      .finally(() => {
        active--;
        useSeed.setState({ running: active > 0 || queue.length > 0 });
        pump();
      });
  }
  useSeed.setState({ running: active > 0 || queue.length > 0 });
}

/** Queues explanations for every question in the deck that doesn't have one yet. */
export function seedDeck(deckId: string) {
  const { decks, questions, explanations } = useStore.getState();
  const deck = decks[deckId];
  if (!deck) return;
  useSeed.setState({ error: null });
  for (const id of deck.questionIds) {
    const q = questions[id];
    if (q && !explanations[id] && !queued.has(id)) {
      queued.add(id);
      queue.push(q);
    }
  }
  pump();
}

export function seedAll() {
  for (const id of useStore.getState().deckOrder) seedDeck(id);
}
