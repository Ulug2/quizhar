import { motion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { deckStats, useStore, type QuizMode } from "../lib/store";
import { Button, Ring, TopBar, fmt, listChild, listParent, plural } from "../components/ui";
import { IconChevron, IconEdit } from "../components/Icons";
import { Sheet } from "../components/Sheet";

type Setup = { kind: "cards" } | { kind: "quiz"; mode: "practice" | "exam" } | { kind: "edit" } | null;

export function DeckScreen({ deckId }: { deckId: string }) {
  const deck = useStore((s) => s.decks[deckId]);
  const progress = useStore((s) => s.progress);
  const go = useStore((s) => s.go);
  const [setup, setSetup] = useState<Setup>(null);
  if (!deck) return null;
  const st = deckStats(deck, progress);

  const startQuiz = (mode: QuizMode, count = 0, shuffle = false, timed = false) =>
    go({ name: "quiz", deckId, mode, count, shuffle, timed });

  return (
    <main className="min-h-dvh pb-12">
      <TopBar
        title={deck.name}
        right={
          <motion.button
            whileTap={{ scale: 0.88 }}
            aria-label="Переименовать или удалить"
            onClick={() => setSetup({ kind: "edit" })}
            className="-mr-2 grid size-11 place-items-center rounded-full text-muted hover:bg-raised hover:text-ink"
          >
            <IconEdit size={20} />
          </motion.button>
        }
      />

      <section className="px-4">
        <div className="flex items-center gap-5 pt-2">
          <Ring value={st.pct / 100} size={112} stroke={10}>
            <span className="num text-[26px] font-semibold">{st.pct}%</span>
          </Ring>
          <div className="min-w-0">
            <p className="text-[15px] text-muted">Выучено</p>
            <p className="num text-[22px] leading-tight font-semibold">
              {fmt.format(st.mastered)} из {fmt.format(st.total)}
            </p>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-3 divide-x divide-line rounded-[22px] bg-surface py-4 text-center">
          <Count label="Новые" value={st.fresh} />
          <Count label="Учу" value={st.learning} />
          <Count label="Знаю" value={st.mastered} />
        </dl>
      </section>

      <motion.div variants={listParent} initial="hidden" animate="show" className="mt-8 px-4">
        <motion.button
          variants={listChild}
          whileTap={{ scale: 0.98 }}
          onClick={() => setSetup({ kind: "cards" })}
          className="relative flex h-44 w-full overflow-hidden rounded-[22px] bg-pink p-5 text-left text-black"
        >
          <div className="relative z-10 flex flex-col justify-between">
            <span className="text-[24px] leading-tight font-semibold">Карточки</span>
            <span className="max-w-[18ch] text-[15px] leading-snug font-medium">Вопрос на одной стороне, ответ на другой</span>
          </div>
          <div className="absolute top-5 right-5 bottom-5 w-[32%]" aria-hidden="true">
            <div className="absolute inset-0 rotate-[10deg] rounded-[14px] bg-pink-deep" />
            <div className="absolute inset-0 rotate-[-4deg] rounded-[14px] bg-black">
              <span className="absolute inset-0 grid place-items-center font-serif text-[44px] font-semibold italic text-pink">B</span>
            </div>
          </div>
        </motion.button>

        <motion.ul variants={listChild} className="mt-3 divide-y divide-line overflow-hidden rounded-[22px] bg-surface">
          <Row title="Пробный экзамен" sub="Без подсказок, результат в конце" onClick={() => setSetup({ kind: "quiz", mode: "exam" })} />
          <Row title="Тренировка" sub="Сразу видно, верно или нет" onClick={() => setSetup({ kind: "quiz", mode: "practice" })} />
          <Row title="Заучивание" sub="Повторяем, пока каждый ответ не запомнится" onClick={() => startQuiz("learn")} />
          <Row
            title="Работа над ошибками"
            sub={st.mistakes ? `${fmt.format(st.mistakes)} ${plural(st.mistakes, "вопрос", "вопроса", "вопросов")} ждут повторения` : "Ошибок пока нет"}
            disabled={!st.mistakes}
            onClick={() => startQuiz("mistakes")}
          />
          <Row title="Все вопросы" sub="Список с ответами и поиском" onClick={() => go({ name: "browse", deckId })} />
        </motion.ul>
      </motion.div>

      <CardsSetup open={setup?.kind === "cards"} onClose={() => setSetup(null)} deckId={deckId} unknown={st.fresh + st.learning} />
      <QuizSetup
        open={setup?.kind === "quiz"}
        mode={setup?.kind === "quiz" ? setup.mode : "exam"}
        total={st.total}
        onClose={() => setSetup(null)}
        onStart={(count, shuffle, timed) => {
          if (setup?.kind !== "quiz") return;
          setSetup(null);
          startQuiz(setup.mode, count, shuffle, timed);
        }}
      />
      <EditDeck open={setup?.kind === "edit"} onClose={() => setSetup(null)} deckId={deckId} />
    </main>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dd className="num text-[22px] leading-tight font-semibold">{fmt.format(value)}</dd>
      <dt className="text-[13px] text-faint">{label}</dt>
    </div>
  );
}

function Row({ title, sub, onClick, disabled }: { title: string; sub: string; onClick: () => void; disabled?: boolean }) {
  return (
    <li>
      <button
        onClick={onClick}
        disabled={disabled}
        className="flex min-h-[72px] w-full items-center gap-3 px-5 py-3 text-left transition-colors duration-150 hover:bg-raised active:bg-raised disabled:opacity-45"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-semibold">{title}</span>
          <span className="block text-[14px] leading-snug text-faint">{sub}</span>
        </span>
        <IconChevron size={20} className="shrink-0 text-faint" />
      </button>
    </li>
  );
}

export function Choice<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="mt-5">
      <legend className="text-[14px] text-faint">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <motion.button
            key={String(o.value)}
            whileTap={{ scale: 0.94 }}
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={`min-h-11 rounded-full px-4 text-[15px] font-medium transition-colors duration-150 ${
              value === o.value ? "bg-ink text-black" : "bg-raised text-ink hover:bg-active"
            }`}
          >
            {o.label}
          </motion.button>
        ))}
      </div>
    </fieldset>
  );
}

