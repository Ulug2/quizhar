import { animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "framer-motion";
import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Ref } from "react";
import { useStore } from "../lib/store";
import { pickQuestions } from "../lib/session";
import { useExplanation } from "../lib/explain";
import { Rich } from "../components/Rich";
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
  const progress = useMotionValue(0);

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

  // After the swap, the old under-card is on top at full size and a new one waits underneath.
  useLayoutEffect(() => progress.set(0), [i, progress]);

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
            {nextQ && <UnderCard key={`${nextQ.id}-${i + 1}`} q={nextQ} progress={progress} />}
            {q && <SwipeCard key={`${q.id}-${i}`} ref={card} q={q} onAnswered={onAnswered} progress={progress} />}
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

type Gesture = {
  id: number;
  x0: number;
  y0: number;
  mode: "pending" | "drag" | "scroll";
  /** Recent pointer samples for release velocity. */
  samples: { x: number; t: number }[];
};

/**
 * One card, swiped like Tinder. The gesture is handled by hand rather than by a drag library:
 * the first few pixels decide the direction. Sideways, the card is captured and follows the finger
 * in both axes, tilting around the point it was grabbed. Vertically, the browser scrolls the card's
 * content natively. On release, a card dragged far enough (or flicked fast enough) flies off along
 * its path; otherwise it springs back.
 */
