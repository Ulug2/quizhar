import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore, type QuizMode } from "../lib/store";
import { pickQuestions } from "../lib/session";
import { LETTERS, type Question } from "../lib/types";
import { Button, ProgressBar, Ring, TopBar, fmt, listChild, listParent, plural, softSpring } from "../components/ui";
import { IconCheck, IconSpark, IconTimer, IconX } from "../components/Icons";
import { ExplanationSheet } from "../components/ExplanationSheet";
import { celebrate, centerOf } from "../components/Celebrate";

const TITLES: Record<QuizMode, string> = {
  practice: "Тренировка",
  exam: "Пробный экзамен",
  learn: "Заучивание",
  mistakes: "Работа над ошибками",
};
const ROUND = 10;

interface Answer {
  id: string;
  chosen: number | null;
  correct: boolean;
}

const isRight = (q: Question, i: number | null) => i !== null && !!q.options[i]?.correct;

export function Quiz({
  deckId,
  mode,
  count,
  shuffle,
  timed,
  ids,
}: {
  deckId: string;
  mode: QuizMode;
  count: number;
  shuffle: boolean;
  timed: boolean;
  ids?: string[];
}) {
  const deck = useStore((s) => s.decks[deckId]);
  const questions = useStore((s) => s.questions);
  const record = useStore((s) => s.record);
  const replace = useStore((s) => s.replace);
  const back = useStore((s) => s.back);

  const pool = useMemo(
    () => ids ?? (deck ? pickQuestions(deck, useStore.getState().progress, { mode, count, shuffle }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Learn mode works in rounds of 10; other modes are a single pass.
  const [roundStart, setRoundStart] = useState(0);
  const round = mode === "learn" ? pool.slice(roundStart, roundStart + ROUND) : pool;
  const [queue, setQueue] = useState<string[]>(round);
  const [pos, setPos] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [learned, setLearned] = useState<Set<string>>(new Set());
  const [missed, setMissed] = useState<Set<string>>(new Set());
  const [explain, setExplain] = useState(false);
  const [done, setDone] = useState(false);
  const streak = useRef(0);
  const runs = useRef<Record<string, number>>({});
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const exam = mode === "exam";
  const q: Question | undefined = questions[queue[pos]];
  const [secondsLeft, setSecondsLeft] = useState(timed ? Math.max(1, pool.length) * 60 : 0);

  const finishExam = (list: Answer[]) => {
    for (const a of list) record(a.id, a.correct);
    setAnswers(list);
    setDone(true);
  };

  useEffect(() => {
    if (!timed || done) return;
    const t = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [timed, done]);
  useEffect(() => {
    if (timed && !done && secondsLeft <= 0) {
      const answeredIds = new Set(answers.map((a) => a.id));
      finishExam([...answers, ...queue.filter((id) => !answeredIds.has(id)).map((id) => ({ id, chosen: null, correct: false }))]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  const choose = (idx: number) => {
    if (!q) return;
    if (exam) {
      setChosen(idx);
      return;
    }
    if (revealed) return;
    setChosen(idx);
    setRevealed(true);
    const ok = isRight(q, idx);
    record(q.id, ok);
    setAnswers((a) => [...a, { id: q.id, chosen: idx, correct: ok }]);
    if (ok) {
      streak.current++;
      const [x, y] = centerOf(optionRefs.current[idx]);
      celebrate(x, y, streak.current);
    } else {
      streak.current = 0;
      setMissed((m) => new Set(m).add(q.id));
    }
    if (mode === "learn") {
      const run = ok ? (runs.current[q.id] ?? 0) + 1 : 0;
      runs.current[q.id] = run;
      // Known on the first try, or answered right twice in a row after a miss.
      const isLearned = ok && (!missed.has(q.id) || run >= 2);
      if (isLearned) setLearned((l) => new Set(l).add(q.id));
      else setQueue((qu) => {
        const nextQueue = [...qu];
        nextQueue.splice(Math.min(nextQueue.length, pos + (ok ? 5 : 3)), 0, q.id);
        return nextQueue;
      });
    }
  };

  const next = () => {
    if (!q) return;
    if (exam) {
      const list = [...answers, { id: q.id, chosen, correct: isRight(q, chosen) }];
      setAnswers(list);
      setChosen(null);
      if (pos + 1 >= queue.length) finishExam(list);
      else setPos(pos + 1);
      return;
    }
    setChosen(null);
    setRevealed(false);
    if (pos + 1 >= queue.length) setDone(true);
    else setPos(pos + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (explain || done || !q) return;
      const n = "12345".indexOf(e.key);
      const l = "abcde".indexOf(e.key.toLowerCase());
      const idx = n >= 0 ? n : l;
      if (idx >= 0 && idx < q.options.length) choose(idx);
      else if (e.key === "Enter" && (revealed || (exam && chosen !== null))) next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!deck) return null;

  if (pool.length === 0) {
    return (
      <main className="flex min-h-dvh flex-col">
        <TopBar title={TITLES[mode]} />
        <div className="px-4 pt-10">
          <h2 className="font-serif text-[36px] leading-[1] font-semibold">{mode === "learn" ? "Всё выучено" : "Здесь пока пусто"}</h2>
          <p className="mt-3 text-[16px] text-muted">
            {mode === "learn" ? "Каждый вопрос этой колоды уже в разделе «Знаю». Можно проверить себя пробным экзаменом." : "Нет вопросов для этого режима."}
          </p>
          <Button className="mt-8 w-full" onClick={back}>
            К колоде
          </Button>
        </div>
      </main>
    );
  }

  if (done) {
    if (mode === "learn") {
      const remaining = pool.length - (roundStart + round.length);
      return (
        <LearnRoundDone
          learned={round.length}
          remaining={remaining}
          onNext={() => {
            const start = roundStart + ROUND;
            setRoundStart(start);
            setQueue(pool.slice(start, start + ROUND));
            setPos(0);
            setAnswers([]);
            setLearned(new Set());
            setMissed(new Set());
            runs.current = {};
            setDone(false);
          }}
          onExit={back}
        />
      );
    }
    return (
      <Results
        title={TITLES[mode]}
        answers={answers}
        onRetryWrong={(wrong) => replace({ name: "quiz", deckId, mode: "practice", count: 0, shuffle: false, timed: false, ids: wrong })}
        onExit={back}
      />
    );
  }

  if (!q) return null;
  const progress = mode === "learn" ? learned.size / Math.max(1, round.length) : pos / queue.length;
  const mm = Math.floor(Math.max(0, secondsLeft) / 60);
  const ss = String(Math.max(0, secondsLeft) % 60).padStart(2, "0");

  return (
    <main className="flex h-dvh flex-col">
      <TopBar
        title={TITLES[mode]}
        right={
          timed ? (
            <span className={`num flex items-center gap-1.5 text-[15px] ${secondsLeft < 60 ? "text-bad" : "text-muted"}`}>
              <IconTimer size={16} /> {mm}:{ss}
            </span>
          ) : mode === "learn" ? (
            <span className="num text-[15px] text-muted">
              {fmt.format(learned.size)} / {fmt.format(round.length)}
            </span>
          ) : (
            <span className="num text-[15px] text-muted">
              {fmt.format(pos + 1)} / {fmt.format(queue.length)}
            </span>
          )
        }
      />
      <div className="px-4">
        <ProgressBar value={progress} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${q.id}-${pos}`}
            initial={{ opacity: 0, x: 36 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -36 }}
            transition={softSpring}
          >
            {mode === "learn" && missed.has(q.id) && <p className="mt-5 text-[14px] text-pink-ink">Этот вопрос уже встречался — вспомни ответ</p>}
            <p className={`mt-5 font-medium text-pretty ${q.text.length > 200 ? "text-[18px] leading-snug" : "text-[22px] leading-snug"}`}>{q.text}</p>
            <ul className="mt-6 space-y-2.5">
              {q.options.map((o, i) => (
                <li key={i}>
                  <OptionButton
                    ref={(el) => {
                      optionRefs.current[i] = el;
                    }}
                    letter={LETTERS[i]}
                    text={o.text}
                    state={
                      exam
                        ? chosen === i
                          ? "selected"
                          : "idle"
                        : !revealed
                          ? "idle"
                          : o.correct
                            ? "correct"
                            : chosen === i
                              ? "wrong"
                              : "dim"
                    }
                    onClick={() => choose(i)}
                    disabled={!exam && revealed}
                  />
                </li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="safe-bottom px-4 pt-3">
        <AnimatePresence mode="wait" initial={false}>
          {exam ? (
            <motion.div key="exam" className="flex">
              <Button className="w-full" disabled={chosen === null} onClick={next}>
                {pos + 1 >= queue.length ? "Завершить экзамен" : "Дальше"}
              </Button>
            </motion.div>
          ) : revealed ? (
            <motion.div
              key="after"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={softSpring}
              className="grid grid-cols-[auto_1fr] gap-3"
            >
              <Button tone="grey" onClick={() => setExplain(true)}>
                <IconSpark size={20} /> Почему
              </Button>
              <Button onClick={next}>Дальше</Button>
            </motion.div>
          ) : (
            <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-h-13 items-center justify-center text-[14px] text-faint">
              Выбери ответ
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <ExplanationSheet question={q} open={explain} onClose={() => setExplain(false)} />
    </main>
  );
}

type OptState = "idle" | "selected" | "correct" | "wrong" | "dim";

function OptionButton({
  letter,
  text,
  state,
  onClick,
  disabled,
  ref,
}: {
  letter: string;
  text: string;
  state: OptState;
  onClick: () => void;
  disabled?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}) {
  const box = {
    idle: "bg-surface hover:bg-raised",
    selected: "bg-ink text-black",
    correct: "bg-pink-tint text-ink ring-2 ring-pink",
    wrong: "bg-bad-tint text-muted",
    dim: "bg-surface opacity-50",
  }[state];
  const badge = {
    idle: "bg-raised text-muted",
    selected: "bg-black text-ink",
    correct: "bg-pink text-black",
    wrong: "bg-bad text-black",
    dim: "bg-raised text-faint",
  }[state];
  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      animate={state === "wrong" ? { x: [0, -8, 8, -5, 5, 0] } : state === "correct" ? { scale: [1, 1.025, 1] } : { x: 0, scale: 1 }}
      transition={{ duration: 0.4 }}
      aria-label={`${letter}. ${text}${state === "correct" ? " — правильный ответ" : state === "wrong" ? " — неверно" : ""}`}
      className={`flex min-h-14 w-full items-start gap-3 rounded-[18px] px-4 py-3.5 text-left transition-colors duration-200 disabled:cursor-default ${box}`}
    >
      <span className={`grid size-7 shrink-0 place-items-center rounded-full text-[14px] font-semibold transition-colors duration-200 ${badge}`}>
        {state === "correct" ? <IconCheck size={16} /> : state === "wrong" ? <IconX size={16} /> : letter}
      </span>
      <span className={`pt-0.5 text-[16px] leading-snug ${state === "wrong" ? "line-through decoration-1" : ""}`}>
        {state === "correct" || state === "wrong" ? <span className="font-semibold no-underline">{letter}. </span> : null}
        {text}
      </span>
    </motion.button>
  );
}

function verdict(pct: number) {
  if (pct >= 90) return "Блестяще";
  if (pct >= 75) return "Отлично";
  if (pct >= 60) return "Хорошо, почти готова";
  if (pct >= 40) return "Неплохо для начала";
  return "Будем учить вместе";
}

function Results({
  title,
  answers,
  onRetryWrong,
  onExit,
}: {
  title: string;
  answers: Answer[];
  onRetryWrong: (ids: string[]) => void;
  onExit: () => void;
}) {
  const questions = useStore((s) => s.questions);
  const name = useStore((s) => s.settings.name) || "Ажар";
  const [explainQ, setExplainQ] = useState<Question | null>(null);
  const right = answers.filter((a) => a.correct).length;
  const pct = answers.length ? Math.round((right / answers.length) * 100) : 0;
  const wrong = answers.filter((a) => !a.correct);

  useEffect(() => {
    if (pct >= 60) celebrate(window.innerWidth / 2, 200, 0);
  }, [pct]);

  return (
    <main className="safe-bottom min-h-dvh">
      <TopBar title={title} />
      <section className="px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={softSpring} className="flex items-center gap-5 pt-4">
          <Ring value={pct / 100} size={128} stroke={11}>
            <span className="num text-[30px] font-semibold">{pct}%</span>
          </Ring>
          <div className="min-w-0">
            <h2 className="font-serif text-[34px] leading-[1] font-semibold text-balance">{verdict(pct)}</h2>
            <p className="num mt-2 text-[16px] text-muted">
              Верно {fmt.format(right)} из {fmt.format(answers.length)}
            </p>
          </div>
        </motion.div>
        {pct >= 60 && <p className="mt-5 font-serif text-[22px] italic text-pink-ink">{name}, я тобой горжусь</p>}

        {wrong.length > 0 && (
          <>
            <h3 className="mt-9 text-[18px] font-semibold">
              {fmt.format(wrong.length)} {plural(wrong.length, "ошибка", "ошибки", "ошибок")} — повтори их
            </h3>
            <motion.ul variants={listParent} initial="hidden" animate="show" className="mt-3 space-y-3">
              {wrong.map((a) => {
                const q = questions[a.id];
                if (!q) return null;
                return (
                  <motion.li key={a.id} variants={listChild}>
                    <button onClick={() => setExplainQ(q)} className="row-auto w-full rounded-[18px] bg-surface p-4 text-left hover:bg-raised">
                      <p className="line-clamp-3 text-[15px] leading-snug">{q.text}</p>
                      {a.chosen !== null ? (
                        <p className="mt-2 text-[14px] text-faint line-through">
                          {LETTERS[a.chosen]}. {q.options[a.chosen]?.text}
                        </p>
                      ) : (
                        <p className="mt-2 text-[14px] text-faint">Без ответа</p>
                      )}
                      {q.options.map((o, i) =>
                        o.correct ? (
                          <p key={i} className="mt-1 text-[15px] font-semibold text-pink-ink">
                            {LETTERS[i]}. {o.text}
                          </p>
                        ) : null,
                      )}
                      <span className="mt-2 flex items-center gap-1.5 text-[13px] text-faint">
                        <IconSpark size={14} /> Объяснение
                      </span>
                    </button>
                  </motion.li>
                );
              })}
            </motion.ul>
          </>
        )}
        <div className="mt-8 space-y-3">
          {wrong.length > 0 && (
            <Button className="w-full" onClick={() => onRetryWrong(wrong.map((a) => a.id))}>
              Повторить ошибки
            </Button>
          )}
          <Button tone={wrong.length ? "grey" : "pink"} className="w-full" onClick={onExit}>
            К колоде
          </Button>
        </div>
      </section>
      <ExplanationSheet question={explainQ} open={!!explainQ} onClose={() => setExplainQ(null)} />
    </main>
  );
}

function LearnRoundDone({ learned, remaining, onNext, onExit }: { learned: number; remaining: number; onNext: () => void; onExit: () => void }) {
  const name = useStore((s) => s.settings.name) || "Ажар";
  useEffect(() => {
    celebrate(window.innerWidth / 2, window.innerHeight / 3, 0);
  }, []);
  return (
    <main className="flex min-h-dvh flex-col">
      <TopBar title="Заучивание" />
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={softSpring} className="safe-bottom flex flex-1 flex-col px-4 pt-10">
        <h2 className="font-serif text-[40px] leading-[1] font-semibold text-balance">Раунд пройден</h2>
        <p className="mt-4 text-[17px] text-muted">
          {name}, ещё {fmt.format(learned)} {plural(learned, "ответ", "ответа", "ответов")} в памяти.
          {remaining > 0 ? ` Осталось ${fmt.format(remaining)}.` : " Это была последняя порция."}
        </p>
        <div className="mt-auto space-y-3 pt-8">
          {remaining > 0 && (
            <Button className="w-full" onClick={onNext}>
              Следующие {fmt.format(Math.min(ROUND, remaining))}
            </Button>
          )}
          <Button tone={remaining > 0 ? "grey" : "pink"} className="w-full" onClick={onExit}>
            К колоде
          </Button>
        </div>
      </motion.div>
    </main>
  );
}
