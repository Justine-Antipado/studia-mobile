// materials-remote.ts: instructor lessons in Supabase. Documents/slides are uploaded to the private
// "materials" bucket (+ a `files` row); videos are LINKS only. There is no AI worker yet, so a new
// material is readable straight away; a pasted transcript is stored by set_material_transcript.
import { appError, fail, ok, type Result } from "@/core/data/errors/app-error";
import { toAttachment, uploadPicked, type StoredFile } from "@/core/data/supabase/file-upload";
import { db, guard, must, myId } from "@/core/data/supabase/remote";
import { durationLabel } from "@/features/student/data/lessons-remote";
import type { MaterialRepository } from "@/features/instructor/data/materials-repository";
import type { Attachment, Material } from "@/features/instructor/types/instructor";
import { parseVideoLink } from "@/shared/utils/video-link";

const SELECT =
  "id, class_id, title, kind, duration_sec, processing, posted_at, video_url, video_provider, video_id, file:files(id, original_name, kind, size_bytes), transcript:material_transcript_lines(id, start_sec, body), objectives:material_objectives(position, body)";

type Row = {
  id: string;
  class_id: string;
  title: string;
  kind: Material["kind"];
  duration_sec: number | null;
  processing: Material["processing"];
  posted_at: string;
  video_url: string | null;
  video_provider: "youtube" | "other" | null;
  video_id: string | null;
  file: StoredFile | null;
  transcript: { id: string; start_sec: number; body: string }[];
  objectives: { position: number; body: string }[];
};

const toMaterial = (r: Row): Material => ({
  id: r.id,
  classId: r.class_id,
  title: r.title,
  kind: r.kind,
  link: r.video_url && r.video_provider ? { provider: r.video_provider, url: r.video_url, videoId: r.video_id } : null,
  durationLabel: durationLabel(r.duration_sec),
  attachment: r.file ? toAttachment(r.file) : null,
  processing: r.processing,
  transcript: [...r.transcript].sort((a, b) => a.start_sec - b.start_sec).map((t) => ({ id: t.id, startSec: t.start_sec, text: t.body })),
  objectives: [...r.objectives].sort((a, b) => a.position - b.position).map((o) => o.body),
  postedAt: r.posted_at,
});

async function fetchOne(classId: string, id: string): Promise<Material | null> {
  const row = must(await db().from("materials").select(SELECT).eq("id", id).eq("class_id", classId).is("deleted_at", null).maybeSingle()) as Row | null;
  return row ? toMaterial(row) : null;
}

export class RemoteMaterialRepository implements MaterialRepository {
  listByClass(classId: string): Promise<Result<Material[]>> {
    return guard(async () => {
      const rows = must(await db().from("materials").select(SELECT).eq("class_id", classId).is("deleted_at", null).order("posted_at", { ascending: false })) as Row[];
      return rows.map(toMaterial);
    });
  }

  get(classId: string, id: string): Promise<Result<Material | null>> {
    return guard(() => fetchOne(classId, id));
  }

  async upload(classId: string, input: { title: string; attachment: Attachment }): Promise<Result<Material>> {
    if (input.attachment.kind === "video") {
      return fail(appError("validation", "Videos are shared as links, not uploads. Paste the video link instead.", false));
    }
    return guard(async () => {
      const me = await myId();
      const fileId = await uploadPicked(input.attachment, "materials");
      const row = must(
        await db()
          .from("materials")
          .insert({ class_id: classId, title: input.title.trim(), kind: input.attachment.kind === "slide" ? "slide" : "pdf", file_id: fileId, owner_id: me })
          .select("id")
          .single(),
      ) as { id: string };
      const made = await fetchOne(classId, row.id);
      if (!made) throw appError("not_found", "This class no longer exists.");
      return made;
    }, "This class no longer exists.");
  }

  async addVideoLink(classId: string, input: { title: string; url: string }): Promise<Result<Material>> {
    const parsed = parseVideoLink(input.url);
    if (!parsed.ok) return fail(appError("validation", parsed.error, false));
    return guard(async () => {
      const me = await myId();
      const row = must(
        await db()
          .from("materials")
          .insert({
            class_id: classId,
            title: input.title.trim(),
            kind: "video",
            owner_id: me,
            video_url: parsed.link.url,
            video_provider: parsed.link.provider,
            video_id: parsed.link.videoId,
          })
          .select("id")
          .single(),
      ) as { id: string };
      const made = await fetchOne(classId, row.id);
      if (!made) throw appError("not_found", "This class no longer exists.");
      return made;
    }, "This class no longer exists.");
  }

  async provideTranscript(classId: string, id: string, text: string): Promise<Result<Material>> {
    if (text.trim().length < 20) return fail(appError("validation", "Paste at least a few sentences of the transcript.", false));
    if (text.length > 50_000) return fail(appError("validation", "Keep the transcript under 50,000 characters.", false));
    return guard(async () => {
      must(await db().rpc("set_material_transcript", { p_material_id: id, p_text: text }));
      const next = await fetchOne(classId, id);
      if (!next) throw appError("not_found", "This material no longer exists.");
      return next;
    }, "This material no longer exists.");
  }

  async remove(classId: string, id: string): Promise<Result<void>> {
    const res = await guard(async () => {
      const rows = must(await db().from("materials").delete().eq("id", id).eq("class_id", classId).select("id")) as unknown[];
      if (rows.length === 0) throw appError("not_found", "This material no longer exists.");
    }, "This material no longer exists.");
    return res.ok ? ok(undefined) : res;
  }
}
