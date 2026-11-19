// class-directory.ts — the facts every instructor repository needs to stamp a class code/title
// onto its own records, without each repository hand-typing the same literals.
export type ClassFacts = {
  id: string;
  code: string;
  title: string;
  section: string;
  studentCount: number;
  joinCode: string;
};

export const CLASS_DIRECTORY: readonly ClassFacts[] = [
  { id: "it321", code: "IT 321", title: "Information Assurance and Security", section: "BSIT 3-A", studentCount: 38, joinCode: "K7P9QX" },
  { id: "it314", code: "IT 314", title: "Web Systems and Technologies", section: "BSIT 3-B", studentCount: 34, joinCode: "M2D8LA" },
  { id: "it318", code: "IT 318", title: "Mobile Application Development", section: "BSIT 3-C", studentCount: 31, joinCode: "R5T3ZB" },
  { id: "it322", code: "IT 322", title: "Systems Integration and Architecture", section: "BSIT 4-A", studentCount: 25, joinCode: "W9C4NH" },
];

export function classFacts(classId: string): ClassFacts | undefined {
  return CLASS_DIRECTORY.find((c) => c.id === classId);
}
