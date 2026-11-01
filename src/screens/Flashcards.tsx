import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { pickQuestions } from "../lib/session";
import { LETTERS, type Question } from "../lib/types";
import { Button, ProgressBar, TopBar, fmt, softSpring } from "../components/ui";
import { IconCheck, IconRotate, IconSpark, IconX } from "../components/Icons";
import { ExplanationSheet } from "../components/ExplanationSheet";
import { celebrate, centerOf } from "../components/Celebrate";

function sizeFor(text: string) {
  if (text.length > 320) return "text-[16px] leading-snug";
  if (text.length > 180) return "text-[18px] leading-snug";
  if (text.length > 90) return "text-[21px] leading-snug";
  return "text-[25px] leading-tight";
}

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
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<string[]>([]);
  const [unknown, setUnknown] = useState<string[]>([]);
  const [explain, setExplain] = useState(false);
  const streak = useRef(0);
  const knowBtn = useRef<HTMLButtonElement>(null);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-14, 14]);
  const knowOpacity = useTransform(x, [30, 120], [0, 1]);
  const learnOpacity = useTransform(x, [-120, -30], [1, 0]);

  const q: Question | undefined = questions[ids[i]];
  const nextQ: Question | undefined = questions[ids[i + 1]];
  const finished = i >= ids.length;

  const answer = async (knows: boolean) => {
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
    await animate(x, knows ? 520 : -520, { duration: 0.28, ease: [0.4, 0, 1, 1] });
    setFlipped(false);
    setI((n) => n + 1);
    x.set(0);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (explain || finished) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowRight") answer(true);
      else if (e.key === "ArrowLeft") answer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const restart = (list: string[]) => {
    setIds(list);
    setI(0);
    setKnown([]);
    setUnknown([]);
    setFlipped(false);
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
        <RoundDone
          known={known.length}
          unknown={unknown.length}
          onRepeatUnknown={() => restart(unknown)}
          onRepeatAll={() => restart(initial)}
          onExit={back}
        />
      ) : (
        <>
          <div className="relative mx-4 mt-5 flex-1">
            {nextQ && (
              <div className="absolute inset-0 translate-y-3 scale-[0.95] rounded-[28px] bg-surface" aria-hidden="true" />
            )}
            <AnimatePresence initial={false}>
              {q && (
                <motion.div
                  key={q.id + i}
                  className="absolute inset-0 touch-pan-y"
                  style={{ x, rotate, perspective: 1400 }}
                  initial={{ scale: 0.95, y: 12, opacity: 0.6 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  transition={softSpring}
                  drag="x"
                  dragSnapToOrigin
                  dragElastic={0.9}
                  onDragEnd={(_, info) => {
                    if (info.offset.x > 110 || info.velocity.x > 700) answer(true);
                    else if (info.offset.x < -110 || info.velocity.x < -700) answer(false);
                  }}
                  onTap={() => setFlipped((f) => !f)}
                >
                  <FlipCard flipped={flipped} front={<CardFront q={q} hidden={flipped} />} back={<CardBack q={q} hidden={!flipped} />} />
                  <AnimatePresence>
                    {flipped && (
                      <motion.button
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0, transition: { delay: 0.18 } }}
                        exit={{ opacity: 0, transition: { duration: 0.1 } }}
                        whileTap={{ scale: 0.95 }}
                        onPointerDownCapture={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExplain(true);
                        }}
                        className="absolute inset-x-6 bottom-6 z-10 flex min-h-12 items-center justify-center gap-2 rounded-full bg-black text-[15px] font-semibold text-pink hover:bg-[#1a1a1a]"
                      >
                        <IconSpark size={18} /> Объяснение и запоминалка
                      </motion.button>
                    )}
                  </AnimatePresence>

                  <motion.span
                    style={{ opacity: knowOpacity }}
                    className="pointer-events-none absolute top-5 left-5 rounded-full bg-pink px-4 py-1.5 text-[15px] font-semibold text-black"
                  >
                    Знаю
                  </motion.span>
                  <motion.span
                    style={{ opacity: learnOpacity }}
                    className="pointer-events-none absolute top-5 right-5 rounded-full bg-ink px-4 py-1.5 text-[15px] font-semibold text-black"
                  >
                    Ещё учу
                  </motion.span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="safe-bottom grid grid-cols-2 gap-3 px-4 pt-5">
            <Button tone="grey" onClick={() => answer(false)}>
              <IconX size={20} /> Ещё учу
            </Button>
            <Button ref={knowBtn} onClick={() => answer(true)}>
              <IconCheck size={20} /> Знаю
            </Button>
          </div>
        </>
      )}

      <ExplanationSheet question={q ?? null} open={explain} onClose={() => setExplain(false)} />
    </main>
  );
}

/**
 * WebKit ignores backface-visibility inside some transformed parents, so each face is also
 * hidden by opacity once the card passes 90°.
 */
function FlipCard({ flipped, front, back }: { flipped: boolean; front: React.ReactNode; back: React.ReactNode }) {
  const rot = useMotionValue(0);
  useEffect(() => {
    const c = animate(rot, flipped ? 180 : 0, { type: "spring", stiffness: 260, damping: 26 });
    return () => c.stop();
  }, [flipped, rot]);
  const frontOpacity = useTransform(rot, (r) => (r < 90 ? 1 : 0));
  const backOpacity = useTransform(rot, (r) => (r >= 90 ? 1 : 0));
  return (
    <motion.div className="preserve-3d relative h-full w-full" style={{ rotateY: rot }}>
      <motion.div className="pointer-events-none absolute inset-0" style={{ opacity: frontOpacity }}>
        {front}
      </motion.div>
      <motion.div className="pointer-events-none absolute inset-0" style={{ opacity: backOpacity }}>
        {back}
      </motion.div>
    </motion.div>
  );
}

function CardFront({ q, hidden }: { q: Question; hidden: boolean }) {
  const showOptions = useStore((s) => s.settings.showOptionsOnCards);
  return (
    <div className={`backface-hidden absolute inset-0 flex flex-col rounded-[28px] bg-raised p-6 ${hidden ? "pointer-events-none" : "pointer-events-auto"}`} aria-hidden={hidden}>
      <span className="text-[14px] text-faint">Вопрос</span>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
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

function CardBack({ q, hidden }: { q: Question; hidden: boolean }) {
  const correct = q.options.map((o, i) => ({ ...o, letter: LETTERS[i] })).filter((o) => o.correct);
  const longest = correct.reduce((m, o) => Math.max(m, o.text.length), 0);
  return (
    <div
      className={`backface-hidden absolute inset-0 flex flex-col rounded-[28px] bg-pink p-6 text-black [transform:rotateY(180deg)] ${hidden ? "pointer-events-none" : "pointer-events-auto"}`}
      aria-hidden={hidden}
    >
      <span className="text-[14px] font-medium">Ответ</span>
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
        {correct.map((o) => (
          <div key={o.letter} className="mb-4">
            <span className="font-serif text-[72px] leading-[0.9] font-semibold italic">{o.letter}</span>
            <p className={`mt-2 font-semibold text-pretty ${sizeFor("x".repeat(longest))}`}>{o.text}</p>
          </div>
        ))}
      </div>
      {/* Room for the explanation button, which sits outside the 3D card so taps always land. */}
      <div className="mt-4 h-12 shrink-0" />
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
        {total === 0 ? "Здесь пока пусто" : allKnown ? "Умница моя, всё знаешь!" : "Круг пройден"}
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
