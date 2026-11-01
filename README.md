<div align="center">

# Quizhar 💗

**A tiny study app made with love for Azhar.**

Pink, black, and full of compliments.

</div>

---

## What it is

Azhar studies by learning every question and its answer by heart. Quizhar turns her test files into
flashcards and practice exams, explains each answer, and tells her she's amazing every time she gets
one right. Because she is.

## What it can do

- 📂 **Upload & go.** Drop in `.txt`, `.docx` or `.pdf` test files. Repeated questions are merged into one.
- 🃏 **Flashcards.** Tap to flip, swipe right for *знаю*, left for *ещё учу*.
- 📝 **Practice.** See right away whether each answer was right.
- 🎓 **Mock exam.** No hints, an optional timer, and a score at the end.
- 🧠 **Learn mode.** Missed questions come back until they stick.
- 🔁 **Mistakes.** Only the questions that gave her trouble.
- ✨ **Explanations.** Why the answer is right, why the others are wrong, and a memory trick.
- 💌 **Compliments.** *Умница моя. Жаным, сол правильно. Молодец, жаным. Красотка моя.* And a burst of hearts.
- 🔤 **Answers stay where they are.** If the answer is B, it's always B.

## For the boyfriend (setup)

```bash
npm install
echo "OPENAI_API_KEY=sk-proj-..." > .env.local   # optional: ACCESS_CODE=..., OPENAI_MODEL=...
env -u OPENAI_API_KEY npm run dev                 # your shell's own key would override .env.local
npm run test:parser                               # checks every file in input/
```

It's deployed on Vercel at **https://quizhar.vercel.app**, and every push to `main` redeploys it.
Secrets (`OPENAI_API_KEY`, `ACCESS_CODE`) live in the Vercel project settings, never in the code.

On her iPhone: Safari → Share → **Add to Home Screen** → enter the access code once in settings.

## How it works

- Files are read on the phone. `src/lib/parser.ts` understands the usual formats
  (`? / + / -`, `[✅] / ⚪`, `<question> / <variant>`, `A) … Ответ: B`) and forgives messy OCR.
- Unusual formats are read by OpenAI (`api/parse.ts`). Explanations come from `api/explain.ts`
  and are saved on the phone, so each one is only generated once.
- Progress and decks stay on her phone. No accounts, no tracking.

<div align="center">

Made with 💗 for Ажар

</div>
