# core data errors

`app-error.ts` — the `AppError`/`Result<T,E>` shape every repository returns, plus `withRetry`
for retryable reads. Screens never see a raw `Error` or server text.
