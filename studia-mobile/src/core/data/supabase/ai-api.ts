// ai-api.ts: calls the studia-api AI endpoints (api/ai/*). The AI provider key lives on the server;
// the app only sends the signed-in user's access token. AI answers take a few seconds, so the
// timeout is longer than for the auth calls. Writes/generations are never auto-retried (each call
// spends the shared free-tier quota).
import type { z } from "zod";

import { appError, fail, ok, type Result } from "@/core/data/errors/app-error";
import { getSupabase } from "@/core/data/supabase/client";
import { post } from "@/features/auth/data/auth-api";
import { isAuthError } from "@/features/auth/types/auth-types";

const AI_TIMEOUT_MS = 40_000;

export async function callAi<T>(
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
  timeoutMs: number = AI_TIMEOUT_MS,
): Promise<Result<T>> {
  try {
    const { data } = await getSupabase().auth.getSession();
    const token = data.session?.access_token;
    if (!token) return fail(appError("unauthorized", "Your session has ended. Please sign in again.", false));
    return ok(await post(`ai/${path}`, body, schema, token, timeoutMs));
  } catch (e) {
    if (isAuthError(e)) {
      if (e.code === "NETWORK") return fail(appError("network", e.message));
      return fail(appError(e.code === "OTP_EXPIRED" ? "unauthorized" : "conflict", e.message, false));
    }
    return fail(appError("unknown", "Something went wrong. Please try again.", false));
  }
}
