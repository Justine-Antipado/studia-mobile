# instructor hooks

Screens only call these, never a repository directly. Each wraps `core/data/repository`'s
`useQuery`/`useMutation` for one domain (classes, students, announcements, materials,
assignments, quizzes, submissions, analytics, home stats).
