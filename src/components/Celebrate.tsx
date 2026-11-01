import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { create } from "zustand";
import { IconHeart } from "./Icons";
import { nextCompliment } from "../lib/compliments";

interface Burst {
  id: number;
  x: number;
  y: number;
}
interface CelebrateState {
  toast: { id: number; text: string } | null;
  bursts: Burst[];
}
const useCelebrate = create<CelebrateState>(() => ({ toast: null, bursts: [] }));

let seq = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

/** Shows a compliment and a burst of hearts from (x, y). */
export function celebrate(x: number, y: number, streak: number) {
  const id = ++seq;
  useCelebrate.setState((s) => ({ toast: { id, text: nextCompliment(streak) }, bursts: [...s.bursts, { id, x, y }] }));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => useCelebrate.setState({ toast: null }), 2200);
  setTimeout(() => useCelebrate.setState((s) => ({ bursts: s.bursts.filter((b) => b.id !== id) })), 1200);
}

export function centerOf(el: Element | null): [number, number] {
  if (!el) return [window.innerWidth / 2, window.innerHeight / 2];
  const r = el.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}

const HEARTS = Array.from({ length: 9 }, (_, i) => {
  const angle = (-Math.PI / 2) + ((i - 4) / 4) * (Math.PI / 2.2);
  const dist = 70 + ((i * 37) % 50);
  return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, size: 12 + ((i * 7) % 12), rot: ((i * 53) % 60) - 30 };
});

export function CelebrateLayer() {
  const { toast, bursts } = useCelebrate();
  const reduce = useReducedMotion();
  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 safe-top" aria-live="polite">
        <AnimatePresence mode="popLayout">
          {toast && (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -24, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 380, damping: 26 }}
              className="mt-1 flex items-center gap-2 rounded-full bg-pink py-2.5 pr-6 pl-4 text-black"
            >
              <IconHeart size={18} />
              <span className="font-serif text-[22px] leading-none font-semibold italic">{toast.text}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {!reduce && (
        <div className="pointer-events-none fixed inset-0 z-50" aria-hidden="true">
          {bursts.map((b) =>
            HEARTS.map((h, i) => (
              <motion.div
                key={`${b.id}-${i}`}
                className="absolute text-pink"
                style={{ left: b.x, top: b.y }}
                initial={{ x: "-50%", y: "-50%", scale: 0.2, opacity: 1, rotate: 0 }}
                animate={{ x: `calc(-50% + ${h.dx}px)`, y: `calc(-50% + ${h.dy}px)`, scale: 1, opacity: 0, rotate: h.rot }}
                transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
              >
                <IconHeart size={h.size} />
              </motion.div>
            )),
          )}
        </div>
      )}
    </>
  );
}
