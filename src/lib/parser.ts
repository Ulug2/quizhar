import type { Option, ParsedQuestion, Question } from "./types";

/**
 * Deterministic parser for the test-file formats commonly used in medical
 * universities. Anything it does not recognise is sent to the AI parser.
 *
 *  plusminus:  "? question" / "+ correct" / "- wrong"
 *  checkmark:  "1. question" / "[✅] correct" / "⚪ wrong"
 *  tags:       "<question> ..." / "<variant> ..." (first variant is correct)
 *  lettered:   "A) ... B) ..." + "Ответ: B"
 */
export type FormatId = "plusminus" | "checkmark" | "tags" | "lettered" | "unknown";

export interface ParseResult {
  format: FormatId;
  questions: ParsedQuestion[];
  skipped: { text: string; reason: string }[];
}

const CORRECT_MARK = /\[\s*(?:✅|✔️?|☑️?|x|х|\+)\s*\]|✅|✔️?|☑️?/i;
const WRONG_MARK = /\[\s*(?:⚪|❌|✖️?|\s|-)\s*\]|⚪|○|◯|❌|✖️?|⬜|⭕/;
const NUM_PREFIX = /^\s*\d{1,4}\s*[.)]\s*/;
const VARIANT_TAG = /<\s*var[a-z]*\s*[>»]?|(?<![a-z<])var[a-z]*\s*[>»]|^\s*variant(?![a-z])/gim;
const QUESTION_TAG = /<\s*que[a-z]*\s*[>»]?|(?<![a-z<])question\s*[>»]/gi;
/** A stray variant token inside one line means two options were glued together. */
const INLINE_VARIANT = /\s+<?\s*var(?:ia?n?t|ant)\s*>?\s+/i;
const LETTER_OPT = /^\s*\*?\s*([A-Ea-eА-Да-д])\s*[).]\s+/;
const ANSWER_LINE = /^\s*(?:правильный\s+)?(?:ответ|answer|жауап)\s*[:\-–]?\s*([A-Ea-eА-Да-д])\b/i;

export function cleanText(s: string): string {
  return s
    .replace(/[   \t]/g, " ")
    .replace(/^\s*<?\s*vari?a?n?t?\s*>?\s+(?=\S)/i, "")
    .replace(/^[\s»«"'“”„•·*]+/, "")
    .replace(/[\s»«]+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function preprocess(raw: string): string[] {
  return raw
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[   ]/g, " ")
    .split("\n");
}

export function detectFormat(raw: string): FormatId {
  const lines = preprocess(raw);
  const score: Record<Exclude<FormatId, "unknown">, number> = {
    plusminus: lines.filter((l) => /^\s*\?/.test(l)).length,
    checkmark: lines.filter((l) => CORRECT_MARK.test(l) && !/^\s*[?+]/.test(l)).length,
    tags: (raw.match(QUESTION_TAG) ?? []).length,
    lettered: lines.filter((l) => ANSWER_LINE.test(l)).length,
  };
  let best: FormatId = "unknown";
  let bestScore = 2; // need at least 3 hits to trust a format
  for (const [k, v] of Object.entries(score)) {
    if (v > bestScore) {
      best = k as FormatId;
      bestScore = v;
    }
  }
  return best;
}

type Draft = { text: string; options: Option[] };

function appendTo(d: Draft, line: string) {
  const t = cleanText(line);
  if (!t) return;
  if (d.options.length) {
    const o = d.options[d.options.length - 1];
    o.text = `${o.text} ${t}`.trim();
  } else {
    d.text = `${d.text} ${t}`.trim();
  }
}

function parsePlusMinus(lines: string[]): Draft[] {
  const out: Draft[] = [];
  let cur: Draft | null = null;
  for (const line of lines) {
    if (!line.trim()) continue;
    const q = line.match(/^\s*\?\s*(.*)$/);
    if (q) {
      cur = { text: cleanText(q[1].replace(NUM_PREFIX, "").replace(/^[\s\-–—]+/, "")), options: [] };
      out.push(cur);
      continue;
    }
    if (!cur) continue;
    const opt = line.match(/^\s*([+-])\s*(.*)$/);
    if (opt) {
      const [first, ...rest] = opt[2].split(INLINE_VARIANT);
      cur.options.push({ text: cleanText(first), correct: opt[1] === "+" });
      for (const r of rest) cur.options.push({ text: cleanText(r), correct: false });
      continue;
    }
    if (/^\s*<?\s*vari?a?n?t?\s*>?\s+\S/i.test(line)) {
      cur.options.push({ text: cleanText(line), correct: false });
      continue;
    }
    appendTo(cur, line);
  }
  return out;
}

function parseCheckmark(lines: string[]): Draft[] {
  const out: Draft[] = [];
  let cur: Draft | null = null;
  for (const line of lines) {
    if (!line.trim()) continue;
    const isCorrect = CORRECT_MARK.test(line);
    const isWrong = !isCorrect && WRONG_MARK.test(line);
    if (cur && (isCorrect || isWrong)) {
      const text = cleanText(line.replace(CORRECT_MARK, "").replace(WRONG_MARK, ""));
      cur.options.push({ text, correct: isCorrect });
      continue;
    }
    if (NUM_PREFIX.test(line) || !cur || cur.options.length) {
      // A numbered line, or any plain line after options, starts a new question.
      if (cur && !cur.options.length && !NUM_PREFIX.test(line)) {
        appendTo(cur, line);
        continue;
      }
      cur = { text: cleanText(line.replace(NUM_PREFIX, "")), options: [] };
      out.push(cur);
      continue;
    }
    appendTo(cur, line);
  }
  return out;
}

function parseTags(raw: string): Draft[] {
  const text = preprocess(raw)
    // A numbered line without its <question> tag (lost in OCR) still starts a question.
    .map((l) =>
      /^\s*\d{1,4}\s*[.)]\s*[^\s<\d]/.test(l) && !/<\s*var|var[a-z]*\s*[>»]/i.test(l) && l.length > 15
        ? "<question>" + l.replace(NUM_PREFIX, "")
        : l,
    )
    .join("\n");
  const blocks = text.split(QUESTION_TAG).slice(1);
  return blocks.map((block) => {
    // The next question's number ("12.") sits right before its <question> tag.
    const b = block.replace(/\n\s*\d{1,4}\s*[.)]?\s*$/, "").replace(/\s*\d{1,4}\s*[.)]\s*$/, "");
    let parts = b.split(VARIANT_TAG);
    if (parts.length === 1) {
      // Tags lost entirely: question on the first line, one option per following line.
      parts = b.split("\n").filter((l) => l.trim());
      if (!parts.length) parts = [""];
    }
    const qText = cleanText(parts[0].replace(/\n/g, " "));
    const options = parts
      .slice(1)
      .map((p) => cleanText(p.replace(/\n/g, " ")))
      .filter(Boolean)
      .map((t, i) => ({ text: t, correct: i === 0 }));
    return { text: qText, options };
  });
}