function SwipeCard({
  q,
  onAnswered,
  progress,
  ref,
}: {
  q: Question;
  onAnswered: (knows: boolean) => void;
  /** 0..1, how close the card is to being swiped away; drives the card underneath. */
  progress: MotionValue<number>;
  ref?: Ref<CardHandle>;
}) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const grabSign = useRef(1);
  const rotate = useTransform(x, (v) => (v / window.innerWidth) * 18 * grabSign.current);
  const threshold = () => window.innerWidth * SWIPE_SHARE;
  const knowOpacity = useTransform(x, (v) => Math.min(1, Math.max(0, v / threshold())));
  const learnOpacity = useTransform(x, (v) => Math.min(1, Math.max(0, -v / threshold())));
  const flipScale = useMotionValue(1);
  const [side, setSide] = useState<"front" | "back">("front");
  const busy = useRef(false);
  const gone = useRef(false);
  const gesture = useRef<Gesture | null>(null);
  const el = useRef<HTMLDivElement>(null);
  const anims = useRef<{ stop: () => void }[]>([]);

  useEffect(() => x.on("change", (v) => progress.set(Math.min(1, Math.abs(v) / threshold()))), [x, progress]);

  const stopAnims = () => {
    anims.current.forEach((a) => a.stop());
    anims.current = [];
  };

  const flip = async () => {
    if (busy.current || gone.current) return;
    busy.current = true;
    if (reduce) {
      setSide((s) => (s === "front" ? "back" : "front"));
    } else {
      await animate(flipScale, 0, { duration: 0.09, ease: [0.4, 0, 1, 1] });
      setSide((s) => (s === "front" ? "back" : "front"));
      await animate(flipScale, 1, { duration: 0.15, ease: [0, 0, 0.2, 1] });
    }
    busy.current = false;
  };

  const flyOut = async (knows: boolean, vx = 0) => {
    if (gone.current) return;
    gone.current = true;
    stopAnims();
    const w = window.innerWidth;
    const dir = knows ? 1 : -1;
    const tx = dir * w * 1.5;
    const ty = y.get() * 1.5;
    const speed = Math.max(Math.abs(vx), 1400);
    const duration = Math.min(0.38, Math.max(0.2, Math.abs(tx - x.get()) / speed));
    await Promise.all([
      animate(x, tx, { duration, ease: [0.2, 0.7, 0.4, 1] }),
      animate(y, ty, { duration, ease: [0.2, 0.7, 0.4, 1] }),
    ]);
    onAnswered(knows);
  };

  const springBack = (vx = 0, vy = 0) => {
    const opts = { type: "spring" as const, stiffness: 520, damping: 34 };
    anims.current = [animate(x, 0, { ...opts, velocity: vx }), animate(y, 0, { ...opts, velocity: vy })];
  };

  useImperativeHandle(ref, () => ({ fling: (k) => flyOut(k), flip }));

  const onPointerDown = (e: React.PointerEvent) => {
    if (gone.current || gesture.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    stopAnims();
    const rect = el.current!.getBoundingClientRect();
    // Grabbed in the bottom half, the card tilts the other way, like a real card.
    grabSign.current = e.clientY < rect.top + rect.height / 2 ? 1 : -1;
    gesture.current = {
      id: e.pointerId,
      x0: e.clientX - x.get(),
      y0: e.clientY - y.get(),
      mode: "pending",
      samples: [{ x: e.clientX, t: performance.now() }],
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId || g.mode === "scroll") return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (g.mode === "pending") {
      if (Math.abs(dx - x.get()) < 6 && Math.abs(dy - y.get()) < 6) return;
      if (Math.abs(dx - x.get()) > Math.abs(dy - y.get())) {
        g.mode = "drag";
        el.current?.setPointerCapture(e.pointerId);
      } else {
        g.mode = "scroll";
        return;
      }
    }
    x.set(dx);
    y.set(dy);
    const t = performance.now();
    g.samples.push({ x: e.clientX, t });
    while (g.samples.length > 2 && t - g.samples[0].t > 90) g.samples.shift();
  };

  const release = (e: React.PointerEvent, cancelled: boolean) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    if (g.mode === "pending" && !cancelled) {
      if (!(e.target as HTMLElement).closest("button")) flip();
      return;
    }
    if (g.mode !== "drag") return;
    const first = g.samples[0];
    const last = g.samples[g.samples.length - 1];
    // Events can arrive bunched together; never divide by less than one frame.
    const dt = Math.max(1 / 60, (last.t - first.t) / 1000);
    const vx = (last.x - first.x) / dt;
    const dx = x.get();
    const far = Math.abs(dx) >= threshold();
    const flick = Math.abs(vx) > 550 && Math.abs(dx) > 45 && Math.sign(vx) === Math.sign(dx);
    if (!cancelled && (far || flick)) flyOut(dx > 0, vx);
    else springBack(vx, 0);
  };

  return (
    <motion.div
      ref={el}
      className="absolute inset-0 touch-pan-y select-none will-change-transform [-webkit-touch-callout:none] [&_*]:touch-pan-y"
      style={{ x, y, rotate, transformOrigin: "50% 50%" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => release(e, false)}
      onPointerCancel={(e) => release(e, true)}
    >
      <motion.div className="relative h-full w-full" style={{ scaleX: flipScale }}>
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

/** The next card, waiting underneath; it grows into place as the top card is dragged away. */
function UnderCard({ q, progress }: { q: Question; progress: MotionValue<number> }) {
  const scale = useTransform(progress, [0, 1], [0.94, 1]);
  const y = useTransform(progress, [0, 1], [14, 0]);
  return (
    <motion.div
      className="pointer-events-none absolute inset-0"
      style={{ scale, y }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      aria-hidden="true"
    >
      <CardFront q={q} />
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
              <p className="text-[16px] leading-snug font-medium text-pretty"><Rich text={ex.summary} /></p>
              <div>
                <p className="text-[13px] text-faint">Как запомнить</p>
                <p className="mt-0.5 font-serif text-[22px] leading-[1.15] font-semibold italic text-pink-ink text-pretty"><Rich text={ex.mnemonic} /></p>
                <p className="mt-1.5 text-[14px] text-muted"><Rich text={ex.key_link} /></p>
              </div>
              <Block title="Почему так"><Rich text={ex.why_correct} /></Block>
              {ex.example && <Block title="Пример"><Rich text={ex.example} /></Block>}
              {!!ex.wrong_options?.length && (
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
