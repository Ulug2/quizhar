import { motion } from "framer-motion";
import { useState } from "react";
import { deckStats, useStore } from "../lib/store";
import { Button, ProgressBar, fmt, listChild, listParent, plural } from "../components/ui";
import { IconChevron, IconPlus, IconSettings } from "../components/Icons";
import { ImportSheet } from "../components/ImportSheet";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}

export function Home() {
  const { decks, deckOrder, progress, streak, settings, go } = useStore();
  const [importing, setImporting] = useState(false);
  const isToday = streak.lastDay === new Date().toLocaleDateString("sv-SE");
  const streakAlive = isToday || streak.lastDay === new Date(Date.now() - 864e5).toLocaleDateString("sv-SE");
  const list = deckOrder.map((id) => decks[id]).filter(Boolean);

  return (
    <main className="safe-top min-h-dvh px-4 pb-36">
      <div className="flex h-12 items-center justify-between">
        <span className="text-[17px] font-semibold tracking-tight">Quizhar</span>
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={() => go({ name: "settings" })}
          aria-label="Настройки"
          className="-mr-2 grid size-11 place-items-center rounded-full text-muted hover:bg-raised hover:text-ink"
        >
          <IconSettings size={22} />
        </motion.button>
      </div>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="mt-6 font-serif text-[40px] leading-[1] font-semibold tracking-[-0.02em] text-balance"
      >
        {greeting()}, {settings.name || "Ажар"}
      </motion.h1>

      <motion.dl
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="mt-6 grid grid-cols-3 divide-x divide-line rounded-[22px] bg-surface py-4"
      >
        <Stat label="Дней подряд" value={streakAlive ? streak.days : 0} />
        <Stat label="Ответов сегодня" value={isToday ? streak.answeredToday : 0} />
        <Stat label="Верно сегодня" value={isToday ? streak.correctToday : 0} />
      </motion.dl>

      <h2 className="mt-9 text-[20px] font-semibold">Колоды</h2>

      {list.length === 0 ? (
        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setImporting(true)}
          className="mt-3 w-full rounded-[22px] border-2 border-dashed border-active px-5 py-8 text-left hover:border-pink-deep"
        >
          <p className="text-[17px] font-medium">Пока нет ни одной колоды</p>
          <p className="mt-1 text-[15px] text-muted">Загрузи файл с вопросами (TXT, DOCX или PDF), и можно сразу учить.</p>
        </motion.button>
      ) : (
        <motion.ul variants={listParent} initial="hidden" animate="show" className="mt-3 space-y-3">
          {list.map((d) => {
            const st = deckStats(d, progress);
            return (
              <motion.li key={d.id} variants={listChild}>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => go({ name: "deck", deckId: d.id })}
                  className="w-full rounded-[22px] bg-surface p-5 text-left transition-colors duration-150 hover:bg-raised"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[18px] leading-snug font-semibold break-words">{d.name}</p>
                      <p className="num mt-1 text-[14px] text-faint">
                        {fmt.format(st.total)} {plural(st.total, "вопрос", "вопроса", "вопросов")}
                        {st.mistakes > 0 && ` · ${fmt.format(st.mistakes)} ${plural(st.mistakes, "ошибка", "ошибки", "ошибок")}`}
                      </p>
                    </div>
                    <span className="num text-[22px] font-semibold text-pink">{st.pct}%</span>
                    <IconChevron size={20} className="mt-1.5 text-faint" />
                  </div>
                  <ProgressBar value={st.pct / 100} className="mt-4" />
                </motion.button>
              </motion.li>
            );
          })}
        </motion.ul>
      )}

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-10 bg-ground px-4 pt-3">
        <Button className="w-full" onClick={() => setImporting(true)}>
          <IconPlus size={20} /> Загрузить вопросы
        </Button>
      </div>

      <ImportSheet open={importing} onClose={() => setImporting(false)} />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-3 text-center">
      <dd className="num text-[24px] leading-tight font-semibold">{fmt.format(value)}</dd>
      <dt className="mt-0.5 text-[12px] leading-tight text-faint">{label}</dt>
    </div>
  );
}
