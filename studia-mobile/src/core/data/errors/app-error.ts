// app-error.ts — the one error shape every repository returns. Screens never see raw
// Error/exception objects or server text; report-error.ts is for crashes, this is for data calls.
export type AppErrorCode =
  | "network"
  | "timeout"
  | "not_found"
  | "validation"
  | "conflict"
  | "unauthorized"
  | "unknown";

export type AppError = { code: AppErrorCode; message: string; retryable: boolean };

const RETRYABLE: ReadonlySet<AppErrorCode> = new Set(["network", "timeout"]);

export function appError(code: AppErrorCode, message: string, retryable = RETRYABLE.has(code)): AppError {
  return { code, message, retryable };
}

function isAppError(value: unknown): value is AppError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "message" in value &&
    "retryable" in value
  );
}

/** Normalizes any thrown value into an AppError. Never forwards a raw stack/server string. */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;
  return appError("unknown", "Something went wrong. Please try again.", true);
}

export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = (error: AppError): Result<never> => ({ ok: false, error });

export type RetryOptions = { attempts?: number; baseDelayMs?: number };

/** Exponential backoff for READS only. Writes must stay idempotent before using this. */
export async function withRetry<T>(
  run: () => Promise<Result<T>>,
  { attempts = 3, baseDelayMs = 300 }: RetryOptions = {},
): Promise<Result<T>> {
  let last: Result<T> = fail(appError("unknown", "Something went wrong. Please try again."));
  for (let attempt = 0; attempt < attempts; attempt++) {
    last = await run();
    if (last.ok || !last.error.retryable) return last;
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
    }
  }
  return last;
}
