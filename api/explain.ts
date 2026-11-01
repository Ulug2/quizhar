import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { MODEL, ai, json, checkAccess, apiError } from "./_ai.js";

const Body = z.object({
  question: z.string().min(1).max(4000),
  options: z
    .array(z.object({ text: z.string().max(2000), correct: z.boolean() }))
    .min(2)
    .max(10),
});

const Explanation = z.object({
  summary: z.string().describe("Одно предложение: правильный ответ и главная причина."),
  why_correct: z.string().describe("Подробное объяснение, почему правильный ответ верен."),
  wrong_options: z
    .array(z.object({ letter: z.string(), why: z.string() }))
    .describe("Для каждого неверного варианта: буква и короткое объяснение, почему он неверен."),
  mnemonic: z.string().describe("Запоминалка: ассоциация, рифма, аббревиатура или яркий образ."),
  key_link: z
    .string()
    .describe("Связка «ключевое слово в вопросе → ответ», формат: «слово/фраза → ответ»."),
});

const SYSTEM = `Ты — опытный преподаватель стоматологии (ортодонтия, детская стоматология, ортопедия и смежные дисциплины), который помогает студентке готовиться к тестовому экзамену. Она учится, заучивая пары «вопрос → ответ», поэтому твоя задача — помочь ей понять и надёжно запомнить ПРАВИЛЬНЫЙ ответ из её базы.

Правила:
- Отвечай по-русски, тепло и ясно, без воды.
- Правильный ответ уже отмечен в базе. Объясняй именно его, даже если в учебниках встречаются разные мнения; если ответ спорный, мягко отметь это одной фразой, но всё равно помоги запомнить ответ из базы.
- Буквы вариантов — латинские A, B, C, D, E в исходном порядке. Не меняй порядок.
- why_correct: 3–6 предложений, с опорой на механизм, классификацию или клиническую логику.
- wrong_options: по одному-два предложения на каждый неверный вариант.
- mnemonic: короткая, запоминающаяся, можно с юмором или эмодзи.
- key_link: найди в вопросе слово или фразу, которая «выдаёт» ответ, и свяжи их стрелкой.`;

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
      reasoning: { effort: "low" },
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
