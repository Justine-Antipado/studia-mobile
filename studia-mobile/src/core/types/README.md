# core types

Types used across features: `role.ts` (`"student" | "instructor"`) and `content.ts`
(`Attachment`, `AttachmentKind`, `Comment` — identical on both sides, so the student and
instructor type files re-export them instead of redeclaring them).
