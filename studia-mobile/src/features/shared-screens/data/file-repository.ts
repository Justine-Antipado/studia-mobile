// file-repository.ts — opening an uploaded file (material, attachment, submission) for viewing.
// The screens depend on this interface, never on Supabase Storage directly.
import type { Result } from "@/core/data/errors/app-error";
import { getViewableFile, type ViewableFile } from "@/core/data/supabase/file-access";

export type { ViewableFile };

export interface FileRepository {
  /** Metadata plus a short-lived signed URL for the file with this id. */
  get(fileId: string): Promise<Result<ViewableFile>>;
}

export const fileRepository: FileRepository = {
  get: (fileId) => getViewableFile(fileId),
};
