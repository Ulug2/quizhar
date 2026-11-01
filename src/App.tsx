import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { useStore, type Screen } from "./lib/store";
import { Welcome } from "./screens/Welcome";
import { Home } from "./screens/Home";
import { DeckScreen } from "./screens/DeckScreen";
import { Flashcards } from "./screens/Flashcards";
import { Quiz } from "./screens/Quiz";
import { Browse } from "./screens/Browse";
import { Settings } from "./screens/Settings";
import { CelebrateLayer } from "./components/Celebrate";

function render(s: Screen) {
  switch (s.name) {
    case "home":
      return <Home />;
    case "deck":
      return <DeckScreen deckId={s.deckId} />;
    case "cards":
      return <Flashcards deckId={s.deckId} onlyUnknown={s.onlyUnknown} shuffle={s.shuffle} />;
    case "quiz":
      return <Quiz deckId={s.deckId} mode={s.mode} count={s.count} shuffle={s.shuffle} timed={s.timed} ids={s.ids} />;
    case "browse":
      return <Browse deckId={s.deckId} />;
    case "settings":
      return <Settings />;
  }
}

export default function App() {
  const hydrated = useStore((s) => s.hydrated);
  const onboarded = useStore((s) => s.settings.onboarded);
  const stack = useStore((s) => s.stack);
  const screen = stack[stack.length - 1];
  const depth = useRef(stack.length);
  const dir = stack.length >= depth.current ? 1 : -1;
  useEffect(() => {
    depth.current = stack.length;
    window.scrollTo(0, 0);
  }, [stack.length, screen.uid]);

  if (!hydrated) return <div className="min-h-dvh bg-ground" />;

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait" initial={false}>
        {!onboarded ? (
          <motion.div key="welcome" exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.35 }}>
            <Welcome />
          </motion.div>
        ) : (
          <motion.div
            key={`${screen.name}-${screen.uid ?? 0}`}
            custom={dir}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {render(screen)}
          </motion.div>
        )}
      </AnimatePresence>
      <CelebrateLayer />
    </MotionConfig>
  );
}
