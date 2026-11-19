# student data

One `<domain>-repository.ts` per feature (`classes`, `announcements`, `lessons`, `assignments`,
`quizzes`, `tasks`, `planner`): a typed interface + an in-memory mock implementation returning
`Result<T, AppError>`, with simulated latency via `core/data/mock/mock-latency.ts`. Swapping to
the real API means replacing one file; hooks and screens do not change.
`class-directory.ts` holds the small set of class facts every repository stamps onto its records.
