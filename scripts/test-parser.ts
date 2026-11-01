import fs from "node:fs";
import path from "node:path";
import mammoth from "mammoth";
import { parseText, dedupe } from "../src/lib/parser";

const dir = process.argv[2] ?? "input";
const all = [];
for (const f of fs.readdirSync(dir)) {
  const p = path.join(dir, f);
  const text = f.endsWith(".docx")
    ? (await mammoth.extractRawText({ path: p })).value
    : fs.readFileSync(p, "utf8");
  const r = parseText(text);
  all.push(...r.questions);
  console.log(`\n### ${f}\nformat=${r.format} questions=${r.questions.length} skipped=${r.skipped.length}`);
  for (const s of r.skipped.slice(0, 5)) console.log("  skip:", s.reason, "|", s.text.slice(0, 80));
  for (const q of [r.questions[0], r.questions[r.questions.length - 1]].filter(Boolean))
    console.log("  Q:", q.text.slice(0, 90), "\n   ", q.options.map((o) => (o.correct ? "✓" : "·") + o.text.slice(0, 40)).join(" | "));
  const weird = r.questions.filter((q) => q.options.length !== 5 || q.options.filter((o) => o.correct).length !== 1);
  console.log(`  non-standard (≠5 opts or ≠1 correct): ${weird.length}`);
  for (const q of weird.slice(0, 4)) console.log("   ~", q.options.length, "opts", q.options.filter((o) => o.correct).length, "correct |", q.text.slice(0, 60), "|", q.options.map((o) => o.text.slice(0, 25)).join(" / "));
}
const d = dedupe(all);
console.log(`\nTOTAL parsed=${all.length} unique=${d.questions.length} duplicates=${d.duplicates}`);
