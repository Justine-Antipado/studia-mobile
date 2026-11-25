// Per-user AI quota (each call spends the shared free-tier allowance) and request logging in
// `ai_requests`. Both use the service role: clients cannot write that table.
//
// The slot is RESERVED before the provider is called and the row is finished afterwards. Counting
// first and inserting the log row after the answer came back meant a call was invisible for the
// seconds it took, so parallel requests all passed the same check and one user could drain the
// campus-wide free tier. See migration 035 (private.reserve_ai_request).
import { untyped, type Db } from "./clients.js";
import { ApiError } from "./http.js";
import type { Completion } from "./ai.js";

type Feature = "chat" | "quiz_synthesizer" | "summarizer";
type SourceType = "material" | "chat" | "class" | "quiz" | "planner";

const PER_HOUR: Record<Feature, number> = { chat: 40, quiz_synthesizer: 12, summarizer: 20 };

const overQuota = () =>
  new ApiError("RATE_LIMITED", "You have used the AI a lot this hour. Please try again later.", {
    retryAfterSec: 600,
  });

/**
 * Takes this call's slot for the hour, or throws RATE_LIMITED. Returns the reservation to settle with
 * `settleAi`; null when the row could not be created, which never blocks the answer.
 */
export async function reserveAi(
  db: Db,
  userId: string,
  feature: Feature,
  source?: { type: SourceType; id?: string },
): Promise<string | null> {
  const { data, error } = await untyped(db).rpc("reserve_ai_request", {
    p_user_id: userId,
    p_feature: feature,
    p_limit: PER_HOUR[feature],
    p_source_type: source?.type ?? null,
    p_source_id: source?.id ?? null,
  });
  if (error) {
    if (error.code === "22023") throw overQuota();
    // Bookkeeping must not be the reason an answer fails; the hourly cap is best-effort if the
    // reservation itself is broken.
    console.error("[ai] reserve failed", error.code ?? "unknown");
    return null;
  }
  return (data as string | null) ?? null;
}

/** Writes the outcome onto the reserved row. Never throws: logging may not break the answer. */
export async function settleAi(
  db: Db,
  id: string | null,
  outcome: { ok: boolean; result?: Completion; errorCode?: string },
): Promise<void> {
  if (!id) return;
  await db
    .from("ai_requests")
    .update({
      status: outcome.ok ? "ok" : "error",
      latency_ms: outcome.result?.latencyMs ?? null,
      tokens_in: outcome.result?.tokensIn ?? null,
      tokens_out: outcome.result?.tokensOut ?? null,
      error_code: outcome.errorCode ?? null,
    })
    .eq("id", id)
    .then(undefined, () => undefined);
}
