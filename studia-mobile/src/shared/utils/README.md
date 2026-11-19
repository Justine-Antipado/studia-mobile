# shared utils

Pure helpers shared by both roles, so each exists once:
`format.ts` (dates, due labels, percent, score tone, plural — the student and instructor
`logic/format.ts` re-export from here), `file.ts` (upload whitelist, size limits,
`sanitizeFileName` hardened against path traversal, `validateFile(policy)`), `id.ts`
(`newId`, `newIdempotencyKey`).
