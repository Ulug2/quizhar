# Quizhar

Study app for Azhar: upload TXT / DOCX / PDF test files and study them as flashcards,
practice tests, mock exams and a "learn until memorised" mode, with AI explanations and
memory tips. Made for iPhone (add it to the Home Screen), pink and black.

## How it works

- **Files are read in the browser.** `src/lib/parser.ts` understands the common formats
  (`? / + / -`, `[✅] / ⚪`, `<question> / <variant>` with the first variant correct,
  `A) … Ответ: B`) and tolerates OCR junk. Identical questions are merged.
- **Unknown formats go to OpenAI** (`api/parse.ts`), in ~8k-character chunks.
- **Explanations** (`api/explain.ts`) are generated on demand per question and cached on the phone.
- **Answer options are never shuffled.** Only question order can be shuffled.
- Progress, decks and explanations live in IndexedDB on the phone (no account).

## Run locally

```bash
npm install
echo "OPENAI_API_KEY=sk-proj-..." > .env.local   # optional: ACCESS_CODE=..., OPENAI_MODEL=...
npm run dev              # an OPENAI_API_KEY exported in your shell overrides .env.local; open the Network URL on the iPhone (same Wi-Fi)
npm run test:parser      # parses every file in input/ and prints a report
```

## Deploy to Vercel

```bash
vercel login
vercel link
vercel env add OPENAI_API_KEY production
vercel env add ACCESS_CODE production   # recommended, so nobody else can spend the key
vercel deploy --prod
```

On the iPhone: open the URL in Safari → Share → **Add to Home Screen**. If you set
`ACCESS_CODE`, enter it once in the app's settings.
