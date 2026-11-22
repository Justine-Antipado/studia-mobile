// use-materials.ts — lesson/material repository + upload.
import { cacheKey } from "@/core/data/cache/cache-keys";
import { TTL } from "@/core/data/cache/query-cache";
import { useMutation } from "@/core/data/repository/use-mutation";
import { useQuery } from "@/core/data/repository/use-query";
import { materialRepository } from "@/features/instructor/data/materials-repository";
import type { Attachment } from "@/features/instructor/types/instructor";

const listKey = (classId: string) => cacheKey("instructor", "classes", classId, "materials");
const itemKey = (classId: string, id: string) => cacheKey("instructor", "classes", classId, "materials", id);

export function useClassMaterials(classId: string | null) {
  return useQuery(classId ? listKey(classId) : null, () => materialRepository.listByClass(classId!), {
    ttlMs: TTL.live,
    enabled: !!classId,
  });
}

export function useMaterial(classId: string | null, id: string | null) {
  return useQuery(classId && id ? itemKey(classId, id) : null, () => materialRepository.get(classId!, id!), {
    ttlMs: TTL.live,
    enabled: !!classId && !!id,
  });
}

export function useUploadMaterial(classId: string) {
  return useMutation(
    (input: { title: string; attachment: Attachment }) => materialRepository.upload(classId, input),
    { invalidate: () => listKey(classId) },
  );
}

export function useAddVideoLink(classId: string) {
  return useMutation(
    (input: { title: string; url: string }) => materialRepository.addVideoLink(classId, input),
    { invalidate: () => listKey(classId) },
  );
}

export function useProvideTranscript(classId: string, id: string) {
  return useMutation((text: string) => materialRepository.provideTranscript(classId, id, text), {
    invalidate: () => [listKey(classId), itemKey(classId, id)],
  });
}

export function useDeleteMaterial(classId: string) {
  return useMutation((id: string) => materialRepository.remove(classId, id), {
    invalidate: (id) => [listKey(classId), itemKey(classId, id)],
  });
}
