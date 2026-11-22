// mock-quiz-seed.ts — seed rows for the quizzes + attempts tables of the shared mock DB.
// Covers every state worth testing: not taken, taken + auto-graded, taken with an essay waiting
// for the instructor, graded, and a draft the students must never see.
import type { DbAttempt, DbQuestion, DbQuiz } from "@/core/data/mock/mock-db";

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
const JUAN = "u_juan";

const mc = (
  id: string, prompt: string, options: string[], correctIndex: number, points: number, rationale: string,
  bloom: DbQuestion["bloom"] = "Remember", difficulty: DbQuestion["difficulty"] = "Easy",
): DbQuestion => ({
  id, type: "multiple_choice", prompt, options, correctIndex, correctAnswer: null, bloom, difficulty, points, rationale,
});

export function seedQuizzes(): DbQuiz[] {
  return [
    {
      id: "qz1",
      classId: "it321",
      title: "Quiz 2: Network Security",
      status: "published",
      source: "manual",
      timeLimitMin: 15,
      dueAt: hoursFromNow(28),
      closesAt: null,
      allowLate: false,
      createdAt: hoursFromNow(-72),
      questions: [
        mc("q1", "Which part of the CIA triad ensures data is reachable when needed?",
          ["Confidentiality", "Integrity", "Availability", "Authentication"], 2, 2,
          "Availability specifically covers systems/data being reachable to authorized users."),
        mc("q2", "A device that filters traffic using IP, port and protocol rules is a:",
          ["IDS", "Firewall", "Proxy cache", "Load balancer"], 1, 2,
          "Firewalls apply rule sets to allow or block traffic by IP/port/protocol.", "Understand"),
        {
          id: "q3", type: "identification",
          prompt: "What do you call a system that monitors traffic and raises alerts on suspicious activity?",
          options: null, correctIndex: null, correctAnswer: "IDS", bloom: "Apply", difficulty: "Medium", points: 3,
          rationale: "An Intrusion Detection System (IDS) monitors and alerts; it does not block traffic.",
        },
        {
          id: "q4", type: "essay",
          prompt: "Explain why defense in depth is recommended over relying on a single control.",
          options: null, correctIndex: null, correctAnswer: null, bloom: "Evaluate", difficulty: "Hard", points: 5,
          rationale: "Model answer: no single control is perfect, so layered controls reduce the chance of total compromise.",
        },
      ],
    },
    {
      id: "qz2",
      classId: "it321",
      title: "Quiz 1: CIA Triad",
      status: "published",
      source: "manual",
      timeLimitMin: 10,
      dueAt: hoursFromNow(-200),
      closesAt: null,
      allowLate: false,
      createdAt: hoursFromNow(-336),
      questions: [
        mc("q5", "\"Only authorized people can read this file\" describes:",
          ["Confidentiality", "Integrity", "Availability", "Non-repudiation"], 0, 2,
          "Confidentiality restricts access to authorized parties only."),
        mc("q6", "A checksum mismatch after download suggests a problem with:",
          ["Confidentiality", "Integrity", "Availability", "Authorization"], 1, 2,
          "A changed checksum means the data was altered, which is an integrity failure.", "Apply", "Medium"),
      ],
    },
    {
      id: "qz3",
      classId: "it314",
      title: "Quiz 1: REST APIs",
      status: "published",
      source: "manual",
      timeLimitMin: 12,
      dueAt: hoursFromNow(60),
      closesAt: hoursFromNow(132),
      allowLate: true,
      createdAt: hoursFromNow(-240),
      questions: [
        mc("q7", "Which status code means the resource was created successfully?", ["200", "201", "400", "500"], 1, 2,
          "201 Created is returned after a successful POST that creates a resource."),
      ],
    },
    {
      // Draft: only the instructor may see it.
      id: "qz4",
      classId: "it314",
      title: "Quiz 3: REST APIs",
      status: "draft",
      source: "manual",
      timeLimitMin: null,
      dueAt: null,
      closesAt: null,
      allowLate: false,
      createdAt: hoursFromNow(-2),
      questions: [
        mc("q8", "Which HTTP verb is idempotent and used to replace a resource?", ["POST", "PUT", "PATCH", "CONNECT"], 1, 2,
          "PUT replaces the target resource and repeating it has the same effect.", "Understand"),
      ],
    },
  ];
}

export function seedAttempts(): DbAttempt[] {
  const at = (
    id: string, quizId: string, studentId: string, hoursAgo: number,
    answers: DbAttempt["answers"], gradedScore: number | null = null, gradedHoursAgo: number | null = null,
  ): DbAttempt => ({
    id, quizId, studentId,
    startedAt: hoursFromNow(-hoursAgo - 0.2),
    submittedAt: hoursFromNow(-hoursAgo),
    late: false,
    answers,
    gradedScore,
    feedback: null,
    gradedAt: gradedHoursAgo === null ? null : hoursFromNow(-gradedHoursAgo),
  });

  const essay = "Layered controls mean one failure does not expose everything.";
  const pendingStudents = ["u_s1", "u_s2", "u_s3", "u_s4", "u_s5", "u_s6"];
  return [
    // Quiz 1 (CIA): Juan perfect; classmates a mix
    at("att1", "qz2", JUAN, 200.8, [{ questionId: "q5", response: 0 }, { questionId: "q6", response: 1 }]),
    at("att2", "qz2", "u_s1", 205, [{ questionId: "q5", response: 0 }, { questionId: "q6", response: 2 }]),
    at("att3", "qz2", "u_s2", 203, [{ questionId: "q5", response: 1 }, { questionId: "q6", response: 1 }]),
    // Quiz 2 (Network Security): Juan has NOT taken it; others waiting on essay grading
    ...pendingStudents.map((sid, i) =>
      at(`att_q1_${i}`, "qz1", sid, 2 + i, [
        { questionId: "q1", response: i % 2 === 0 ? 2 : 0 },
        { questionId: "q2", response: 1 },
        { questionId: "q3", response: i % 3 === 0 ? "IDS" : "firewall" },
        { questionId: "q4", response: essay },
      ]),
    ),
    // Quiz 1 (REST): old graded-by-auto attempts from classmates
    at("att_r1", "qz3", "u_s1", 20, [{ questionId: "q7", response: 1 }]),
    at("att_r2", "qz3", "u_s3", 18, [{ questionId: "q7", response: 0 }]),
  ];
}
