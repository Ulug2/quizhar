// Walks through the app on an iPhone-17-Pro-sized WebKit viewport and saves screenshots.
// Usage: node scripts/shots.mjs <url> <outDir> <inputDir>
import { webkit } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [url = "http://localhost:5199", out = "shots", inputDir = "input"] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });

const browser = await webkit.launch();
const ctx = await browser.newContext({
  viewport: { width: 402, height: 874 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: "ru-RU",
  colorScheme: "dark",
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

// The real API needs a key; for screenshots, answer /api/explain with a fixed sample.
await page.route("**/api/explain", (r) =>
  r.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      summary: "Мезиальная окклюзия — это III класс по Энглю: нижний первый моляр смещён вперёд.",
      why_correct:
        "Классификация Энгля основана на положении первых постоянных моляров. При III классе мезиально-щёчный бугор верхнего первого моляра располагается позади поперечной фиссуры нижнего, то есть нижняя челюсть смещена вперёд — это и есть мезиальная окклюзия.",
      wrong_options: [
        { letter: "B", why: "I класс — нейтральное соотношение моляров, а не мезиальное." },
        { letter: "C", why: "II класс — дистальная окклюзия, нижняя челюсть позади." },
        { letter: "D", why: "IV класса у Энгля нет." },
        { letter: "E", why: "V класса у Энгля тоже нет." },
      ],
      mnemonic: "Мезиальная — «Мез» и три буквы: М-Е-З → III класс",
      key_link: "мезиальная → 3 класс Энгля",
    }),
  }),
);

let n = 0;
const shot = async (name) => {
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}.png`) });
};

await page.goto(url);
await shot("welcome");
await page.getByRole("button", { name: "Начнём, жаным" }).tap();
await shot("home-empty");

await page.getByRole("button", { name: /Загрузить вопросы/ }).tap();
await shot("import-pick");
const files = ["Полный тест по ортодонтии (142 вопроса).txt", "Ортодонтия с фоток.docx"].map((f) => path.join(inputDir, f));
await page.locator('input[type="file"]').setInputFiles(files);
await page.getByRole("button", { name: "Начать учить" }).waitFor({ timeout: 20000 });
await shot("import-review");
await page.getByRole("button", { name: "Начать учить" }).tap();
await shot("deck");

await page.getByRole("button", { name: /Карточки/ }).tap();
await shot("cards-setup");
await page.getByRole("button", { name: "Начать" }).tap();
await shot("card-front");
await page.getByText("Нажми, чтобы увидеть ответ").tap();
await shot("card-back");
await page.getByRole("button", { name: "Знаю" }).tap();
await page.waitForTimeout(150);
await shot("card-compliment");
await page.getByRole("button", { name: "Назад" }).tap();

await page.getByRole("button", { name: /Тренировка/ }).tap();
await page.getByRole("button", { name: "Начать" }).tap();
await shot("practice");
await page.locator("main ul li button").first().tap();
await shot("practice-answered");
await page.getByRole("button", { name: /Почему/ }).tap();
await shot("explanation");
await page.keyboard.press("Escape");
await page.getByRole("button", { name: "Назад" }).tap();

await page.getByRole("button", { name: /Пробный экзамен/ }).tap();
await page.getByRole("button", { name: "10", exact: true }).tap();
await page.getByRole("button", { name: "Начать" }).tap();
await shot("exam");
for (let i = 0; i < 10; i++) {
  await page.locator("main ul li button").nth(i % 3).tap();
  await page.getByRole("button", { name: /Дальше|Завершить/ }).tap();
  await page.waitForTimeout(350);
}
await shot("exam-results");
{
  const b = page.getByRole("button", { name: "К колоде" });
  await b.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await b.tap();
}
await shot("after-exam");

await page.getByRole("button", { name: /Все вопросы/ }).tap();
await shot("browse");
await page.getByRole("button", { name: "Назад" }).tap();
await page.getByRole("button", { name: "Назад" }).tap();
await shot("home");

console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no page errors");
await browser.close();
