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

// Mirrors studia-admin's core/logic/validation.js COURSES/YEARS/SECTIONS + composeSection, so a
// class section always matches the format the admin dashboard and backend expect.
export const CLASS_PROGRAMS = ["BSIT", "BEED", "BSBA-FM", "BSBA-OM"] as const;
export const CLASS_YEARS = ["1", "2", "3", "4"] as const;
export const CLASS_SECTIONS = ["A", "B", "C", "D", "E"] as const;

export function composeClassSection(program: string, year: string, section: string): string {
  return `${program} ${year}-${section}`;
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
