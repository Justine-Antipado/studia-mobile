// lessons-repository.ts — lesson/material list + transcript + AI summary (mock AI core output).
import type { Result } from "@/core/data/errors/app-error";
import { mockCall } from "@/core/data/mock/mock-latency";
import type { Lesson } from "@/features/student/types/student";

export interface LessonRepository {
  listByClass(classId: string): Promise<Result<Lesson[]>>;
  get(classId: string, id: string): Promise<Result<Lesson | null>>;
}

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

const IT321_TRANSCRIPT = [
  { id: "t1", startSec: 0, text: "Today we cover network security basics: firewalls, intrusion detection, and the CIA triad." },
  { id: "t2", startSec: 42, text: "Confidentiality means only authorized people can read the data." },
  { id: "t3", startSec: 95, text: "Integrity means the data was not changed without permission." },
  { id: "t4", startSec: 150, text: "Availability means the data and systems are reachable when needed." },
  { id: "t5", startSec: 210, text: "A firewall filters traffic using a set of rules based on IP, port and protocol." },
  { id: "t6", startSec: 275, text: "An IDS watches traffic for suspicious patterns and raises an alert." },
];

const LESSONS: Lesson[] = [
  {
    id: "l1",
    classId: "it321",
    title: "Lesson 3: Network Security Basics",
    kind: "video",
    durationLabel: "18:24",
    attachment: { id: "a1", name: "Lesson3_Slides.pdf", kind: "pdf", sizeLabel: "2.4 MB" },
    processing: "ready",
    transcript: IT321_TRANSCRIPT,
    aiSummary: {
      tldr: "Firewalls and IDS enforce the CIA triad through layered, rule-based defense.",
      bullets: [
        "Confidentiality, integrity, availability (the CIA triad) guide every security decision.",
        "Firewalls filter traffic by IP, port and protocol rules.",
        "An IDS detects suspicious activity and raises alerts.",
        "Defense in depth: layer multiple controls so one failure is not catastrophic.",
      ],
    },
    postedAt: ago(60 * 24 * 2),
  },
  {
    id: "l2",
    classId: "it321",
    title: "Lesson 4: Cryptography Fundamentals",
    kind: "video",
    durationLabel: "22:10",
    attachment: { id: "a2", name: "Lesson4_Slides.pdf", kind: "pdf", sizeLabel: "3.1 MB" },
    processing: "processing",
    transcript: [],
    aiSummary: null,
    postedAt: ago(45),
  },
  {
    id: "l3",
    classId: "it314",
    title: "Lesson 6: REST APIs",
    kind: "slide",
    durationLabel: null,
    attachment: { id: "a3", name: "REST_APIs.pptx", kind: "slide", sizeLabel: "1.8 MB" },
    processing: "ready",
    transcript: [],
    aiSummary: {
      tldr: "REST APIs expose resources over HTTP using nouns, verbs and status codes.",
      bullets: [
        "Resources are named with nouns (e.g. /students), actions use HTTP verbs.",
        "Status codes communicate outcome: 2xx success, 4xx client error, 5xx server error.",
        "Statelessness: each request carries everything the server needs to handle it.",
      ],
    },
    postedAt: ago(90),
  },
  {
    id: "l4",
    classId: "it318",
    title: "Lesson 1: Intro to Expo and React Native",
    kind: "pdf",
    durationLabel: null,
    attachment: { id: "a4", name: "Intro_Expo.pdf", kind: "pdf", sizeLabel: "1.2 MB" },
    processing: "ready",
    transcript: [],
    aiSummary: null,
    postedAt: ago(60 * 48),
  },
];

class MockLessonRepository implements LessonRepository {
  listByClass(classId: string): Promise<Result<Lesson[]>> {
    return mockCall(() => LESSONS.filter((l) => l.classId === classId).sort((a, b) => b.postedAt.localeCompare(a.postedAt)));
  }

  get(classId: string, id: string): Promise<Result<Lesson | null>> {
    return mockCall(() => LESSONS.find((l) => l.classId === classId && l.id === id) ?? null);
  }
}

export const lessonRepository: LessonRepository = new MockLessonRepository();
