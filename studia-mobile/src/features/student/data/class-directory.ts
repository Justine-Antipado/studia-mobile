// class-directory.ts — the facts every student repository needs to stamp a class code/title
// onto its own records, without each repository hand-typing the same literals.
import type { Person } from "@/features/student/types/student";

export type ClassFacts = { id: string; code: string; title: string; section: string; teacher: string };

export const CLASS_DIRECTORY: readonly ClassFacts[] = [
  { id: "it321", code: "IT 321", title: "Information Assurance and Security", section: "BSIT 3-A", teacher: "Prof. Maria Santos" },
  { id: "it314", code: "IT 314", title: "Web Systems and Technologies", section: "BSIT 3-A", teacher: "Prof. Ramon Reyes" },
  { id: "it318", code: "IT 318", title: "Mobile Application Development", section: "BSIT 3-A", teacher: "Prof. Ana Lim" },
  { id: "ge105", code: "GE 105", title: "Purposive Communication", section: "BSIT 3-A", teacher: "Prof. Jose Cruz" },
];

export const JOIN_CODES: Record<string, string> = {
  it321: "K7P9QX",
  it314: "M2D8LA",
  it318: "R5T3ZB",
  ge105: "H4F6WT",
};

export function classFacts(classId: string): ClassFacts | undefined {
  return CLASS_DIRECTORY.find((c) => c.id === classId);
}

export const CLASSMATES: readonly Person[] = [
  { id: "s1", name: "Ana Villanueva", role: "student" },
  { id: "s2", name: "Mark Bautista", role: "student" },
  { id: "s3", name: "Liza Mercado", role: "student" },
  { id: "s4", name: "Carlo Dizon", role: "student" },
  { id: "s5", name: "Rica Santiago", role: "student" },
];
