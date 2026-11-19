// file.ts — upload validation shared by both roles. One whitelist implementation; each side
// passes its own policy (instructors may upload 500 MB videos, students 50 MB submissions).
//
// SECURITY: this is the client-side gate only. The backend must re-check the extension, the
// real MIME type (sniff the bytes, do not trust the header), the size and the owner of the
// class before it stores anything, and must store the file under an id it generates itself
// rather than under any name that came from a device.
import type { Attachment, AttachmentKind } from "@/core/types/content";

/** Extension -> kind. Anything not listed is rejected; there is no "allow unknown" path. */
export const ATTACHMENT_EXTENSIONS: Readonly<Record<string, AttachmentKind>> = {
  pdf: "pdf",
  doc: "doc",
  docx: "doc",
  ppt: "slide",
  pptx: "slide",
  mp4: "video",
  mov: "video",
  jpg: "image",
  jpeg: "image",
  png: "image",
};

/** MIME types handed to the picker so the OS browser only offers allowed files. */
export const ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "video/mp4",
  "video/quicktime",
] as const;

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png"] as const;

export type FilePolicy = {
  /** Which kinds this form accepts (a subset of ATTACHMENT_EXTENSIONS' values). */
  kinds: readonly AttachmentKind[];
  maxBytes: number;
  /** Shown when the extension is not allowed; name the formats the user may pick. */
  rejectMessage: string;
  /** MIME filter for the document picker. */
  mimeTypes: readonly string[];
};

export type FileCandidate = { name: string; sizeBytes: number };

export type FileCheck = { error: string | null; kind: AttachmentKind | null };

const MAX_NAME_LENGTH = 120;

/**
 * Makes a device-supplied file name safe to display and to use as a cache file name:
 * drops directory separators, rejects traversal segments, strips anything outside
 * [A-Za-z0-9 ._-], and never returns an empty name or one that starts with a dot.
 */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/[^A-Za-z0-9 ._-]/g, "_")
    // ".." (and "..."), whole or at the start, is a traversal segment, not a name.
    .replace(/^\.+/, "")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  return cleaned || "file";
}

/** Lower-cased final extension, "" when there is none. Only the last one is ever trusted. */
export function fileExtension(name: string): string {
  const parts = sanitizeFileName(name).split(".");
  return parts.length > 1 ? (parts.pop() ?? "").toLowerCase() : "";
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateFile(file: FileCandidate, policy: FilePolicy): FileCheck {
  const kind = ATTACHMENT_EXTENSIONS[fileExtension(file.name)] ?? null;
  if (!kind || !policy.kinds.includes(kind)) return { error: policy.rejectMessage, kind: null };
  if (!Number.isFinite(file.sizeBytes) || file.sizeBytes <= 0) {
    return { error: "That file looks empty.", kind: null };
  }
  if (file.sizeBytes > policy.maxBytes) {
    return { error: `File is larger than ${formatFileSize(policy.maxBytes)}.`, kind: null };
  }
  return { error: null, kind };
}

/** Builds the stored Attachment from a validated pick. Name is always the sanitized one. */
export function toAttachment(
  file: FileCandidate,
  kind: AttachmentKind,
  id: string,
): Attachment {
  return { id, name: sanitizeFileName(file.name), kind, sizeLabel: formatFileSize(file.sizeBytes) };
}
