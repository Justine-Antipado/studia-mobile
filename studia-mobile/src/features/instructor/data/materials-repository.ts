// materials-repository.ts — instructor materials. A material is either an uploaded document/slide
// deck (<= 50 MB) or a video LINK.
import type { Result } from "@/core/data/errors/app-error";
import { RemoteMaterialRepository } from "@/features/instructor/data/materials-remote";
import type { Attachment, Material } from "@/features/instructor/types/instructor";

export interface MaterialRepository {
  listByClass(classId: string): Promise<Result<Material[]>>;
  get(classId: string, id: string): Promise<Result<Material | null>>;
  upload(classId: string, input: { title: string; attachment: Attachment }): Promise<Result<Material>>;
  addVideoLink(classId: string, input: { title: string; url: string }): Promise<Result<Material>>;
  /** Fallback when the video has no captions: paste the transcript/notes. */
  provideTranscript(classId: string, id: string, text: string): Promise<Result<Material>>;
  remove(classId: string, id: string): Promise<Result<void>>;
}

export const materialRepository: MaterialRepository = new RemoteMaterialRepository();
