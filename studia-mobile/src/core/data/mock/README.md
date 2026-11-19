# core data mock

`mock-data.ts` — the AI chat seed, the last screen data not yet behind a repository. Everything
else (classes, courses, notifications, …) moved into `features/<feature>/data/*-repository.ts`.
`mock-latency.ts` — `simulateLatency()` + `mockCall()` used by every mock repository so
loading and error states are real; raise `MOCK_FAILURE_RATE` (DEV only) to exercise the
error/retry/offline UI.
