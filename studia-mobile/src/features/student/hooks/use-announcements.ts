// use-announcements.ts — class stream + comments.
import { cacheKey } from "@/core/data/cache/cache-keys";
import { TTL } from "@/core/data/cache/query-cache";
import { useMutation } from "@/core/data/repository/use-mutation";
import { useQuery } from "@/core/data/repository/use-query";
import { announcementRepository } from "@/features/student/data/announcements-repository";

export function useAnnouncements(classId: string | null) {
  return useQuery(
    classId ? cacheKey("announcements", classId) : null,
    () => announcementRepository.listByClass(classId!),
    { ttlMs: TTL.live, enabled: !!classId },
  );
}

export function useAnnouncement(classId: string | null, id: string | null) {
  return useQuery(
    classId && id ? cacheKey("announcement", classId, id) : null,
    () => announcementRepository.get(classId!, id!),
    { ttlMs: TTL.live, enabled: !!classId && !!id },
  );
}

export function useAddComment(classId: string, announcementId: string) {
  return useMutation((text: string) => announcementRepository.addComment(classId, announcementId, text), {
    invalidate: () => [cacheKey("announcement", classId, announcementId), cacheKey("announcements", classId)],
  });
}

export function useDeleteComment(classId: string, announcementId: string) {
  return useMutation(
    (commentId: string) => announcementRepository.deleteComment(classId, announcementId, commentId),
    {
      invalidate: () => [cacheKey("announcement", classId, announcementId), cacheKey("announcements", classId)],
    },
  );
}
