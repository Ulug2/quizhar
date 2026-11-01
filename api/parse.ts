import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { MODEL, ai, json, checkAccess, apiError } from "./_ai.js";

/**
 * AI fallback for files whose format the built-in parser doesn't recognise.
 * The client sends the file in chunks of ~8k characters.
 */
const Body = z.object({ text: z.string().min(1).max(20000) });

const Parsed = z.object({
  questions: z.array(
    z.object({
      text: z.string(),
      options: z.array(z.object({ text: z.string(), correct: z.boolean() })),
    }),
  ),
});

const SYSTEM = `You extract exam test questions from raw text (usually Russian, sometimes Kazakh or English; often OCR'd or copied from Word).

Rules:
- Return every multiple-choice question found in the text, in the original order.
- Keep each question's answer options in EXACTLY the original order. Never reorder.
- Copy wording faithfully. Only fix obvious extraction junk (stray tags like <variant>, "»", list numbering, broken line wraps). Do not translate or paraphrase.
- Mark correct=true only for options the source marks as correct (+, ✅, bold/star markers, "Ответ: B", an answer key, or a format convention such as "first <variant> is correct"). Never guess from your own knowledge.
- If the source gives no way to tell which option is correct, still return the question with all options correct=false.
- A question that is cut off at the start or end of the chunk should be skipped.
- If the text has no multiple-choice questions, return an empty list.`;

export async function POST(req: Request): Promise<Response> {
  const denied = checkAccess(req);
  if (denied) return denied;

  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ error: "bad_request" }, 400);

  try {
    const res = await ai().responses.parse({
      model: MODEL,
      reasoning: { effort: "low" },
      instructions: SYSTEM,
      input: `<text>\n${body.data.text}\n</text>`,
      text: { format: zodTextFormat(Parsed, "questions") },
    });
    if (!res.output_parsed) return json({ error: "parse_failed" }, 502);
    return json(res.output_parsed);
  } catch (err) {
    return apiError(err);
  }
}
