import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { MODEL, REASONING, ai, json, checkAccess, apiError } from "./_ai.js";

const Body = z.object({
  question: z.string().min(1).max(4000),
  options: z
    .array(z.object({ text: z.string().max(2000), correct: z.boolean() }))
    .min(2)
    .max(10),
});

const Explanation = z.object({
  summary: z.string().describe("Одно короткое предложение простыми словами: какой ответ верный и почему."),
  why_correct: z.string().describe("Почему это так: 1–2 коротких предложения простыми словами."),
  example: z.string().describe("Один короткий пример из жизни или из клиники, одно предложение."),
  mnemonic: z.string().describe("Запоминалка: короткая ассоциация, рифма или яркий образ."),
  key_link: z.string().describe("«Ключевое слово в вопросе → ответ»."),
});

const SYSTEM = `Ты — добрый преподаватель стоматологии. Помоги студентке понять и запомнить правильный ответ к тестовому вопросу.

Пиши по-русски, тепло и очень коротко: простые слова, короткие предложения, без воды. Термины сразу объясняй обычными словами.
Правильный ответ уже отмечен — объясняй именно его, даже если он спорный.
Пример — одна конкретная ситуация или сравнение, которое делает ответ очевидным.
Запоминалка — короткая и яркая, можно с юмором.`;

const LETTERS = "ABCDEFGHIJ";

export async function POST(req: Request): Promise<Response> {
  const denied = checkAccess(req);
  if (denied) return denied;

  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ error: "bad_request" }, 400);
  const { question, options } = body.data;

  const prompt = `Вопрос: ${question}

Варианты:
${options.map((o, i) => `${LETTERS[i]}) ${o.text}${o.correct ? "   ← ПРАВИЛЬНЫЙ" : ""}`).join("\n")}`;

  try {
    const res = await ai().responses.parse({
      model: MODEL,
      reasoning: { effort: REASONING },
      instructions: SYSTEM,
      input: prompt,
      text: { format: zodTextFormat(Explanation, "explanation") },
    });
    if (!res.output_parsed) return json({ error: "no_explanation" }, 502);
    return json(res.output_parsed);
  } catch (err) {
    return apiError(err);
  }
}