const CYR_TO_LAT: Record<string, string> = { А: "A", Б: "B", В: "C", Г: "D", Д: "E" };
function letterIndex(l: string): number {
  const u = l.toUpperCase();
  const lat = CYR_TO_LAT[u] ?? u;
  return lat.charCodeAt(0) - 65;
}

function parseLettered(lines: string[]): Draft[] {
  const out: Draft[] = [];
  let cur: Draft | null = null;
  for (const line of lines) {
    if (!line.trim()) continue;
    const ans = line.match(ANSWER_LINE);
    if (ans && cur) {
      const i = letterIndex(ans[1]);
      if (cur.options[i]) cur.options[i].correct = true;
      continue;
    }
    const opt = line.match(LETTER_OPT);
    if (opt && cur) {
      const starred = /^\s*\*/.test(line);
      cur.options.push({ text: cleanText(line.replace(LETTER_OPT, "")), correct: starred });
      continue;
    }
    if (!cur || cur.options.length) {
      cur = { text: cleanText(line.replace(NUM_PREFIX, "")), options: [] };
      out.push(cur);
      continue;
    }
    appendTo(cur, line);
  }
  return out;
}

export function validate(drafts: Draft[]): Pick<ParseResult, "questions" | "skipped"> {
  const questions: ParsedQuestion[] = [];
  const skipped: ParseResult["skipped"] = [];
  for (const d of drafts) {
    const options = d.options.filter((o) => o.text.length > 0);
    if (normalizeKey(d.text).length < 3) continue;
    d.text = d.text.replace(/^[\s.,:;\-–—]+/, "");
    if (options.length < 2) {
      skipped.push({ text: d.text, reason: "меньше двух вариантов ответа" });
      continue;
    }
    if (!options.some((o) => o.correct)) {
      skipped.push({ text: d.text, reason: "не отмечен правильный ответ" });
      continue;
    }
    questions.push({ text: d.text, options });
  }
  return { questions, skipped };
}

export function parseText(raw: string): ParseResult {
  const format = detectFormat(raw);
  const lines = preprocess(raw);
  let drafts: Draft[] = [];
  if (format === "plusminus") drafts = parsePlusMinus(lines);
  else if (format === "checkmark") drafts = parseCheckmark(lines);
  else if (format === "tags") drafts = parseTags(raw);
  else if (format === "lettered") drafts = parseLettered(lines);
  return { format, ...validate(drafts) };
}

/* ---------- identity & de-duplication ---------- */

export function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function cyrb53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export function questionId(q: ParsedQuestion): string {
  const key =
    normalizeKey(q.text) +
    "|" +
    q.options.map((o) => (o.correct ? "+" : "-") + normalizeKey(o.text)).join("|");
  return cyrb53(key);
}

/** Turns parsed questions into Questions, dropping exact duplicates (keeps first occurrence). */
export function dedupe(qs: ParsedQuestion[]): { questions: Question[]; duplicates: number } {
  const seen = new Set<string>();
  const questions: Question[] = [];
  let duplicates = 0;
  for (const q of qs) {
    const id = questionId(q);
    if (seen.has(id)) {
      duplicates++;
      continue;
    }
    seen.add(id);
    questions.push({ id, text: q.text, options: q.options });
  }
  return { questions, duplicates };
}
