import { animate, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from "framer-motion";
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import { useStore } from "../lib/store";
import { pickQuestions } from "../lib/session";
import { useExplanation } from "../lib/explain";
import { LETTERS, type Question } from "../lib/types";
import { Button, ProgressBar, TopBar, fmt, softSpring } from "../components/ui";
import { IconCheck, IconRotate, IconX } from "../components/Icons";
import { celebrate, centerOf } from "../components/Celebrate";
import { NAME } from "../lib/compliments";

function sizeFor(text: string) {
  if (text.length > 320) return "text-[16px] leading-snug";
  if (text.length > 180) return "text-[18px] leading-snug";
  if (text.length > 90) return "text-[21px] leading-snug";
  return "text-[25px] leading-tight";
}

/** How far (share of screen width) a card must be dragged before letting go counts as an answer. */
const SWIPE_SHARE = 0.32;

export function Flashcards({ deckId, onlyUnknown, shuffle }: { deckId: string; onlyUnknown: boolean; shuffle: boolean }) {
  const deck = useStore((s) => s.decks[deckId]);
  const questions = useStore((s) => s.questions);
  const record = useStore((s) => s.record);
  const back = useStore((s) => s.back);

  const initial = useMemo(
    () => (deck ? pickQuestions(deck, useStore.getState().progress, { mode: "cards", onlyUnknown, shuffle }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [ids, setIds] = useState(initial);
  const [i, setI] = useState(0);
  const [known, setKnown] = useState<string[]>([]);
  const [unknown, setUnknown] = useState<string[]>([]);
  const streak = useRef(0);
  const knowBtn = useRef<HTMLButtonElement>(null);
  const card = useRef<CardHandle>(null);

  const q: Question | undefined = questions[ids[i]];
  const nextQ: Question | undefined = questions[ids[i + 1]];
  const finished = i >= ids.length;

  const onAnswered = (knows: boolean) => {
    if (!q) return;
    record(q.id, knows);
    if (knows) {
      streak.current++;
      const [cx, cy] = centerOf(knowBtn.current);
      celebrate(cx, cy, streak.current);
      setKnown((k) => [...k, q.id]);
    } else {
      streak.current = 0;
      setUnknown((u) => [...u, q.id]);
    }
    setI((n) => n + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (finished) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        card.current?.flip();
      } else if (e.key === "ArrowRight") card.current?.fling(true);
      else if (e.key === "ArrowLeft") card.current?.fling(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finished]);

  const restart = (list: string[]) => {
    setIds(list);
    setI(0);
    setKnown([]);
    setUnknown([]);
    streak.current = 0;
  };

  if (!deck) return null;

  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      <TopBar
        title="Карточки"
        right={
          !finished && (
            <span className="num text-[15px] text-muted">
              {fmt.format(i + 1)} / {fmt.format(ids.length)}
            </span>
          )
        }
      />
      <div className="px-4">
        <ProgressBar value={ids.length ? i / ids.length : 0} />
      </div>

      {finished ? (
        <RoundDone known={known.length} unknown={unknown.length} onRepeatUnknown={() => restart(unknown)} onRepeatAll={() => restart(initial)} onExit={back} />
      ) : (
        <>
          <div className="relative mx-4 mt-5 flex-1">
            {nextQ && <div className="absolute inset-0 translate-y-3 scale-[0.95] rounded-[28px] bg-surface" aria-hidden="true" />}
            {q && <SwipeCard key={`${q.id}-${i}`} ref={card} q={q} onAnswered={onAnswered} />}
          </div>

          <div className="safe-bottom grid grid-cols-2 gap-3 px-4 pt-5">
            <Button tone="grey" onClick={() => card.current?.fling(false)}>
              <IconX size={20} /> Ещё учу
            </Button>
            <Button ref={knowBtn} onClick={() => card.current?.fling(true)}>
              <IconCheck size={20} /> Знаю
            </Button>
          </div>
        </>
      )}
    </main>
  );
}

interface CardHandle {
  fling: (knows: boolean) => void;
  flip: () => void;
}

/**
 * One card. It follows the finger exactly while held; on release it either flies off (if dragged
 * past the threshold) or springs back. The flip is two flat half-turns, so the face at rest is never
 * rotated and everything on it stays tappable and scrollable.
 */
function SwipeCard({ q, onAnswered, ref }: { q: Question; onAnswered: (knows: boolean) => void; ref?: Ref<CardHandle> }) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-400, 0, 400], [-14, 0, 14]);
  const threshold = () => window.innerWidth * SWIPE_SHARE;
  const knowOpacity = useTransform(x, (v) => Math.min(1, Math.max(0, v / threshold())));
  const learnOpacity = useTransform(x, (v) => Math.min(1, Math.max(0, -v / threshold())));
  const rotY = useMotionValue(0);
  const [side, setSide] = useState<"front" | "back">("front");
  const busy = useRef(false);
  const gone = useRef(false);

  const flip = async () => {
    if (busy.current || gone.current) return;
    busy.current = true;
    if (reduce) {
      setSide((s) => (s === "front" ? "back" : "front"));
    } else {
      await animate(rotY, 90, { duration: 0.1, ease: [0.4, 0, 1, 1] });
      setSide((s) => (s === "front" ? "back" : "front"));
      rotY.set(-90);
      await animate(rotY, 0, { duration: 0.17, ease: [0, 0, 0.2, 1] });
    }
    busy.current = false;
  };

  const flyOut = async (knows: boolean, velocity = 0) => {
    if (gone.current) return;
    gone.current = true;
    const target = (knows ? 1 : -1) * (window.innerWidth + 160);
    await animate(x, target, { type: "tween", duration: 0.3, ease: [0.25, 1, 0.5, 1], velocity });
    onAnswered(knows);
  };

  useImperativeHandle(ref, () => ({ fling: (k) => flyOut(k), flip }));

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (gone.current) return;
    const dx = x.get();
    if (Math.abs(dx) >= threshold()) flyOut(dx > 0, info.velocity.x);
    else animate(x, 0, { type: "spring", stiffness: 420, damping: 32, velocity: info.velocity.x });
  };

  return (
    <motion.div
      className="absolute inset-0 touch-pan-y select-none"
      style={{ x, rotate, transformOrigin: "50% 90%" }}
      initial={{ scale: 0.95, y: 12 }}
      animate={{ scale: 1, y: 0 }}
      transition={softSpring}
      drag="x"
      dragMomentum={false}
      dragElastic={0}
      onDragEnd={onDragEnd}
      onTap={(e) => {
        // Taps on the card's own buttons don't flip it.
        if ((e.target as HTMLElement).closest("button")) return;
        flip();
      }}
    >
      <motion.div className="relative h-full w-full" style={{ rotateY: rotY, transformPerspective: 1200 }}>
        {side === "front" ? <CardFront q={q} /> : <CardBack q={q} />}
      </motion.div>

      <motion.span style={{ opacity: knowOpacity }} className="pointer-events-none absolute top-5 left-5 rounded-full bg-black px-4 py-1.5 text-[15px] font-semibold text-pink ring-2 ring-pink">
        Знаю
      </motion.span>
      <motion.span style={{ opacity: learnOpacity }} className="pointer-events-none absolute top-5 right-5 rounded-full bg-black px-4 py-1.5 text-[15px] font-semibold text-ink ring-2 ring-ink">
        Ещё учу
      </motion.span>
    </motion.div>
  );
}

