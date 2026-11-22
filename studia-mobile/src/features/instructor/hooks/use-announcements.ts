// use-announcements.ts — class stream: post, moderate comments, delete.
import { cacheKey } from "@/core/data/cache/cache-keys";
import { TTL } from "@/core/data/cache/query-cache";
import { useMutation } from "@/core/data/repository/use-mutation";
import { useQuery } from "@/core/data/repository/use-query";
import { instructorAnnouncementRepository } from "@/features/instructor/data/announcements-repository";

const listKey = (classId: string) => cacheKey("instructor", "classes", classId, "announcements");
const itemKey = (classId: string, id: string) => cacheKey("instructor", "classes", classId, "announcements", id);

export function useClassAnnouncements(classId: string | null) {
  return useQuery(classId ? listKey(classId) : null, () => instructorAnnouncementRepository.listByClass(classId!), {
    ttlMs: TTL.live,
    enabled: !!classId,
  });
}

export function useAnnouncement(classId: string | null, id: string | null) {
  return useQuery(
    classId && id ? itemKey(classId, id) : null,
    () => instructorAnnouncementRepository.get(classId!, id!),
    { ttlMs: TTL.live, enabled: !!classId && !!id },
  );
}

export function useCreateAnnouncement(classId: string) {
  return useMutation(
    (input: { title: string; body: string; pinned: boolean }) =>
      instructorAnnouncementRepository.create(classId, input),
    { invalidate: () => listKey(classId) },
  );
}

export function useAddComment(classId: string, id: string) {
  return useMutation((text: string) => instructorAnnouncementRepository.addComment(classId, id, text), {
    invalidate: () => [itemKey(classId, id), listKey(classId)],
  });
}

export function useDeleteComment(classId: string, id: string) {
  return useMutation((commentId: string) => instructorAnnouncementRepository.deleteComment(classId, id, commentId), {
    invalidate: () => itemKey(classId, id),
  });
}

export function useDeleteAnnouncement(classId: string) {
  return useMutation((id: string) => instructorAnnouncementRepository.remove(classId, id), {
    invalidate: (id) => [listKey(classId), itemKey(classId, id)],
  });
}
