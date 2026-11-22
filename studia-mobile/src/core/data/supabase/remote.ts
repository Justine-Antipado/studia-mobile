// remote.ts: helpers shared by every remote (Supabase) repository implementation.
// Repositories stay thin: they call `guard()` so a thrown/PostgREST error always becomes an AppError,
// and use `myId()` for the signed-in user. RLS in supabase/migrations is the real authorisation.
import { appError, fail, ok, type AppError, type Result } from "@/core/data/errors/app-error";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/core/data/supabase/client";

/** Untyped on purpose: shared-types/database.types.ts lags the migrations (regenerate with the CLI). */
export const db = () => getSupabase() as unknown as SupabaseClient<any, "public", any>;

export async function myId(): Promise<string> {
  const { data } = await getSupabase().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw appError("unauthorized", "Your session has ended. Please sign in again.", false);
  return id;
}

type PgError = { code?: string; message?: string; status?: number };

/** Maps a PostgREST / fetch failure to the app's one error shape. Never forwards server text. */
export function mapError(e: unknown, notFoundMessage = "This item no longer exists."): AppError {
  if (typeof e === "object" && e !== null && "retryable" in e && "code" in e && "message" in e) return e as AppError;
  const err = (e ?? {}) as PgError;
  const msg = String(err.message ?? "");
  if (err.code === "PGRST116" || err.code === "P0002") return appError("not_found", notFoundMessage);
  if (err.code === "42501" || err.status === 401 || err.status === 403 || err.code === "PGRST301")
    return appError("unauthorized", "You do not have access to this.", false);
  if (err.code === "23505") return appError("conflict", "That already exists.", false);
  if (err.code && /^(23|22)/.test(err.code)) return appError("validation", "Some of the details are not valid.", false);
  if (/network|fetch|timed out|timeout/i.test(msg)) return appError("network", "Could not reach the server. Check your connection.");
  return appError("unknown", "Something went wrong. Please try again.", true);
}

/** Runs a remote call and returns a Result; PostgREST errors must be thrown by the callback. */
export async function guard<T>(run: () => Promise<T>, notFoundMessage?: string): Promise<Result<T>> {
  try {
    return ok(await run());
  } catch (e) {
    return fail(mapError(e, notFoundMessage));
  }
}

/** Unwraps `{ data, error }` from supabase-js, throwing the error so `guard` can map it. */
export function must(res: { data: unknown; error: unknown }): any {
  if (res.error) throw res.error;
  return res.data;
}

export function mustOk(res: { error: unknown }): void {
  if (res.error) throw res.error;
}

/* ---------- class section: the DB stores course / year / section, the UI shows "BSIT 3-A" ---------- */

export const COURSES = ["BSIT", "BEED", "BSBA-FM", "BSBA-OM"] as const;
export type CourseCode = (typeof COURSES)[number];
export type YearLevel = "1" | "2" | "3" | "4";
export type SectionCode = "A" | "B" | "C" | "D" | "E";

const SECTION_RE = /^(BSIT|BEED|BSBA-FM|BSBA-OM)\s+([1-4])\s*-\s*([A-E])$/i;

export function parseSectionLabel(label: string): { course: CourseCode; year: YearLevel; section: SectionCode } | null {
  const m = SECTION_RE.exec(label.trim());
  if (!m) return null;
  return { course: m[1]!.toUpperCase() as CourseCode, year: m[2] as YearLevel, section: m[3]!.toUpperCase() as SectionCode };
}

export const sectionLabel = (course: string, year: string, section: string) => `${course} ${year}-${section}`;

export const SECTION_HINT = "Use the format BSIT 3-A (course, year 1-4, section A-E).";