function CardFront({ q }: { q: Question }) {
  const showOptions = useStore((s) => s.settings.showOptionsOnCards);
  return (
    <div className="absolute inset-0 flex flex-col rounded-[28px] bg-raised p-6">
      <span className="text-[14px] text-faint">Вопрос</span>
      <div className="sheet-scroll mt-3 min-h-0 flex-1 overflow-y-auto">
        <p className={`font-medium text-pretty ${sizeFor(q.text)}`}>{q.text}</p>
        {showOptions && (
          <ol className="mt-5 space-y-2">
            {q.options.map((o, i) => (
              <li key={i} className="flex gap-2 text-[15px] leading-snug text-muted">
                <span className="w-4 shrink-0 font-semibold">{LETTERS[i]}</span>
                <span>{o.text}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <span className="mt-4 flex items-center gap-2 text-[14px] text-faint">
        <IconRotate size={16} /> Нажми, чтобы увидеть ответ
      </span>
    </div>
  );
}

function CardBack({ q }: { q: Question }) {
  const correct = q.options.map((o, i) => ({ ...o, letter: LETTERS[i] })).filter((o) => o.correct);
  const longest = correct.reduce((m, o) => Math.max(m, o.text.length), 0);
  const { explanation: ex, error, retry } = useExplanation(q);

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden rounded-[28px] bg-pink text-black">
      <div className="sheet-scroll min-h-0 flex-1 overflow-y-auto p-6">
        <span className="text-[14px] font-medium">Ответ</span>
        {correct.map((o) => (
          <div key={o.letter} className="mt-1">
            <span className="font-serif text-[64px] leading-[0.9] font-semibold italic">{o.letter}</span>
            <p className={`mt-1 font-semibold text-pretty ${sizeFor("x".repeat(longest))}`}>{o.text}</p>
          </div>
        ))}

        <div className="mt-6 rounded-[20px] bg-black p-4 text-ink">
          {ex ? (
            <div className="space-y-4">
              <p className="text-[16px] leading-snug font-medium text-pretty">{ex.summary}</p>
              <div>
                <p className="text-[13px] text-faint">Как запомнить</p>
                <p className="mt-0.5 font-serif text-[22px] leading-[1.15] font-semibold italic text-pink-ink text-pretty">{ex.mnemonic}</p>
                <p className="mt-1.5 text-[14px] text-muted">{ex.key_link}</p>
              </div>
              <Block title="Почему так">{ex.why_correct}</Block>
              {ex.example && <Block title="Пример">{ex.example}</Block>}
              {ex.wrong_options.length > 0 && (
                <div>
                  <p className="text-[13px] text-faint">Почему не другие</p>
                  <ul className="mt-1.5 space-y-2">
                    {ex.wrong_options.map((w) => (
                      <li key={w.letter} className="flex gap-2.5 text-[14px] leading-snug text-muted">
                        <span className="w-4 shrink-0 font-semibold text-ink">{w.letter}</span>
                        <span>{w.why}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : error ? (
            <div>
              <p className="text-[15px]">{error}</p>
              <button onClick={retry} className="mt-2 min-h-11 font-semibold text-pink-ink">
                Попробовать ещё раз
              </button>
            </div>
          ) : (
            <div className="space-y-2.5" aria-busy="true">
              <p className="text-[14px] text-faint">ИИ готовит объяснение…</p>
              {[92, 100, 70].map((w, i) => (
                <motion.div
                  key={i}
                  className="h-3.5 rounded-full bg-raised"
                  style={{ width: `${w}%` }}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.12 }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[13px] text-faint">{title}</p>
      <p className="mt-0.5 text-[15px] leading-relaxed text-pretty">{children}</p>
    </div>
  );
}

function RoundDone({
  known,
  unknown,
  onRepeatUnknown,
  onRepeatAll,
  onExit,
}: {
  known: number;
  unknown: number;
  onRepeatUnknown: () => void;
  onRepeatAll: () => void;
  onExit: () => void;
}) {
  const total = known + unknown;
  const allKnown = unknown === 0 && total > 0;
  useEffect(() => {
    if (allKnown) celebrate(window.innerWidth / 2, window.innerHeight / 2.5, 0);
  }, [allKnown]);
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={softSpring} className="safe-bottom flex flex-1 flex-col px-4 pt-10">
      <h2 className="font-serif text-[40px] leading-[1] font-semibold text-balance">
        {total === 0 ? "Здесь пока пусто" : allKnown ? "Умница моя, всё знаешь!" : `Круг пройден, ${NAME}`}
      </h2>
      {total > 0 && (
        <dl className="mt-8 grid grid-cols-2 divide-x divide-line rounded-[22px] bg-surface py-5 text-center">
          <div>
            <dd className="num text-[34px] leading-none font-semibold text-pink">{fmt.format(known)}</dd>
            <dt className="mt-1 text-[14px] text-faint">Знаю</dt>
          </div>
          <div>
            <dd className="num text-[34px] leading-none font-semibold">{fmt.format(unknown)}</dd>
            <dt className="mt-1 text-[14px] text-faint">Ещё учу</dt>
          </div>
        </dl>
      )}
      <div className="mt-auto space-y-3 pt-8">
        {unknown > 0 && (
          <Button className="w-full" onClick={onRepeatUnknown}>
            Повторить {fmt.format(unknown)} невыученных
          </Button>
        )}
        {total > 0 && (
          <Button tone={unknown > 0 ? "grey" : "pink"} className="w-full" onClick={onRepeatAll}>
            Пройти ещё раз
          </Button>
        )}
        <Button tone="ghost" className="w-full" onClick={onExit}>
          К колоде
        </Button>
      </div>
    </motion.div>
  );
}
