import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { Sheet } from "./Sheet";
import { IconRotate } from "./Icons";
import { listChild, listParent } from "./ui";
import { useStore } from "../lib/store";
import { fetchExplanation, ApiError } from "../lib/api";
import { LETTERS, type Explanation, type Question } from "../lib/types";

const inflight = new Map<string, Promise<Explanation>>();

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

export function ExplanationSheet({ question, open, onClose }: { question: Question | null; open: boolean; onClose: () => void }) {
  const explanation = useStore((s) => (question ? s.explanations[question.id] : undefined));
  const setExplanation = useStore((s) => s.setExplanation);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!question) return;
    setError(null);
    setLoading(true);
    loadExplanation(question)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Не получилось загрузить объяснение."))
      .finally(() => setLoading(false));
  }, [question]);

  useEffect(() => {
    if (open && question && !explanation) load();
  }, [open, question, explanation, load]);

  if (!question) return null;
  const correct = question.options.map((o, i) => ({ ...o, letter: LETTERS[i] })).filter((o) => o.correct);

  return (
    <Sheet open={open} onClose={onClose} label="Объяснение">
      <div className="pb-4">
        <h2 className="text-[22px] leading-tight font-semibold text-balance">Объяснение</h2>
        <p className="mt-2 text-[15px] leading-snug text-muted line-clamp-3">{question.text}</p>

        <div className="mt-4 rounded-[18px] bg-pink-tint p-4">
          {correct.map((o) => (
            <p key={o.letter} className="text-[17px] leading-snug font-medium text-pink-ink">
              <span className="font-semibold">{o.letter}.</span> {o.text}
            </p>
          ))}
        </div>

        {explanation ? (
          <motion.div variants={listParent} initial="hidden" animate="show" className="mt-6 space-y-6">
            <motion.p variants={listChild} className="text-[18px] leading-snug font-medium text-pretty">
              {explanation.summary}
            </motion.p>
            <Section title="Почему это правильно">{explanation.why_correct}</Section>
            <motion.section variants={listChild} className="rounded-[18px] bg-raised p-4">
              <h3 className="text-[14px] text-faint">Как запомнить</h3>
              <p className="mt-1 font-serif text-[24px] leading-[1.15] font-semibold italic text-pink-ink text-pretty">
                {explanation.mnemonic}
              </p>
              <p className="mt-3 text-[15px] text-muted">{explanation.key_link}</p>
            </motion.section>
            {explanation.wrong_options.length > 0 && (
              <motion.section variants={listChild}>
                <h3 className="text-[14px] text-faint">Почему не другие</h3>
                <ul className="mt-2 space-y-3">
                  {explanation.wrong_options.map((w) => (
                    <li key={w.letter} className="flex gap-3 text-[15px] leading-snug">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-raised text-[13px] font-semibold text-muted">
                        {w.letter}
                      </span>
                      <span className="pt-0.5">{w.why}</span>
                    </li>
                  ))}
                </ul>
              </motion.section>
            )}
            <motion.button
              variants={listChild}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                setExplanation(question.id, null);
              }}
              className="flex min-h-11 items-center gap-2 text-[15px] text-faint hover:text-ink"
            >
              <IconRotate size={16} /> Объяснить по-другому
            </motion.button>
          </motion.div>
        ) : error ? (
          <div className="mt-6 rounded-[18px] bg-raised p-4">
            <p className="text-[15px]">{error}</p>
            <button onClick={load} className="mt-2 min-h-11 font-semibold text-pink-ink">
              Попробовать ещё раз
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-3" aria-busy={loading}>
            <p className="text-[15px] text-faint">ИИ готовит объяснение…</p>
            {[92, 100, 76, 100, 64].map((w, i) => (
              <motion.div
                key={i}
                className="h-4 rounded-full bg-raised"
                style={{ width: `${w}%` }}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.12 }}
              />
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.section variants={listChild}>
      <h3 className="text-[14px] text-faint">{title}</h3>
      <p className="mt-1 text-[16px] leading-relaxed text-pretty">{children}</p>
    </motion.section>
  );
}
