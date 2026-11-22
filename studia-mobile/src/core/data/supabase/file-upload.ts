// file-upload.ts: bridges a picked Attachment to a Supabase Storage object + a `files` row.
// The picker only returns display metadata (Attachment), so it registers the real device URI here
// under the attachment id; the repository calls `uploadPicked()` when the form is saved.
import { appError } from "@/core/data/errors/app-error";
import { db, must, myId } from "@/core/data/supabase/remote";
import type { Attachment, AttachmentKind } from "@/core/types/content";
import { fileExtension, formatFileSize } from "@/shared/utils/file";

type Picked = { uri: string; mimeType: string; sizeBytes: number };
const picked = new Map<string, Picked>();

export function registerPickedFile(attachmentId: string, file: Picked): void {
  picked.set(attachmentId, file);
}

export type StoredFile = {
  id: string;
  original_name: string;
  kind: AttachmentKind;
  size_bytes: number;
};

export const toAttachment = (f: StoredFile): Attachment => ({
  id: f.id,
  name: f.original_name,
  kind: f.kind,
  sizeLabel: formatFileSize(f.size_bytes),
});

const MIME_FALLBACK: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  mp4: "video/mp4",
  mov: "video/quicktime",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

/** True when the attachment is already a stored file row (not a fresh pick). */
export const isPicked = (a: Attachment) => picked.has(a.id);

/** Uploads the picked bytes and creates the `files` row; returns the new file id. */
export async function uploadPicked(a: Attachment, bucket: "materials" | "submissions"): Promise<string> {
  const file = picked.get(a.id);
  if (!file) throw appError("validation", "Pick the file again. It is no longer available on this device.", false);
  const me = await myId();
  const ext = fileExtension(a.name);
  const objectPath = `${me}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const mime = file.mimeType || MIME_FALLBACK[ext] || "application/octet-stream";

  let bytes: ArrayBuffer;
  try {
    bytes = await (await fetch(file.uri)).arrayBuffer();
  } catch {
    throw appError("validation", "Could not read that file. Pick it again.", false);
  }
  const up = await db().storage.from(bucket).upload(objectPath, bytes, { contentType: mime, upsert: false });
  if (up.error) throw up.error;

  const row = must(
    await db()
      .from("files")
      .insert({
        original_name: a.name,
        bucket,
        object_path: objectPath,
        kind: a.kind,
        extension: ext,
        mime_type: mime,
        size_bytes: bytes.byteLength,
        uploaded_by: me,
      })
      .select("id")
      .single(),
  ) as { id: string };
  picked.delete(a.id);
  return row.id;
}
