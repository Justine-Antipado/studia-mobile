// validators.ts — input validation/sanitization for every student form. Repositories never
// receive raw, untrimmed or oversized input. Route params are validated separately in
// core/logic/route-params.ts.
import {
  ATTACHMENT_MIME_TYPES,
  IMAGE_MIME_TYPES,
  type FilePolicy,
} from "@/shared/utils/file";

export { formatFileSize, sanitizeFileName } from "@/shared/utils/file";

export const JOIN_CODE_PATTERN = /^[A-Z0-9]{6}$/;

export function validateJoinCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  if (!code) return "Enter a class code.";
  if (!JOIN_CODE_PATTERN.test(code)) return "Class codes are 6 letters or numbers.";
  return null;
}

export function validateCommentText(raw: string): string | null {
  const text = raw.trim();
  if (!text) return "Write a comment first.";
  if (text.length > 500) return "Comments are limited to 500 characters.";
  return null;
}

export function validateSubmissionText(raw: string, required: boolean): string | null {
  const text = raw.trim();
  if (required && !text) return "Add a short note or attach a file.";
  if (text.length > 4000) return "Keep this under 4000 characters.";
  return null;
}

export function validateEssayAnswer(raw: string): string | null {
  const text = raw.trim();
  if (text.length > 4000) return "Keep your answer under 4000 characters.";
  return null;
}

/**
 * What a student may attach to a submission: documents, slides, images or a short video,
 * up to 50 MB. The whitelist itself lives in shared/utils/file.ts.
 */
export const SUBMISSION_FILE_POLICY: FilePolicy = {
  kinds: ["pdf", "doc", "slide", "image", "video"],
  maxBytes: 50 * 1024 * 1024,
  rejectMessage: "Allowed files: PDF, Word, PowerPoint, images, MP4 or MOV.",
  mimeTypes: [...ATTACHMENT_MIME_TYPES, ...IMAGE_MIME_TYPES],
};
