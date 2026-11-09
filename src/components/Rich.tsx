import { Fragment } from "react";

/** Renders AI text, turning **bold** into real bold and dropping any other stray asterisks. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? <strong key={i} className="font-semibold">{p}</strong> : <Fragment key={i}>{p.replace(/\*/g, "")}</Fragment>,
      )}
    </>
  );
}
