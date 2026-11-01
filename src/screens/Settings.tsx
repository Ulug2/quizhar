import { useState } from "react";
import { useStore } from "../lib/store";
import { Button, TopBar, fmt } from "../components/ui";
import { Toggle } from "./DeckScreen";

export function Settings() {
  const { settings, updateSettings, resetProgress, questions, explanations } = useStore();
  const [confirmReset, setConfirmReset] = useState(false);
  const [compliments, setCompliments] = useState(settings.customCompliments.join("\n"));

  return (
    <main className="min-h-dvh pb-12">
      <TopBar title="Настройки" />
      <div className="space-y-8 px-4 pt-2">
        <section>
          <label htmlFor="name" className="text-[14px] text-faint">
            Как тебя зовут
          </label>
          <input
            id="name"
            name="given-name"
            autoComplete="given-name"
            value={settings.name}
            onChange={(e) => updateSettings({ name: e.target.value })}
            className="mt-1 h-12 w-full rounded-[14px] bg-surface px-4 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-pink"
          />
        </section>

        <section>
          <label htmlFor="compliments" className="text-[14px] text-faint">
            Свои комплименты, по одному на строку
          </label>
          <textarea
            id="compliments"
            rows={4}
            placeholder="Например: Ты моя умница…"
            value={compliments}
            onChange={(e) => setCompliments(e.target.value)}
            onBlur={() =>
              updateSettings({
                customCompliments: compliments
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            className="mt-1 w-full rounded-[14px] bg-surface p-4 text-[16px] leading-snug placeholder:text-faint outline-none focus-visible:ring-2 focus-visible:ring-pink"
          />
          <p className="mt-1 text-[13px] text-faint">Они будут появляться вперемешку с обычными, когда ответ верный.</p>
        </section>

        <section className="rounded-[22px] bg-surface px-4 pb-5">
          <Toggle
            label="Варианты ответов на карточках"
            sub="Показывать A–E на лицевой стороне"
            checked={settings.showOptionsOnCards}
            onChange={(v) => updateSettings({ showOptionsOnCards: v })}
          />
        </section>

        <section>
          <label htmlFor="code" className="text-[14px] text-faint">
            Код доступа к ИИ
          </label>
          <input
            id="code"
            name="access-code"
            autoComplete="off"
            spellCheck={false}
            value={settings.accessCode}
            onChange={(e) => updateSettings({ accessCode: e.target.value.trim() })}
            className="mt-1 h-12 w-full rounded-[14px] bg-surface px-4 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-pink"
          />
          <p className="mt-1 text-[13px] text-faint">Нужен для объяснений и чтения необычных файлов.</p>
        </section>

        <section>
          <p className="num text-[14px] text-faint">
            Сохранено на телефоне: {fmt.format(Object.keys(questions).length)} вопросов, {fmt.format(Object.keys(explanations).length)} объяснений.
          </p>
          {!confirmReset ? (
            <Button tone="grey" className="mt-3 w-full" onClick={() => setConfirmReset(true)}>
              Сбросить прогресс
            </Button>
          ) : (
            <div className="mt-3 rounded-[18px] bg-bad-tint p-4">
              <p className="text-[15px]">Сбросить весь прогресс? Колоды и объяснения останутся, а отметки «знаю» обнулятся.</p>
              <div className="mt-3 flex gap-2">
                <Button tone="grey" className="flex-1" onClick={() => setConfirmReset(false)}>
                  Отмена
                </Button>
                <Button
                  className="flex-1 bg-bad! text-black"
                  onClick={() => {
                    resetProgress();
                    setConfirmReset(false);
                  }}
                >
                  Сбросить
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
