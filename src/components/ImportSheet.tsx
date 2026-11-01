import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState } from "react";
import { Sheet } from "./Sheet";
import { Button, fmt, plural, softSpring } from "./ui";
import { IconFile, IconUpload } from "./Icons";
import { importFiles, type ImportReport } from "../lib/importer";
import { useStore } from "../lib/store";

const ACCEPT =
  ".txt,.docx,.pdf,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type Step = { kind: "pick" } | { kind: "work"; status: string } | { kind: "review"; report: ImportReport; files: string[] };

function baseName(n: string) {
  return n.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim();
}

export function ImportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [name, setName] = useState("");
  const [showSkipped, setShowSkipped] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const addDeck = useStore((s) => s.addDeck);
  const go = useStore((s) => s.go);

  const close = () => {
    if (step.kind === "work") return;
    onClose();
    setTimeout(() => setStep({ kind: "pick" }), 300);
  };

  const onFiles = async (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    setStep({ kind: "work", status: "Читаю файлы…" });
    const report = await importFiles(files, (status) => setStep({ kind: "work", status }));
    setName(files.length === 1 ? baseName(files[0].name) : `${baseName(files[0].name)} и ещё ${files.length - 1}`);
    setShowSkipped(false);
    setStep({ kind: "review", report, files: files.map((f) => f.name) });
    if (input.current) input.current.value = "";
  };

  const create = () => {
    if (step.kind !== "review") return;
    const id = addDeck(name.trim() || "Мои вопросы", step.files, step.report.questions);
    onClose();
    setTimeout(() => setStep({ kind: "pick" }), 300);
    go({ name: "deck", deckId: id });
  };

  return (
    <Sheet open={open} onClose={close} label="Загрузка вопросов">
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        aria-label="Файлы с вопросами"
        onChange={(e) => onFiles(e.target.files)}
      />
      <AnimatePresence mode="wait" initial={false}>
        {step.kind === "pick" && (
          <motion.div key="pick" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={softSpring} className="pb-4">
            <h2 className="text-[22px] font-semibold">Новые вопросы</h2>
            <p className="mt-1 text-[15px] text-muted">Можно выбрать несколько файлов сразу. Одинаковые вопросы склеятся в один.</p>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => input.current?.click()}
              className="mt-5 flex w-full flex-col items-center gap-3 rounded-[22px] border-2 border-dashed border-pink-deep bg-pink-tint px-6 py-10 text-center hover:border-pink"
            >
              <span className="grid size-14 place-items-center rounded-full bg-pink text-black">
                <IconUpload size={26} />
              </span>
              <span className="text-[18px] font-semibold">Выбрать файлы</span>
              <span className="text-[14px] text-muted">TXT, DOCX или PDF</span>
            </motion.button>
          </motion.div>
        )}

        {step.kind === "work" && (
          <motion.div key="work" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center py-12 text-center" aria-live="polite">
            <div className="relative h-24 w-20">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute inset-0 rounded-[14px]"
                  style={{ background: i === 2 ? "var(--color-pink)" : i === 1 ? "var(--color-pink-deep)" : "var(--color-active)" }}
                  animate={{ rotate: [(i - 1) * 10, (i - 1) * -10, (i - 1) * 10], y: [0, -6, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                />
              ))}
            </div>
            <p className="mt-8 text-[17px] font-medium">{step.status}</p>
            <p className="mt-1 text-[14px] text-faint">Не закрывай приложение</p>
          </motion.div>
        )}

        {step.kind === "review" && (
          <motion.div key="review" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={softSpring} className="pb-4">
            {step.report.questions.length > 0 ? (
              <>
                <p className="num text-[44px] leading-none font-semibold tracking-tight text-pink">{fmt.format(step.report.questions.length)}</p>
                <h2 className="mt-1 text-[20px] font-semibold">
                  {plural(step.report.questions.length, "вопрос готов", "вопроса готовы", "вопросов готовы")} к учёбе
                </h2>
              </>
            ) : (
              <h2 className="text-[22px] font-semibold">Вопросы не найдены</h2>
            )}

            <ul className="mt-5 divide-y divide-line rounded-[18px] bg-raised">
              {step.report.files.map((f) => (
                <li key={f.name} className="flex items-start gap-3 px-4 py-3">
                  <IconFile size={18} className="mt-0.5 shrink-0 text-faint" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px]">{f.name}</p>
                    <p className={`text-[13px] ${f.error ? "text-bad" : "text-faint"}`}>
                      {f.error ?? `${fmt.format(f.count)} ${plural(f.count, "вопрос", "вопроса", "вопросов")}${f.format === "ai" ? ", распознал ИИ" : ""}`}
                    </p>
                  </div>
                </li>
              ))}
              {step.report.duplicates > 0 && (
                <li className="px-4 py-3 text-[14px] text-muted">
                  Убрано повторов: <span className="num text-ink">{fmt.format(step.report.duplicates)}</span>
                </li>
              )}
              {step.report.skipped.length > 0 && (
                <li className="px-4 py-3 text-[14px] text-muted">
                  <button className="min-h-8 text-left" onClick={() => setShowSkipped((v) => !v)} aria-expanded={showSkipped}>
                    Пропущено без ответа: <span className="num text-ink">{step.report.skipped.length}</span>{" "}
                    <span className="text-pink-ink">{showSkipped ? "Скрыть" : "Показать"}</span>
                  </button>
                  {showSkipped && (
                    <ul className="mt-2 space-y-2">
                      {step.report.skipped.map((s, i) => (
                        <li key={i} className="text-[13px] text-faint">
                          <span className="text-muted">{s.text.slice(0, 120)}</span> — {s.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )}
            </ul>

            {step.report.questions.length > 0 ? (
              <>
                <label htmlFor="deck-name" className="mt-6 block text-[14px] text-faint">
                  Название колоды
                </label>
                <input
                  id="deck-name"
                  name="deck-name"
                  autoComplete="off"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 h-12 w-full rounded-[14px] bg-raised px-4 text-[16px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-pink"
                />
                <Button className="mt-5 w-full" onClick={create}>
                  Начать учить
                </Button>
              </>
            ) : (
              <Button tone="grey" className="mt-6 w-full" onClick={() => setStep({ kind: "pick" })}>
                Выбрать другой файл
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  );
}
