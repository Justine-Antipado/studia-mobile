// materials-repository.ts — instructor view over the shared mock DB materials. A material is either
// an uploaded document/slide deck (<= 50 MB) or a video LINK. After saving, the mock AI pipeline
// fetches the transcript and key objectives a few seconds later (see core/data/mock/mock-materials.ts
// for what the real server must do).
import type { Result } from "@/core/data/errors/app-error";
import { appError, fail, ok } from "@/core/data/errors/app-error";
import { ME, type DbMaterial } from "@/core/data/mock/mock-db";
import { mockCall } from "@/core/data/mock/mock-latency";
import {
  addLink,
  addUpload,
  materialsOf,
  ownedMaterial,
  provideTranscript,
  removeMaterial,
} from "@/core/data/mock/mock-materials";
import { isOwner } from "@/core/data/mock/mock-announcements";
import { parseVideoLink } from "@/shared/utils/video-link";
import type { Attachment, Material } from "@/features/instructor/types/instructor";

export interface MaterialRepository {
  listByClass(classId: string): Promise<Result<Material[]>>;
  get(classId: string, id: string): Promise<Result<Material | null>>;
  upload(classId: string, input: { title: string; attachment: Attachment }): Promise<Result<Material>>;
  addVideoLink(classId: string, input: { title: string; url: string }): Promise<Result<Material>>;
  /** Fallback when the video has no captions: paste the transcript/notes and the AI summarises them. */
  provideTranscript(classId: string, id: string, text: string): Promise<Result<Material>>;
  remove(classId: string, id: string): Promise<Result<void>>;
}

const toMaterial = (m: DbMaterial): Material => ({
  id: m.id,
  classId: m.classId,
  title: m.title,
  kind: m.kind,
  link: m.link,
  durationLabel: m.durationLabel,
  attachment: m.attachment,
  processing: m.processing,
  transcript: m.transcript,
  objectives: m.objectives,
  postedAt: m.postedAt,
});

const notFound = () => fail(appError("not_found", "This class no longer exists."));

class MockMaterialRepository implements MaterialRepository {
  listByClass(classId: string): Promise<Result<Material[]>> {
    return mockCall(() => (isOwner(classId, ME.instructor) ? materialsOf(classId, ME.instructor).map(toMaterial) : []));
  }

  get(classId: string, id: string): Promise<Result<Material | null>> {
    return mockCall(() => {
      const m = ownedMaterial(classId, id, ME.instructor);
      return m ? toMaterial(m) : null;
    });
  }

  async upload(classId: string, input: { title: string; attachment: Attachment }): Promise<Result<Material>> {
    await new Promise((resolve) => setTimeout(resolve, 700));
    if (!isOwner(classId, ME.instructor)) return notFound();
    if (input.attachment.kind === "video") {
      return fail(appError("validation", "Videos are shared as links, not uploads. Paste the video link instead.", false));
    }
    return ok(toMaterial(addUpload(classId, input.title, input.attachment)));
  }

  async addVideoLink(classId: string, input: { title: string; url: string }): Promise<Result<Material>> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (!isOwner(classId, ME.instructor)) return notFound();
    const parsed = parseVideoLink(input.url);
    if (!parsed.ok) return fail(appError("validation", parsed.error, false));
    return ok(toMaterial(addLink(classId, input.title, parsed.link)));
  }

  async provideTranscript(classId: string, id: string, text: string): Promise<Result<Material>> {
    await new Promise((resolve) => setTimeout(resolve, 600));
    const m = ownedMaterial(classId, id, ME.instructor);
    if (!m) return fail(appError("not_found", "This material no longer exists."));
    if (text.trim().length < 20) return fail(appError("validation", "Paste at least a few sentences of the transcript.", false));
    if (text.length > 50_000) return fail(appError("validation", "Keep the transcript under 50,000 characters.", false));
    return ok(toMaterial(provideTranscript(m, text)));
  }

  async remove(classId: string, id: string): Promise<Result<void>> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (!ownedMaterial(classId, id, ME.instructor)) return fail(appError("not_found", "This material no longer exists."));
    removeMaterial(id);
    return ok(undefined);
  }
}

export const materialRepository: MaterialRepository = new MockMaterialRepository();
