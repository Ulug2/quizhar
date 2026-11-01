import OpenAI from "openai";

/** Override with OPENAI_MODEL on Vercel if you want a different model. */
export const MODEL = process.env.OPENAI_MODEL || "gpt-5.5";

let client: OpenAI | null = null;
export function ai(): OpenAI {
  client ??= new OpenAI();
  return client;
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/** Optional shared passcode so strangers can't spend the API key. Set ACCESS_CODE on Vercel. */
export function checkAccess(req: Request): Response | null {
  if (!process.env.OPENAI_API_KEY) return json({ error: "bad_api_key" }, 500);
  const code = process.env.ACCESS_CODE;
  if (!code) return null;
  if (req.headers.get("x-access-code") === code) return null;
  return json({ error: "access_denied" }, 401);
}

export function apiError(err: unknown): Response {
  if (err instanceof OpenAI.RateLimitError) return json({ error: "rate_limited" }, 429);
  if (err instanceof OpenAI.AuthenticationError) return json({ error: "bad_api_key" }, 500);
  if (err instanceof OpenAI.APIError) return json({ error: "api_error", detail: err.message }, 502);
  return json({ error: "server_error", detail: String(err) }, 500);
}
