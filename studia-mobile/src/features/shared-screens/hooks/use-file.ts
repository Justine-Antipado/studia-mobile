// use-file.ts — the signed URL of one uploaded file.
// Cached for less than the signature's own lifetime, so a cached URL is never a dead one.
import { cacheKey } from "@/core/data/cache/cache-keys";
import { useQuery } from "@/core/data/repository/use-query";
import { fileRepository } from "@/features/shared-screens/data/file-repository";

/** Signed URLs live 30 min on the server; re-sign after 10 so an open document cannot expire. */
const URL_TTL_MS = 10 * 60_000;

export function useFile(fileId: string | null) {
  return useQuery(fileId ? cacheKey("file", fileId) : null, () => fileRepository.get(fileId!), {
    ttlMs: URL_TTL_MS,
    enabled: !!fileId,
  });
}
