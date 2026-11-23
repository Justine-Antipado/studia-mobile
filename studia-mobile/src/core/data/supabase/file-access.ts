// file-access.ts — turns a `files` row id into a short-lived signed URL the app can display.
//
// The buckets are private: nothing is readable without a signed URL, and the signature is minted
// only when RLS lets this user read both the row (files_select_shared -> private.can_read_file)
// and the object (storage policy "studia_read_shared"). So a student can open a material of a
// class they joined and their own submission, and nothing else.
import { appError, type Result } from "@/core/data/errors/app-error";
import { db, guard, must } from "@/core/data/supabase/remote";
import type { AttachmentKind } from "@/core/types/content";

/** Long enough to read a document, short enough that a leaked link dies quickly. */
const URL_TTL_SEC = 60 * 30;

export type ViewableFile = {
  id: string;
  name: string;
  kind: AttachmentKind;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  url: string;
};

type Row = {
  id: string;
  original_name: string;
  kind: AttachmentKind;
  mime_type: string;
  extension: string;
  size_bytes: number;
  bucket: string;
  object_path: string;
};

export function getViewableFile(fileId: string): Promise<Result<ViewableFile>> {
  return guard(async () => {
    const row = must(
      await db()
        .from("files")
        .select("id, original_name, kind, mime_type, extension, size_bytes, bucket, object_path")
        .eq("id", fileId)
        .maybeSingle(),
    ) as Row | null;
    if (!row) throw appError("not_found", "This file is no longer available.");

    const signed = await db().storage.from(row.bucket).createSignedUrl(row.object_path, URL_TTL_SEC);
    if (signed.error || !signed.data?.signedUrl) {
      throw appError("not_found", "This file could not be opened. Ask your instructor to upload it again.");
    }

    return {
      id: row.id,
      name: row.original_name,
      kind: row.kind,
      mimeType: row.mime_type,
      extension: row.extension,
      sizeBytes: row.size_bytes,
      url: signed.data.signedUrl,
    };
  });
}
