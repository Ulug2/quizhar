import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { useEffect, type ReactNode } from "react";
import { softSpring } from "./ui";
import { IconX } from "./Icons";

export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  const drag = useDragControls();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={label}>
          <motion.button
            aria-label="Закрыть"
            className="absolute inset-0 bg-black/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 flex max-h-[90dvh] flex-col rounded-t-[28px] bg-surface"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={softSpring}
            drag="y"
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, i) => {
              if (i.offset.y > 120 || i.velocity.y > 600) onClose();
            }}
          >
            <div className="relative flex shrink-0 justify-center pt-3 pb-2 touch-none" onPointerDown={(e) => drag.start(e)}>
              <div className="h-1.5 w-10 rounded-full bg-active" />
              <motion.button
                whileTap={{ scale: 0.88 }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onClose}
                aria-label="Закрыть"
                className="absolute top-2.5 right-3 grid size-10 place-items-center rounded-full bg-raised text-muted hover:bg-active hover:text-ink"
              >
                <IconX size={18} />
              </motion.button>
            </div>
            <div className="sheet-scroll safe-bottom overflow-y-auto px-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
