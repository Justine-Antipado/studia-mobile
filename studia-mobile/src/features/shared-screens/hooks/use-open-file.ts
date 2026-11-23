// use-open-file.ts — "show me this file" for any screen of either role (G7).
// The attachment's id IS the `files` row id (core/data/supabase/file-upload.toAttachment), so the
// viewer only needs that. Never use it for a freshly picked file in a form: that one has no row
// yet and only exists on this device.
import { useCallback } from "react";

import type { Role } from "@/core/types/role";
import { useSafeRouter } from "@/shared/hooks/use-safe-router";

export function useOpenFile(role: Role): (fileId: string) => void {
  const router = useSafeRouter();
  return useCallback(
    (fileId: string) => router.push({ pathname: `/${role}/file-viewer`, params: { fileId } }),
    [router, role],
  );
}
