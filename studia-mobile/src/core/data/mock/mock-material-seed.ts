// mock-material-seed.ts — seed rows for the materials table. Covers every lesson state: a YouTube
// video that is ready (transcript + summary), one still processing, a non-YouTube link whose
// transcript could not be fetched ("failed": the instructor can paste one), plus uploaded slides/PDF.
// The YouTube ids are public videos used only as placeholders for thumbnails.
import type { DbMaterial } from "@/core/data/mock/mock-db";

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

const NET_TRANSCRIPT = [
  { id: "t1", startSec: 0, text: "Today we cover network security basics: firewalls, intrusion detection, and the CIA triad." },
  { id: "t2", startSec: 42, text: "Confidentiality means only authorized people can read the data." },
  { id: "t3", startSec: 95, text: "Integrity means the data was not changed without permission." },
  { id: "t4", startSec: 150, text: "Availability means the data and systems are reachable when needed." },
  { id: "t5", startSec: 210, text: "A firewall filters traffic using a set of rules based on IP, port and protocol." },
  { id: "t6", startSec: 275, text: "An IDS watches traffic for suspicious patterns and raises an alert." },
];

export function seedMaterials(): DbMaterial[] {
  return [
    {
      id: "m1",
      classId: "it321",
      title: "Lesson 3: Network Security Basics",
      kind: "video",
      link: { provider: "youtube", videoId: "jNQXAC9IVRw", url: "https://www.youtube.com/watch?v=jNQXAC9IVRw" },
      attachment: null,
      durationLabel: "18:24",
      processing: "ready",
      transcript: NET_TRANSCRIPT,
      objectives: [
        "Explain the CIA triad and why it guides security decisions.",
        "Describe how a firewall filters traffic using rules.",
        "Differentiate an IDS from an IPS.",
      ],
      aiSummary: {
        tldr: "Firewalls and IDS enforce the CIA triad through layered, rule-based defense.",
        bullets: [
          "Confidentiality, integrity, availability (the CIA triad) guide every security decision.",
          "Firewalls filter traffic by IP, port and protocol rules.",
          "An IDS detects suspicious activity and raises alerts.",
          "Defense in depth: layer multiple controls so one failure is not catastrophic.",
        ],
      },
      summaryRegens: 0,
      postedAt: ago(60 * 24 * 2),
    },
    {
      id: "m2",
      classId: "it321",
      title: "Lesson 4: Cryptography Fundamentals",
      kind: "slide",
      link: null,
      attachment: { id: "ia2", name: "Lesson4_Slides.pptx", kind: "slide", sizeLabel: "3.1 MB" },
      durationLabel: null,
      processing: "ready",
      transcript: [],
      objectives: ["Compare symmetric and asymmetric encryption.", "Identify common uses of hashing."],
      aiSummary: {
        tldr: "Symmetric keys are fast but must be shared; asymmetric pairs solve sharing at a cost.",
        bullets: ["Symmetric: one shared key.", "Asymmetric: public/private key pair.", "Hashes verify integrity, they do not encrypt."],
      },
      summaryRegens: 0,
      postedAt: ago(60 * 24),
    },
    {
      id: "m3",
      classId: "it321",
      title: "Lesson 5: Access Control Models",
      kind: "video",
      link: { provider: "youtube", videoId: "jNQXAC9IVRw", url: "https://www.youtube.com/watch?v=jNQXAC9IVRw" },
      attachment: null,
      durationLabel: null,
      processing: "processing",
      transcript: [],
      objectives: [],
      aiSummary: null,
      summaryRegens: 0,
      postedAt: ago(45),
    },
    {
      id: "m4",
      classId: "it321",
      title: "Supplementary: Zero Trust Explained",
      kind: "video",
      link: { provider: "other", videoId: null, url: "https://vimeo.com/76979871" },
      attachment: null,
      durationLabel: null,
      processing: "failed",
      transcript: [],
      objectives: [],
      aiSummary: null,
      summaryRegens: 0,
      postedAt: ago(30),
    },
    {
      id: "m5",
      classId: "it314",
      title: "Lesson 6: REST APIs",
      kind: "slide",
      link: null,
      attachment: { id: "ia3", name: "REST_APIs.pptx", kind: "slide", sizeLabel: "1.8 MB" },
      durationLabel: null,
      processing: "ready",
      transcript: [],
      objectives: ["Name resources using nouns.", "Map CRUD actions to HTTP verbs and status codes."],
      aiSummary: {
        tldr: "REST APIs expose resources over HTTP using nouns, verbs and status codes.",
        bullets: [
          "Resources are named with nouns (e.g. /students), actions use HTTP verbs.",
          "Status codes communicate outcome: 2xx success, 4xx client error, 5xx server error.",
          "Statelessness: each request carries everything the server needs to handle it.",
        ],
      },
      summaryRegens: 0,
      postedAt: ago(90),
    },
    {
      id: "m6",
      classId: "it318",
      title: "Lesson 1: Intro to Expo and React Native",
      kind: "pdf",
      link: null,
      attachment: { id: "ia4", name: "Intro_Expo.pdf", kind: "pdf", sizeLabel: "1.2 MB" },
      durationLabel: null,
      processing: "ready",
      transcript: [],
      objectives: ["Create and run an Expo project."],
      aiSummary: null,
      summaryRegens: 0,
      postedAt: ago(60 * 48),
    },
  ];
}
