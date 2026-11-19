# instructor data

Repository/hook pattern (P1): one `*-repository.ts` per domain (classes, students, announcements,
materials, assignments, quizzes, submissions, analytics) with an interface + in-memory mock.
`class-directory.ts` holds the seed facts repositories stamp onto their records.
