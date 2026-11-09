import { useStore } from "./store";
import type { Explanation, ParsedQuestion, Question } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

const MESSAGES: Record<string, string> = {
  access_denied: "Нужен код доступа. Введи его в настройках.",
  rate_limited: "ИИ сейчас перегружен. Попробуй ещё раз через минуту.",
  no_credits: "У ИИ закончился баланс. Скоро пополним, а пока можно учить без объяснений.",
  bad_api_key: "На сервере не настроен ключ ИИ.",
  offline: "Нет интернета. Объяснения появятся, когда связь вернётся.",
};

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-access-code": useStore.getState().settings.accessCode,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(MESSAGES.offline, "offline");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = (data as { error?: string }).error ?? "server_error";
    throw new ApiError(MESSAGES[code] ?? "Не получилось. Попробуй ещё раз.", code);
  }
  return data as T;
}

export function fetchExplanation(q: Question): Promise<Explanation> {
  return post<Explanation>("/api/explain", { question: q.text, options: q.options });
}

export async function aiParse(text: string): Promise<ParsedQuestion[]> {
  const data = await post<{ questions: ParsedQuestion[] }>("/api/parse", { text });
  return data.questions;
}
