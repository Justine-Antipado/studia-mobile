// use-file-picker.ts — pick a file, validate it against a FilePolicy, and return a ready
// Attachment. The ONE picker hook: the student and instructor versions were identical apart
// from their policy, which is now a parameter.
//
// The picked file stays the caller's draft (UI-BRIEF §11): a failed upload must never lose it.
import * as DocumentPicker from "expo-document-picker";
import { useCallback, useState } from "react";

import { registerPickedFile } from "@/core/data/supabase/file-upload";
import type { Attachment } from "@/core/types/content";
import { newId } from "@/shared/utils/id";
import { toAttachment, validateFile, type FilePolicy } from "@/shared/utils/file";

export type FilePickerState = {
  /** Resolves to null when the user cancels or the file is rejected (see `error`). */
  pick: () => Promise<Attachment | null>;
  error: string | null;
  clearError: () => void;
};

export function useFilePicker(policy: FilePolicy): FilePickerState {
  const [error, setError] = useState<string | null>(null);
  const clearError = useCallback(() => setError(null), []);

  const pick = useCallback(async (): Promise<Attachment | null> => {
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [...policy.mimeTypes],
        copyToCacheDirectory: true,
        multiple: false,
      });
      const asset = result.canceled ? undefined : result.assets?.[0];
      if (!asset) return null;

      // Validated before anything is stored or uploaded: the MIME filter above is only a hint
      // from the OS picker and can be bypassed by renaming.
      const candidate = { name: asset.name, sizeBytes: asset.size ?? 0 };
      const { error: rejection, kind } = validateFile(candidate, policy);
      if (rejection || !kind) {
        setError(rejection ?? "That file could not be used.");
        return null;
      }
      const attachment = toAttachment(candidate, kind, newId("file"));
      registerPickedFile(attachment.id, { uri: asset.uri, mimeType: asset.mimeType ?? "", sizeBytes: candidate.sizeBytes });
      return attachment;
    } catch {
      // Never surface the picker's own message: it can contain a device file path.
      setError("Could not open the file picker. Please try again.");
      return null;
    }
  }, [policy]);

  return { pick, error, clearError };
}
