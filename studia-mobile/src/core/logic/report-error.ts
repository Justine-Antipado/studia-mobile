// report-error.ts — single crash/error sink. Swap the body for Sentry/Bugsnag later;
// nothing else in the app should call console.error directly.
//
// SECURITY: never pass tokens, passwords, OTPs, emails or full request bodies in here.
// In production this is intentionally silent until a logging service is wired up.

export type ErrorContext = {
  /** Where it happened, e.g. "student/course-detail" or "quiz-repository.publish". */
  scope: string;
  /** Non-sensitive extra data (ids, counts, codes only). */
  info?: Record<string, string | number | boolean | null>;
};

export function reportError(error: unknown, context: ErrorContext): void {
  if (!__DEV__) {
    // TODO(P6): forward to the logging service (strip PII before sending).
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.warn(`[studia:${context.scope}] ${message}`, { info: context.info, stack });
}