export function Toggle({ label, sub, checked, onChange }: { label: string; sub?: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mt-5 flex min-h-11 cursor-pointer items-center gap-4">
      <span className="min-w-0 flex-1">
        <span className="block text-[16px]">{label}</span>
        {sub && <span className="block text-[13px] text-faint">{sub}</span>}
      </span>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden="true"
        className={`relative h-8 w-13 shrink-0 rounded-full transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-pink ${checked ? "bg-pink" : "bg-active"}`}
      >
        <motion.span
          className="absolute top-1 left-1 size-6 rounded-full bg-ink"
          animate={{ x: checked ? 20 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
        />
      </span>
    </label>
  );
}

function CardsSetup({ open, onClose, deckId, unknown }: { open: boolean; onClose: () => void; deckId: string; unknown: number }) {
  const go = useStore((s) => s.go);
  const [onlyUnknown, setOnlyUnknown] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} label="Настройки карточек">
      <div className="pb-4">
        <h2 className="text-[22px] font-semibold">Карточки</h2>
        <Toggle label="Только невыученные" sub={`${fmt.format(unknown)} ${plural(unknown, "карточка", "карточки", "карточек")}`} checked={onlyUnknown} onChange={setOnlyUnknown} />
        <Toggle label="Перемешать вопросы" sub="Варианты ответов всегда на своих местах" checked={shuffle} onChange={setShuffle} />
        <Button
          className="mt-7 w-full"
          disabled={onlyUnknown && unknown === 0}
          onClick={() => {
            onClose();
            go({ name: "cards", deckId, onlyUnknown, shuffle });
          }}
        >
          Начать
        </Button>
      </div>
    </Sheet>
  );
}

function QuizSetup({
  open,
  mode,
  total,
  onClose,
  onStart,
}: {
  open: boolean;
  mode: "practice" | "exam";
  total: number;
  onClose: () => void;
  onStart: (count: number, shuffle: boolean, timed: boolean) => void;
}) {
  const [count, setCount] = useState(25);
  const [shuffle, setShuffle] = useState(true);
  const [timed, setTimed] = useState(false);
  const counts = [10, 25, 50, 100].filter((c) => c < total);
  const options = [...counts.map((c) => ({ value: c, label: String(c) })), { value: 0, label: `Все ${fmt.format(total)}` }];
  const value = counts.includes(count) ? count : 0;
  return (
    <Sheet open={open} onClose={onClose} label="Настройки теста">
      <div className="pb-4">
        <h2 className="text-[22px] font-semibold">{mode === "exam" ? "Пробный экзамен" : "Тренировка"}</h2>
        <Choice label="Сколько вопросов" value={value} options={options} onChange={setCount} />
        <Toggle label="Случайные вопросы" sub="Варианты ответов всегда на своих местах" checked={shuffle} onChange={setShuffle} />
        {mode === "exam" && <Toggle label="С таймером" sub="1 минута на вопрос, как на экзамене" checked={timed} onChange={setTimed} />}
        <Button className="mt-7 w-full" onClick={() => onStart(value, shuffle, mode === "exam" && timed)}>
          Начать
        </Button>
      </div>
    </Sheet>
  );
}

function EditDeck({ open, onClose, deckId }: { open: boolean; onClose: () => void; deckId: string }) {
  const deck = useStore((s) => s.decks[deckId]);
  const { renameDeck, deleteDeck, back } = useStore();
  const [name, setName] = useState(deck?.name ?? "");
  const [confirm, setConfirm] = useState(false);
  if (!deck) return null;
  return (
    <Sheet
      open={open}
      onClose={() => {
        setConfirm(false);
        onClose();
      }}
      label="Колода"
    >
      <div className="pb-4">
        <label htmlFor="rename" className="text-[14px] text-faint">
          Название колоды
        </label>
        <input
          id="rename"
          name="deck-name"
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 h-12 w-full rounded-[14px] bg-raised px-4 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-pink"
        />
        <Button
          className="mt-4 w-full"
          tone="white"
          onClick={() => {
            renameDeck(deckId, name.trim() || deck.name);
            onClose();
          }}
        >
          Сохранить название
        </Button>
        {deck.sourceFiles.length > 0 && (
          <p className="mt-6 text-[13px] text-faint">Файлы: {deck.sourceFiles.join(", ")}</p>
        )}
        {!confirm ? (
          <Button tone="ghost" className="mt-4 w-full text-bad!" onClick={() => setConfirm(true)}>
            Удалить колоду
          </Button>
        ) : (
          <div className="mt-4 rounded-[18px] bg-bad-tint p-4">
            <p className="text-[15px]">Удалить «{deck.name}»? Прогресс по вопросам, которых нет в других колодах, пропадёт.</p>
            <div className="mt-3 flex gap-2">
              <Button tone="grey" className="flex-1" onClick={() => setConfirm(false)}>
                Отмена
              </Button>
              <Button
                className="flex-1 bg-bad! text-black"
                onClick={() => {
                  onClose();
                  back();
                  setTimeout(() => deleteDeck(deckId), 350);
                }}
              >
                Удалить
              </Button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
