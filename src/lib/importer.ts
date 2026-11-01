import { extractFile } from "./extract";
import { dedupe, parseText, validate, type FormatId } from "./parser";
import { aiParse } from "./api";
import type { ParsedQuestion, Question } from "./types";

export interface FileReport {
  name: string;
  format: FormatId | "ai";
  count: number;
  error?: string;
}

export interface ImportReport {
  files: FileReport[];
  questions: Question[];
  duplicates: number;
  skipped: { text: string; reason: string }[];
}

const CHUNK = 8000;

/** Splits on blank lines (or line breaks) so a question is rarely cut in half. */
function chunks(text: string): string[] {
  const parts = text.split(/\n\s*\n/);
  const out: string[] = [];
  let cur = "";
  for (let p of parts) {
    while (p.length > CHUNK) {
      const cut = p.lastIndexOf("\n", CHUNK) > 0 ? p.lastIndexOf("\n", CHUNK) : CHUNK;
      out.push((cur + "\n\n" + p.slice(0, cut)).trim());
      cur = "";
      p = p.slice(cut);
    }
    if (cur.length + p.length > CHUNK) {
      out.push(cur.trim());
      cur = "";
    }
    cur += "\n\n" + p;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

async function parseWithAI(text: string, onStatus: (s: string) => void): Promise<ParsedQuestion[]> {
  const parts = chunks(text);
  const results: ParsedQuestion[][] = new Array(parts.length);
  let done = 0;
  let next = 0;
  onStatus(`ИИ читает файл… 0 из ${parts.length}`);
  const worker = async () => {
    while (next < parts.length) {
      const i = next++;
      results[i] = await aiParse(parts[i]);
      done++;
      onStatus(`ИИ читает файл… ${done} из ${parts.length}`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, parts.length) }, worker));
  return results.flat();
}

export async function importFiles(files: File[], onStatus: (s: string) => void): Promise<ImportReport> {
  const reports: FileReport[] = [];
  const all: ParsedQuestion[] = [];
  const skipped: ImportReport["skipped"] = [];

  for (const file of files) {
    onStatus(`Читаю «${file.name}»…`);
    try {
      const { text, richText } = await extractFile(file);
      const r = parseText(text);
      if (r.format !== "unknown" && r.questions.length > 0) {
        all.push(...r.questions);
        skipped.push(...r.skipped);
        reports.push({ name: file.name, format: r.format, count: r.questions.length });
        continue;
      }
      const ai = validate(await parseWithAI(richText, onStatus));
      all.push(...ai.questions);
      skipped.push(...ai.skipped);
      reports.push({
        name: file.name,
        format: "ai",
        count: ai.questions.length,
        error: ai.questions.length ? undefined : "В файле не нашлось вопросов с вариантами ответов.",
      });
    } catch (e) {
      reports.push({ name: file.name, format: "unknown", count: 0, error: (e as Error).message });
    }
  }

  const { questions, duplicates } = dedupe(all);
  return { files: reports, questions, duplicates, skipped };
}
