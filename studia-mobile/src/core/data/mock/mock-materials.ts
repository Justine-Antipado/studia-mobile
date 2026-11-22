// mock-materials.ts — materials/lessons over the shared mock DB, including the mock "AI pipeline".
// What the real server must do (docs/api-contract.md, "Lesson videos"):
//   - a video link is validated again server-side (https, host allowlist, length) and only the
//     YouTube video id is kept; the server never fetches an arbitrary URL (SSRF)
//   - the transcript comes from the video's captions, fetched by the SERVER (a client cannot read
//     them from a URL). No captions -> state "failed" and the instructor can paste a transcript
//   - the summary is cached on the lesson; "Regenerate" is rate-limited because each call costs money
import { dbId, mockDb, type DbMaterial, type DbTranscriptLine } from "@/core/data/mock/mock-db";
import { canAccess, isOwner } from "@/core/data/mock/mock-announcements";
import { classCodeOf, notify, studentIdsOf } from "@/core/data/mock/mock-notifications";
import type { Attachment, VideoLink } from "@/core/types/content";
import { mockNowIso } from "@/core/data/mock/mock-clock";

export const MAX_SUMMARY_REGENS = 3;
const PIPELINE_DELAY_MS = 4000;

export const ownedMaterial = (classId: string, id: string, ownerId: string) =>
  isOwner(classId, ownerId) ? mockDb.materials.find((m) => m.classId === classId && m.id === id) : undefined;

export const visibleMaterial = (classId: string, id: string, userId: string) =>
  canAccess(classId, userId) ? mockDb.materials.find((m) => m.classId === classId && m.id === id) : undefined;

export function materialsOf(classId: string, userId: string): DbMaterial[] {
  if (!canAccess(classId, userId)) return [];
  return mockDb.materials.filter((m) => m.classId === classId).sort((a, b) => b.postedAt.localeCompare(a.postedAt));
}

function patch(id: string, change: Partial<DbMaterial>) {
  mockDb.materials = mockDb.materials.map((m) => (m.id === id ? { ...m, ...change } : m));
  mockDb.emit();
}

/** Turns transcript text into a TL;DR + bullets. `variant` rotates which lines lead, for Regenerate. */
export function summarize(title: string, lines: DbTranscriptLine[], variant: number): { tldr: string; bullets: string[] } {
  const texts = lines.map((l) => l.text);
  const rotated = texts.length ? [...texts.slice(variant % texts.length), ...texts.slice(0, variant % texts.length)] : [];
  return {
    tldr: rotated[0] ? `${title}: ${rotated[0]}` : `Key points of "${title}".`,
    bullets: rotated.slice(0, 4),
  };
}

const mockCaptions = (title: string): DbTranscriptLine[] => [
  { id: dbId("t"), startSec: 0, text: `Welcome. In this lesson we introduce ${title}.` },
  { id: dbId("t"), startSec: 60, text: "First, the core idea and why it matters." },
  { id: dbId("t"), startSec: 140, text: "Next, a worked example to apply the idea." },
  { id: dbId("t"), startSec: 230, text: "Finally, common mistakes and how to avoid them." },
];

function finishProcessing(id: string) {
  setTimeout(() => {
    const m = mockDb.materials.find((x) => x.id === id);
    if (!m || m.processing !== "processing") return;
    if (m.link && m.link.provider !== "youtube") {
      patch(id, { processing: "failed" }); // no captions available for this host
      return;
    }
    const transcript = m.link ? mockCaptions(m.title) : [];
    patch(id, {
      processing: "ready",
      durationLabel: m.link ? "12:40" : m.durationLabel,
      transcript,
      objectives: [`Understand the key points of "${m.title}".`, "Apply the concept in the next assessment."],
      aiSummary: summarize(m.title, transcript, 0),
    });
  }, PIPELINE_DELAY_MS);
}

export function addLink(classId: string, title: string, link: VideoLink): DbMaterial {
  const m: DbMaterial = {
    id: dbId("mat"),
    classId,
    title: title.trim(),
    kind: "video",
    link,
    attachment: null,
    durationLabel: null,
    processing: "processing",
    transcript: [],
    objectives: [],
    aiSummary: null,
    summaryRegens: 0,
    postedAt: mockNowIso(),
  };
  mockDb.materials = [m, ...mockDb.materials];
  mockDb.emit();
  notify(studentIdsOf(classId), { tag: "Lesson", title: "New lesson posted", meta: `${classCodeOf(classId)} · ${m.title}` });
  finishProcessing(m.id);
  return m;
}

export function addUpload(classId: string, title: string, attachment: Attachment): DbMaterial {
  const m: DbMaterial = {
    id: dbId("mat"),
    classId,
    title: title.trim(),
    kind: attachment.kind === "slide" ? "slide" : "pdf",
    link: null,
    attachment,
    durationLabel: null,
    processing: "processing",
    transcript: [],
    objectives: [],
    aiSummary: null,
    summaryRegens: 0,
    postedAt: mockNowIso(),
  };
  mockDb.materials = [m, ...mockDb.materials];
  mockDb.emit();
  notify(studentIdsOf(classId), { tag: "Lesson", title: "New lesson posted", meta: `${classCodeOf(classId)} · ${m.title}` });
  finishProcessing(m.id);
  return m;
}

/** Fallback when no captions exist: the instructor pastes the transcript/notes, the AI summarises it. */
export function provideTranscript(m: DbMaterial, text: string): DbMaterial {
  const lines: DbTranscriptLine[] = text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 200)
    .map((s, i) => ({ id: dbId("t"), startSec: i * 30, text: s }));
  patch(m.id, {
    processing: "ready",
    transcript: lines,
    objectives: [`Understand the key points of "${m.title}".`],
    aiSummary: summarize(m.title, lines, 0),
  });
  return mockDb.materials.find((x) => x.id === m.id)!;
}

export type RegenOutcome = { ok: true; material: DbMaterial } | { ok: false; reason: "limit" | "no_source" };

export function regenerateSummary(m: DbMaterial): RegenOutcome {
  if (m.summaryRegens >= MAX_SUMMARY_REGENS) return { ok: false, reason: "limit" };
  if (m.transcript.length === 0) return { ok: false, reason: "no_source" };
  const regens = m.summaryRegens + 1;
  patch(m.id, { aiSummary: summarize(m.title, m.transcript, regens), summaryRegens: regens });
  return { ok: true, material: mockDb.materials.find((x) => x.id === m.id)! };
}

export function removeMaterial(id: string) {
  mockDb.materials = mockDb.materials.filter((m) => m.id !== id);
  mockDb.emit();
}
