// content.ts — domain types that are genuinely the same on both sides of the app.
// Student and instructor screens show the same file attachment and the same comment, so the shape
// is declared once here and re-exported by features/*/types/* (the feature barrels stay the
// import path screens use). Role-specific shapes stay in their own feature's types file.
export type AttachmentKind = "pdf" | "image" | "video" | "doc" | "slide";

export type Attachment = {
  id: string;
  name: string;
  /** Drives the icon; set from the extension whitelist in shared/utils/file.ts, never from input. */
  kind: AttachmentKind;
  /** Human-readable size ("2.4 MB"), already formatted for display. */
  sizeLabel: string;
};

/** A lesson video that lives elsewhere (YouTube or any https page); never an uploaded file. */
export type VideoLink = {
  provider: "youtube" | "other";
  /** Canonical, validated https URL (for YouTube: https://www.youtube.com/watch?v=ID). */
  url: string;
  /** 11-char YouTube id; null for other hosts. */
  videoId: string | null;
};

export type Comment = {
  id: string;
  author: string;
  /** The signed-in user wrote it, so they may delete it (instructors may delete any comment). */
  authorIsMe: boolean;
  /** Written by the class instructor (shown with an "Instructor" label). */
  authorIsInstructor?: boolean;
  text: string;
  /** ISO 8601. */
  postedAt: string;
};
