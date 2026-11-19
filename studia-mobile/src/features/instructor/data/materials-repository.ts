// materials-repository.ts — lesson/material repository + a mock "AI transcript + key
// objectives" pipeline (docs/UI-BRIEF Lesson & Material Repository / AI core).
import type { Result } from "@/core/data/errors/app-error";
import { appError, fail, ok } from "@/core/data/errors/app-error";
import { mockCall } from "@/core/data/mock/mock-latency";
import { newId } from "@/features/instructor/logic/format";
import type { Attachment, Material } from "@/features/instructor/types/instructor";

export interface MaterialRepository {
  listByClass(classId: string): Promise<Result<Material[]>>;
  get(classId: string, id: string): Promise<Result<Material | null>>;
  upload(classId: string, input: { title: string; attachment: Attachment }): Promise<Result<Material>>;
  remove(classId: string, id: string): Promise<Result<void>>;
}

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const KIND_BY_ATTACHMENT: Record<Attachment["kind"], Material["kind"]> = {
  video: "video",
  pdf: "pdf",
  slide: "slide",
  doc: "pdf",
  image: "pdf",
};

let MATERIALS: Material[] = [
  {
    id: "im1",
    classId: "it321",
    title: "Lesson 3: Network Security Basics",
    kind: "video",
    durationLabel: "18:24",
    attachment: { id: "ia1", name: "Lesson3.mp4", kind: "video", sizeLabel: "214 MB" },
    processing: "ready",
    transcript: [
      { id: "t1", startSec: 0, text: "Today we cover network security basics: firewalls, intrusion detection, and the CIA triad." },
      { id: "t2", startSec: 42, text: "Confidentiality means only authorized people can read the data." },
      { id: "t3", startSec: 95, text: "Integrity means the data was not changed without permission." },
    ],
    objectives: [
      "Explain the CIA triad and why it guides security decisions.",
      "Describe how a firewall filters traffic using rules.",
      "Differentiate an IDS from an IPS.",
    ],
    postedAt: ago(60 * 24 * 2),
  },
  {
    id: "im2",
    classId: "it321",
    title: "Lesson 4: Cryptography Fundamentals",
    kind: "slide",
    durationLabel: null,
    attachment: { id: "ia2", name: "Lesson4_Slides.pptx", kind: "slide", sizeLabel: "3.1 MB" },
    processing: "ready",
    transcript: [],
    objectives: ["Compare symmetric and asymmetric encryption.", "Identify common uses of hashing."],
    postedAt: ago(45),
  },
  {
    id: "im3",
    classId: "it314",
    title: "Lesson 6: REST APIs",
    kind: "slide",
    durationLabel: null,
    attachment: { id: "ia3", name: "REST_APIs.pptx", kind: "slide", sizeLabel: "1.8 MB" },
    processing: "ready",
    transcript: [],
    objectives: ["Name resources using nouns.", "Map CRUD actions to HTTP verbs and status codes."],
    postedAt: ago(90),
  },
];

class MockMaterialRepository implements MaterialRepository {
  listByClass(classId: string): Promise<Result<Material[]>> {
    return mockCall(() => MATERIALS.filter((m) => m.classId === classId).sort((a, b) => b.postedAt.localeCompare(a.postedAt)));
  }

  get(classId: string, id: string): Promise<Result<Material | null>> {
    return mockCall(() => MATERIALS.find((m) => m.classId === classId && m.id === id) ?? null);
  }

  async upload(classId: string, input: { title: string; attachment: Attachment }): Promise<Result<Material>> {
    await new Promise((resolve) => setTimeout(resolve, 700));
    const material: Material = {
      id: newId("mat"),
      classId,
      title: input.title.trim(),
      kind: KIND_BY_ATTACHMENT[input.attachment.kind],
      durationLabel: input.attachment.kind === "video" ? "--:--" : null,
      attachment: input.attachment,
      processing: "processing",
      transcript: [],
      objectives: [],
      postedAt: new Date().toISOString(),
    };
    MATERIALS = [material, ...MATERIALS];

    // Mock AI pipeline: transcript + key objectives land a few seconds later.
    setTimeout(() => {
      MATERIALS = MATERIALS.map((m) =>
        m.id === material.id
          ? {
              ...m,
              processing: "ready",
              durationLabel: m.kind === "video" ? "12:40" : m.durationLabel,
              transcript:
                m.kind === "video"
                  ? [{ id: newId("t"), startSec: 0, text: `Auto-generated transcript for "${m.title}".` }]
                  : [],
              objectives: [`Understand the key points of "${m.title}".`, "Apply the concept in the next assessment."],
            }
          : m,
      );
    }, 4000);

    return ok(material);
  }

  async remove(classId: string, id: string): Promise<Result<void>> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (!MATERIALS.some((m) => m.classId === classId && m.id === id)) {
      return fail(appError("not_found", "This material no longer exists."));
    }
    MATERIALS = MATERIALS.filter((m) => m.id !== id);
    return ok(undefined);
  }
}

export const materialRepository: MaterialRepository = new MockMaterialRepository();
