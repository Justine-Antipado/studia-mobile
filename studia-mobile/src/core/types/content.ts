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

export type Comment = {
  id: string;
  author: string;
  /** The signed-in user wrote it, so they may delete it (instructors may delete any comment). */
  authorIsMe: boolean;
  text: string;
  /** ISO 8601. */
  postedAt: string;
};
