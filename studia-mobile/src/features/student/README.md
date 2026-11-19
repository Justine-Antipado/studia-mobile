# student feature

Everything for the student role: courses (stream, lessons, assignments, quizzes, people, grades),
To-do, Study Planner. AI, Notifications and Account are shared screens built in P4.
Repository/hook pattern: `data/` owns an interface + mock implementation per domain, `hooks/`
exposes `{data, loading, error, refetch, mutate}` through `core/data/repository/use-query.ts`.
Screens only call `hooks/`, never `data/` directly.
