// AI provider client. Speaks the OpenAI-compatible chat-completions protocol, which the free tiers of
// Google Gemini, Groq and OpenRouter all offer, so switching provider is an env change only:
//   AI_API_KEY    required. Created in the provider's console (free tier). Server-side ONLY.
//   AI_BASE_URL   default: Gemini's OpenAI-compatible endpoint.
//   AI_MODEL      default below; check the provider's current free model list.
// The key never reaches the mobile app: the app calls studia-api, which calls the provider.
import { ApiError } from "./http.js";

const DEFAULT_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";
const DEFAULT_MODEL = "gemini-4-hydrogen";
const TIMEOUT_MS = 24_000; // Vercel functions here are capped at 30 s (vercel.json)
const MAX_ATTEMPTS = 2; // the free tier returns 503 "overloaded" often enough to be worth one retry;
// kept low since each attempt can take up to TIMEOUT_MS and the function itself is capped at 60 s
const RETRY_DELAY_MS = 500;

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };
export type Completion = { text: string; tokensIn: number | null; tokensOut: number | null; latencyMs: number };

const unavailable = (message = "The AI assistant is busy right now. Please try again in a moment.") =>
  new ApiError("AI_UNAVAILABLE", message);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function complete(opts: {
  messages: ChatMsg[];
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
}): Promise<Completion> {
  const key = process.env.AI_API_KEY;
  if (!key) throw unavailable("The AI assistant is not set up on the server yet.");
  const base = (process.env.AI_BASE_URL || DEFAULT_BASE).replace(/\/+$/, "");
  const model = process.env.AI_MODEL || DEFAULT_MODEL;

  const started = Date.now();
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: opts.messages,
          temperature: opts.temperature ?? 0.4,
          max_tokens: opts.maxTokens ?? 1024,
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: ctrl.signal,
      });
    } catch {
      clearTimeout(timer);
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }
      throw unavailable();
    }
    clearTimeout(timer);

    if (res.status === 429) throw unavailable("The AI service has reached its free limit for now. Please try again later.");
    // 503 is Gemini's free-tier "model overloaded" response -- transient, worth a quick retry.
    if (res.status === 503 && attempt < MAX_ATTEMPTS) {
      await sleep(RETRY_DELAY_MS * attempt);
      continue;
    }
    if (!res.ok) {
      console.error("[ai] provider status", res.status); // status only: never log prompts or answers
      throw unavailable();
    }

    const data = (await res.json().catch(() => null)) as {
      choices?: { message?: { content?: string | null } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    } | null;
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) {
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }
      throw unavailable();
    }
    return {
      text,
      tokensIn: data?.usage?.prompt_tokens ?? null,
      tokensOut: data?.usage?.completion_tokens ?? null,
      latencyMs: Date.now() - started,
    };
  }
  throw unavailable();
}

/** Parses a JSON answer even if the model wrapped it in a code fence or added a sentence around it. */
export function parseJson(text: string): unknown {
  const fenced = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(fenced);
  } catch {
    const start = fenced.indexOf("{");
    const end = fenced.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(fenced.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    return null;
  }
}
