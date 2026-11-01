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
  summary: z.string().describe("Одно короткое предложение простыми словами: какой ответ верный и почему."),
  why_correct: z.string().describe("Объяснение простыми словами, 2–4 коротких предложения."),
  example: z.string().describe("Конкретный пример из жизни или из клиники, который делает ответ понятным."),
  wrong_options: z
    .array(z.object({ letter: z.string(), why: z.string() }))
    .describe("Для каждого неверного варианта: буква и одно простое предложение, почему он не подходит."),
  mnemonic: z.string().describe("Запоминалка: ассоциация, рифма, аббревиатура или яркий образ."),
  key_link: z
    .string()
    .describe("Связка «ключевое слово в вопросе → ответ», формат: «слово/фраза → ответ»."),
});

const SYSTEM = `Ты — добрый преподаватель стоматологии (ортодонтия, детская стоматология, ортопедия и смежные темы). Ты помогаешь студентке понять и запомнить ответы к тестовому экзамену. Она учит пары «вопрос → ответ», поэтому объясни так, чтобы ответ стал понятным и легко запоминался.

Как писать:
- По-русски, тепло, как будто объясняешь подруге за чаем.
- Простые слова и короткие предложения. Если без термина не обойтись, сразу объясни его обычными словами в скобках.
- Никакой воды и длинных академических оборотов.
- Обязательно приведи конкретный пример (поле example): ситуация с пациентом, сравнение с чем-то из жизни или числа на примере. Пример должен делать ответ очевидным.
- Правильный ответ уже отмечен в базе. Объясняй именно его. Если ответ спорный, отметь это одной короткой фразой, но всё равно помоги его запомнить.
- Буквы вариантов — латинские A, B, C, D, E в исходном порядке. Не меняй порядок.
- wrong_options: по одному простому предложению на каждый неверный вариант.
- mnemonic: короткая и яркая, можно с юмором.
- key_link: найди в вопросе слово, которое «выдаёт» ответ, и свяжи его стрелкой с ответом.`;

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
