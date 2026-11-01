import { motion } from "framer-motion";
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { IconBack } from "./Icons";
import { useStore } from "../lib/store";

export const spring = { type: "spring", stiffness: 420, damping: 32 } as const;
export const softSpring = { type: "spring", stiffness: 260, damping: 28 } as const;

export function TopBar({ title, right, onBack }: { title?: string; right?: ReactNode; onBack?: () => void }) {
  const back = useStore((s) => s.back);
  return (
    <header className="safe-top sticky top-0 z-20 bg-ground px-4">
      <div className="flex h-12 items-center gap-2">
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={onBack ?? back}
          aria-label="Назад"
          className="-ml-2 grid size-11 place-items-center rounded-full text-ink hover:bg-raised"
        >
          <IconBack size={24} />
        </motion.button>
        <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold">{title}</h1>
        {right}
      </div>
    </header>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  tone?: "pink" | "white" | "grey" | "ghost";
  ref?: Ref<HTMLButtonElement>;
};

const TONES = {
  pink: "bg-pink text-black hover:bg-pink-ink",
  white: "bg-ink text-black hover:bg-muted",
  grey: "bg-raised text-ink hover:bg-active",
  ghost: "bg-transparent text-muted hover:text-ink",
};

export function Button({ children, tone = "pink", className = "", ...rest }: BtnProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      transition={spring}
      className={`flex min-h-13 items-center justify-center gap-2 rounded-full px-6 text-[16px] font-semibold transition-colors duration-150 disabled:opacity-40 ${TONES[tone]} ${className}`}
      {...(rest as object)}
    >
      {children}
    </motion.button>
  );
}

export function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-raised ${className}`} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div
        className="h-full origin-left rounded-full bg-pink"
        initial={false}
        animate={{ scaleX: Math.max(0, Math.min(1, value)) }}
        transition={softSpring}
      />
    </div>
  );
}

export function Ring({ value, size = 120, stroke = 10, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-raised)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--color-pink)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(1, value))) }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

/** Staggered entrance for a list of children. */
export const listParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};
export const listChild = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: softSpring },
};

export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10,
    m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export const fmt = new Intl.NumberFormat("ru-RU");
