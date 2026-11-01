import { AnimatePresence, motion } from "framer-motion";
import { useDeferredValue, useMemo, useState } from "react";
import { MASTERED_BOX, useStore } from "../lib/store";
import { normalizeKey } from "../lib/parser";
import { LETTERS, type Question } from "../lib/types";
import { Button, TopBar, fmt, plural, softSpring } from "../components/ui";
import { IconEdit, IconSearch, IconSpark, IconX } from "../components/Icons";
import { ExplanationSheet } from "../components/ExplanationSheet";
import { Sheet } from "../components/Sheet";

type Filter = "all" | "mistakes" | "new" | "known";

export function Browse({ deckId }: { deckId: string }) {
  const deck = useStore((s) => s.decks[deckId]);
  const questions = useStore((s) => s.questions);
  const progress = useStore((s) => s.progress);
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [explainQ, setExplainQ] = useState<Question | null>(null);
  const [editQ, setEditQ] = useState<Question | null>(null);

  const list = useMemo(() => {
    if (!deck) return [];
    const needle = normalizeKey(deferred);
    return deck.questionIds
      .map((id, n) => ({ q: questions[id], n: n + 1 }))
      .filter(({ q }) => {
        if (!q) return false;
        const p = progress[q.id];
        if (filter === "mistakes" && !(p && p.wrong > 0 && p.box < MASTERED_BOX)) return false;
        if (filter === "new" && p && p.seen > 0) return false;
        if (filter === "known" && !(p && p.box >= MASTERED_BOX)) return false;
        if (!needle) return true;
        return normalizeKey(q.text + q.options.map((o) => o.text).join(" ")).includes(needle);
      });
  }, [deck, questions, progress, deferred, filter]);

  if (!deck) return null;

  const FILTERS: { id: Filter; label: string }[] = [
    { id: "all", label: "Все" },
    { id: "mistakes", label: "Ошибки" },
    { id: "new", label: "Новые" },
    { id: "known", label: "Знаю" },
  ];

  return (
    <main className="min-h-dvh pb-10">
      <TopBar title="Все вопросы" />
      <div className="sticky top-[calc(max(env(safe-area-inset-top),16px)+48px)] z-10 bg-ground px-4 pb-3">
        <div className="relative">
          <IconSearch size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-faint" />
          <input
            type="search"
            name="search"
            autoComplete="off"
            aria-label="Поиск по вопросам"
            placeholder="Поиск по словам…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 w-full rounded-full bg-surface pr-11 pl-11 text-[16px] text-ink placeholder:text-faint outline-none focus-visible:ring-2 focus-visible:ring-pink"
          />
          {query && (
            <button aria-label="Очистить поиск" onClick={() => setQuery("")} className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-faint hover:text-ink">
              <IconX size={16} />
            </button>
          )}
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto" role="tablist" aria-label="Фильтр">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`min-h-9 shrink-0 rounded-full px-4 text-[14px] font-medium transition-colors duration-150 ${
                filter === f.id ? "bg-ink text-black" : "bg-surface text-muted hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <p className="num px-4 pb-2 text-[13px] text-faint">
        {fmt.format(list.length)} {plural(list.length, "вопрос", "вопроса", "вопросов")}
      </p>

      {list.length === 0 ? (
        <p className="mx-4 rounded-[18px] bg-surface p-5 text-[15px] text-muted">Ничего не нашлось. Попробуй другое слово или фильтр.</p>
      ) : (
        <ul className="space-y-2 px-4">
          {list.map(({ q, n }) => {
            const expanded = open === q.id;
            return (
              <li key={q.id} className="row-auto">
                <div className="rounded-[18px] bg-surface">
                  <button onClick={() => setOpen(expanded ? null : q.id)} aria-expanded={expanded} className="flex w-full gap-3 p-4 text-left">
                    <span className="num w-7 shrink-0 pt-0.5 text-[13px] text-faint">{n}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[15px] leading-snug ${expanded ? "" : "line-clamp-3"}`}>{q.text}</span>
                      {!expanded &&
                        q.options.map((o, i) =>
                          o.correct ? (
                            <span key={i} className="mt-1.5 block text-[14px] leading-snug font-semibold text-pink-ink">
                              {LETTERS[i]}. {o.text}
                            </span>
                          ) : null,
                        )}
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {expanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={softSpring}
                        className="overflow-hidden"
                      >
                        <ol className="space-y-1.5 px-4 pl-14">
                          {q.options.map((o, i) => (
                            <li key={i} className={`flex gap-2 text-[15px] leading-snug ${o.correct ? "font-semibold text-pink-ink" : "text-muted"}`}>
                              <span className="w-4 shrink-0">{LETTERS[i]}</span>
                              <span>{o.text}</span>
                            </li>
                          ))}
                        </ol>
                        <div className="flex gap-2 p-4 pl-14">
                          <button onClick={() => setExplainQ(q)} className="flex min-h-10 items-center gap-1.5 rounded-full bg-raised px-4 text-[14px] font-medium hover:bg-active">
                            <IconSpark size={16} /> Объяснение
                          </button>
                          <button onClick={() => setEditQ(q)} className="flex min-h-10 items-center gap-1.5 rounded-full bg-raised px-4 text-[14px] font-medium hover:bg-active">
                            <IconEdit size={16} /> Исправить
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ExplanationSheet question={explainQ} open={!!explainQ} onClose={() => setExplainQ(null)} />
      <EditQuestion question={editQ} onClose={() => setEditQ(null)} />
    </main>
  );
}

function EditQuestion({ question, onClose }: { question: Question | null; onClose: () => void }) {
  const update = useStore((s) => s.updateQuestion);
  const setExplanation = useStore((s) => s.setExplanation);
  const [draft, setDraft] = useState<Question | null>(null);
  const [forId, setForId] = useState<string | null>(null);
  if (question && forId !== question.id) {
    setForId(question.id);
    setDraft(structuredClone(question));
  }
  const d = draft;

  return (
    <Sheet open={!!question} onClose={onClose} label="Исправить вопрос">
      {d && (
        <div className="pb-4">
          <h2 className="text-[22px] font-semibold">Исправить вопрос</h2>
          <p className="mt-1 text-[14px] text-faint">Если в файле была опечатка или не тот ответ. Нажми на букву, чтобы отметить правильный.</p>
          <label htmlFor="q-text" className="mt-5 block text-[14px] text-faint">
            Вопрос
          </label>
          <textarea
            id="q-text"
            rows={4}
            value={d.text}
            onChange={(e) => setDraft({ ...d, text: e.target.value })}
            className="mt-1 w-full rounded-[14px] bg-raised p-3 text-[16px] leading-snug outline-none focus-visible:ring-2 focus-visible:ring-pink"
          />
          <div className="mt-4 space-y-2">
            {d.options.map((o, i) => (
              <div key={i} className="flex items-start gap-2">
                <button
                  aria-label={`Отметить ${LETTERS[i]} как правильный`}
                  aria-pressed={o.correct}
                  onClick={() => setDraft({ ...d, options: d.options.map((x, j) => (j === i ? { ...x, correct: !x.correct } : x)) })}
                  className={`mt-1.5 grid size-9 shrink-0 place-items-center rounded-full text-[14px] font-semibold transition-colors duration-150 ${
                    o.correct ? "bg-pink text-black" : "bg-raised text-muted hover:bg-active"
                  }`}
                >
                  {LETTERS[i]}
                </button>
                <textarea
                  aria-label={`Вариант ${LETTERS[i]}`}
                  rows={2}
                  value={o.text}
                  onChange={(e) => setDraft({ ...d, options: d.options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
                  className="w-full rounded-[14px] bg-raised p-3 text-[15px] leading-snug outline-none focus-visible:ring-2 focus-visible:ring-pink"
                />
              </div>
            ))}
          </div>
          <Button
            className="mt-6 w-full"
            disabled={!d.text.trim() || !d.options.some((o) => o.correct)}
            onClick={() => {
              update({ ...d, text: d.text.trim(), options: d.options.map((o) => ({ ...o, text: o.text.trim() })).filter((o) => o.text) });
              setExplanation(d.id, null);
              onClose();
            }}
          >
            Сохранить
          </Button>
        </div>
      )}
    </Sheet>
  );
}
