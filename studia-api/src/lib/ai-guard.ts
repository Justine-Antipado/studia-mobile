// Per-user AI quota (each call spends the shared free-tier allowance) and request logging in
// `ai_requests`. Both use the service role: clients cannot write that table.
import type { Db } from "./clients.js";
import { ApiError } from "./http.js";
import type { Completion } from "./ai.js";

type Feature = "chat" | "quiz_synthesizer" | "summarizer";

const PER_HOUR: Record<Feature, number> = { chat: 40, quiz_synthesizer: 12, summarizer: 20 };

export async function assertAiQuota(db: Db, userId: string, feature: Feature): Promise<void> {
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count, error } = await db
    .from("ai_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature", feature)
    .gte("created_at", since);
  if (error) throw error;
  if ((count ?? 0) >= PER_HOUR[feature]) {
    throw new ApiError("RATE_LIMITED", "You have used the AI a lot this hour. Please try again later.", {
      retryAfterSec: 600,
    });
  }
}

export async function logAi(
  db: Db,
  row: {
    userId: string;
    feature: Feature;
    ok: boolean;
    sourceType?: "material" | "chat" | "class" | "quiz" | "planner";
    sourceId?: string;
    result?: Completion;
    errorCode?: string;
  },
): Promise<void> {
  await db
    .from("ai_requests")
    .insert({
      user_id: row.userId,
      feature: row.feature,
      status: row.ok ? "ok" : "error",
      source_type: row.sourceType ?? null,
      source_id: row.sourceId ?? null,
      latency_ms: row.result?.latencyMs ?? null,
      tokens_in: row.result?.tokensIn ?? null,
      tokens_out: row.result?.tokensOut ?? null,
      error_code: row.errorCode ?? null,
    })
    .then(undefined, () => undefined); // logging must never break the answer
}
