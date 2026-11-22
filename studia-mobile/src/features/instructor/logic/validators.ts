// validators.ts — input validation/sanitization for every instructor form. Repositories never
// receive raw, untrimmed or oversized input. Route params are validated separately in
// core/logic/route-params.ts.
import { MATERIAL_MIME_TYPES, type FilePolicy } from "@/shared/utils/file";

export { formatFileSize, sanitizeFileName } from "@/shared/utils/file";

export function validateClassTitle(raw: string): string | null {
  const text = raw.trim();
  if (!text) return "Enter a class name.";
  if (text.length > 80) return "Keep the name under 80 characters.";
  return null;
}

export function validateClassSection(raw: string): string | null {
  const text = raw.trim();
  if (!text) return "Enter a section.";
  if (text.length > 30) return "Keep the section under 30 characters.";
  if (!/^(BSIT|BEED|BSBA-FM|BSBA-OM)\s+[1-4]\s*-\s*[A-E]$/i.test(text)) return "Use the format BSIT 3-A (course, year 1-4, section A-E).";
  return null;
}

export function validateClassCode(raw: string): string | null {
  const text = raw.trim();
  if (!text) return "Enter a subject code.";
  if (text.length > 15) return "Keep the code under 15 characters.";
  return null;
}

export function validateAnnouncementTitle(raw: string): string | null {
  const text = raw.trim();
  if (!text) return "Add a title.";
  if (text.length > 100) return "Keep the title under 100 characters.";
  return null;
}

export function validateAnnouncementBody(raw: string): string | null {
  const text = raw.trim();
  if (!text) return "Write something to post.";
  if (text.length > 2000) return "Keep this under 2000 characters.";
  return null;
}

export function validateAssignmentTitle(raw: string): string | null {
  const text = raw.trim();
  if (!text) return "Add a title.";
  if (text.length > 100) return "Keep the title under 100 characters.";
  return null;
}

export function validateAssignmentInstructions(raw: string): string | null {
  const text = raw.trim();
  if (!text) return "Add instructions for students.";
  if (text.length > 4000) return "Keep this under 4000 characters.";
  return null;
}

export function validatePoints(raw: string): string | null {
  const text = raw.trim();
  if (!text) return "Enter the point value.";
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) return "Points must be a positive number.";
  if (value > 1000) return "Keep points at or under 1000.";
  return null;
}

export function validateMaterialTitle(raw: string): string | null {
  const text = raw.trim();
  if (!text) return "Add a title for this material.";
  if (text.length > 100) return "Keep the title under 100 characters.";
  return null;
}

/**
 * What an instructor may upload as lesson material: documents and slides, up to 50 MB.
 * Lecture VIDEOS are links, not uploads. The whitelist itself lives in shared/utils/file.ts.
 */
export const MATERIAL_FILE_POLICY: FilePolicy = {
  kinds: ["pdf", "doc", "slide"],
  maxBytes: 50 * 1024 * 1024,
  rejectMessage: "Allowed files: PDF, Word or PowerPoint. For a video, paste its link instead.",
  mimeTypes: MATERIAL_MIME_TYPES,
};
