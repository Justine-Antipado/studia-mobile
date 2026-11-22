// Gemini's native generateContent API. Needed for what the OpenAI-compatible endpoint cannot carry:
// a PDF (inline base64) or a YouTube video by URL (Gemini watches and listens to it, so videos
// without captions work too). Only available when the provider is Gemini.
import type { Completion } from "./ai.js";
import { ApiError } from "./http.js";

const GEMINI_HOST = "generativelanguage.googleapis.com";
const DEFAULT_MODEL = "gemini-2.5-flash";

export type NativePart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { fileData: { fileUri: string } };

const unavailable = (message = "The AI assistant is busy right now. Please try again in a moment.") =>
  new ApiError("AI_UNAVAILABLE", message);

export async function completeNative(opts: {
  system: string;
  parts: NativePart[];
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  lowMediaResolution?: boolean;
}): Promise<Completion> {
  const key = process.env.AI_API_KEY;
  if (!key) throw unavailable("The AI assistant is not set up on the server yet.");
  const base = process.env.AI_BASE_URL || GEMINI_HOST;
  if (!base.includes(GEMINI_HOST)) {
    throw unavailable("Summarising videos and PDFs needs the Gemini provider (AI_BASE_URL).");
  }
  const model = process.env.AI_MODEL || DEFAULT_MODEL;

  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 50_000);
  let res: Response;
  try {
    res = await fetch(`https://${GEMINI_HOST}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [{ role: "user", parts: opts.parts }],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: opts.maxTokens ?? 2500,
          temperature: opts.temperature ?? 0.3,
          ...(opts.lowMediaResolution ? { mediaResolution: "MEDIA_RESOLUTION_LOW" } : {}),
        },
      }),
      signal: ctrl.signal,
    });
  } catch {
    throw unavailable();
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 429) throw unavailable("The AI service has reached its free limit for now. Please try again later.");
  if (!res.ok) {
    console.error("[ai] native status", res.status); // status only: never log prompts or answers
    throw unavailable(res.status === 400 ? "The AI could not read this file or video. A private or very long video may not work." : undefined);
  }
  const data = (await res.json().catch(() => null)) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  } | null;
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  if (!text) throw unavailable("The AI could not read this file or video.");
  return {
    text,
    tokensIn: data?.usageMetadata?.promptTokenCount ?? null,
    tokensOut: data?.usageMetadata?.candidatesTokenCount ?? null,
    latencyMs: Date.now() - started,
  };
}
