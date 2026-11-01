import { motion } from "framer-motion";
import { useStore } from "../lib/store";
import { Button } from "../components/ui";

const ease = [0.22, 1, 0.36, 1] as const;

export function Welcome() {
  const name = useStore((s) => s.settings.name) || "Ажар";
  const update = useStore((s) => s.updateSettings);
  const words = ["Привет,", `${name}`];

  return (
    <main className="safe-top safe-bottom relative flex min-h-dvh flex-col overflow-hidden px-6">
      {/* A fanned stack of study cards, the app's one object. */}
      <div className="relative mx-auto mt-[9dvh] h-[38dvh] w-[62%] max-w-[260px]" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-[26px]"
            style={{
              background: i === 2 ? "var(--color-pink)" : i === 1 ? "var(--color-pink-deep)" : "var(--color-raised)",
              transformOrigin: "50% 100%",
            }}
            initial={{ y: 80, opacity: 0, rotate: 0 }}
            animate={{ y: 0, opacity: 1, rotate: (i - 2) * -9 }}
            transition={{ duration: 1, delay: 0.15 + i * 0.12, ease }}
          >
            {i === 2 && (
              <motion.div
                className="flex h-full flex-col justify-between p-6 text-black"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9, duration: 0.6 }}
              >
                <span className="text-[15px] font-medium">Вопрос</span>
                <span className="font-serif text-[64px] leading-none font-semibold italic">A</span>
                <span className="text-[15px] font-medium">Нажми, чтобы перевернуть</span>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      <div className="mt-auto pb-2">
        <h1 className="font-serif text-[56px] leading-[0.95] font-semibold tracking-[-0.02em]">
          {words.map((w, i) => (
            <motion.span
              key={i}
              className="block"
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.55 + i * 0.12, ease }}
            >
              {w}
            </motion.span>
          ))}
        </h1>
        <motion.p
          className="mt-5 max-w-[34ch] text-[17px] leading-snug text-muted"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.85, ease }}
        >
          Загрузи свои вопросы — и они станут карточками, тестами и пробными экзаменами. С объяснениями и подсказками, как запомнить.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 1, ease }}>
          <Button className="mt-8 w-full" onClick={() => update({ onboarded: true })}>
            Начать
          </Button>
        </motion.div>
      </div>
    </main>
  );
}
