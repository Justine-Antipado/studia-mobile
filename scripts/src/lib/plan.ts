// What happens to every source (MariaDB) table: which Postgres table it feeds, which columns are
// intentionally not migrated, and any row-level rewrite. Add a new table here (see docs/DATA-MIGRATION.md).

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const SOURCE_SQL = join(ROOT, "supabase", "seed", "source", "studia_db.sql");
export const CSV_DIR = join(ROOT, "supabase", "seed", "csv");
export const MAPPED_DIR = join(CSV_DIR, "_mapped");
export const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");

export type SourceRecord = Record<string, string | null>;

export type PlanContext = {
  /** every source table's rows, keyed by source column name */
  source: Map<string, SourceRecord[]>;
  demoUsers: { oldId: string; originalEmail: string; email: string }[];
};

export type TablePlan = {
  csv: string;
  src: string;
  dest: string;
  /** source columns that are deliberately not migrated */
  drop?: readonly string[];
  /** if set, ONLY these source columns are used */
  keep?: readonly string[];
  /** source column -> destination column */
  rename?: Readonly<Record<string, string>>;
  /** row rewrite on source-named columns, before keep/drop/rename */
  transform?: (row: SourceRecord, ctx: PlanContext) => void;
};

/** Source tables Supabase Auth (or the API) now owns: never imported. */
export const SKIPPED: Readonly<Record<string, string>> = {
  otp_codes: "Supabase Auth / studia-api issue and verify OTPs",
  auth_tokens: "Supabase Auth owns reset tokens",
  sessions: "Supabase Auth owns sessions (seed rows held placeholder token hashes)",
};

function usersTransform(row: SourceRecord, ctx: PlanContext): void {
  const email = row["email"];
  if (email !== null && email !== undefined && /@omsc\.edu\.ph$/i.test(email)) {
    const renamed = email.replace(/@omsc\.edu\.ph$/i, "@omsu.edu.ph");
    ctx.demoUsers.push({ oldId: row["id"] ?? "", originalEmail: email, email: renamed });
    row["email"] = renamed;
  }
}

function filesTransform(row: SourceRecord, ctx: PlanContext): void {
  const submissionFiles = new Set(
    (ctx.source.get("assignment_submissions") ?? []).map((r) => r["file_id"]).filter((v): v is string => v !== null && v !== undefined),
  );
  row["object_path"] = row["stored_name"] ?? null;
  delete row["stored_name"];
  row["bucket"] = submissionFiles.has(row["id"] ?? "") ? "submissions" : "materials";
}

export const PLAN: readonly TablePlan[] = [
  { csv: "01_users", src: "users", dest: "users", drop: ["password_hash", "email_verified_at"], transform: usersTransform },
  { csv: "02_files", src: "files", dest: "files", transform: filesTransform },
  { csv: "03_classes", src: "classes", dest: "classes" },
  { csv: "04_class_enrollments", src: "class_enrollments", dest: "class_enrollments", drop: ["progress_pct"] },
  { csv: "05_materials", src: "materials", dest: "materials" },
  { csv: "06_material_transcript_lines", src: "material_transcript_lines", dest: "material_transcript_lines" },
  { csv: "07_material_objectives", src: "material_objectives", dest: "material_objectives" },
  { csv: "08_material_summaries", src: "material_summaries", dest: "material_summaries" },
  { csv: "09_material_views", src: "material_views", dest: "material_views" },
  { csv: "10_assignments", src: "assignments", dest: "assignments" },
  { csv: "11_assignment_attachments", src: "assignment_attachments", dest: "assignment_attachments" },
  { csv: "12_assignment_submissions", src: "assignment_submissions", dest: "assignment_submissions" },
  { csv: "13_quizzes", src: "quizzes", dest: "quizzes" },
  { csv: "14_quiz_questions", src: "quiz_questions", dest: "quiz_questions", drop: ["correct_index", "correct_answer", "rationale"] },
  { csv: "15_quiz_options", src: "quiz_options", dest: "quiz_options" },
  {
    csv: "16_quiz_question_keys",
    src: "quiz_questions",
    dest: "quiz_question_keys",
    keep: ["id", "correct_index", "correct_answer", "rationale"],
    rename: { id: "question_id" },
  },
  { csv: "17_quiz_attempts", src: "quiz_attempts", dest: "quiz_attempts" },
  { csv: "18_quiz_answers", src: "quiz_answers", dest: "quiz_answers" },
  { csv: "19_announcements", src: "announcements", dest: "announcements" },
  { csv: "20_announcement_comments", src: "announcement_comments", dest: "announcement_comments" },
  { csv: "22_notifications", src: "notifications", dest: "notifications" },
  { csv: "23_ai_requests", src: "ai_requests", dest: "ai_requests" },
  { csv: "24_ai_chat_messages", src: "ai_chat_messages", dest: "ai_chat_messages" },
  { csv: "25_settings", src: "settings", dest: "settings" },
  { csv: "26_audit_log", src: "audit_log", dest: "audit_log" },
  { csv: "27_login_attempts", src: "login_attempts", dest: "login_attempts" },
  { csv: "28_backup_runs", src: "backup_runs", dest: "backup_runs" },
];

export type Manifest = {
  source: string;
  /** rows found in the source INSERTs, per source table */
  sourceRows: Record<string, number>;
  files: { csv: string; dest: string; src: string; rows: number; columns: string[] }[];
  skipped: { table: string; rows: number; reason: string }[];
  demoUsers: { oldId: string; originalEmail: string; email: string }[];
  /** source class_enrollments.progress_pct, kept only to verify the derived class_progress view */
  enrollmentProgress: Record<string, number>;
};
