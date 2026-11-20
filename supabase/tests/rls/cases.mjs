// Test matrix. Personas, in column order of every expectation string:
//   S  student enrolled in c1        SO student with no class      I  instructor who owns c1
//   IO instructor who owns c2 only   A  admin (API/service role only)  N  anon
// Expectation tokens:  select -> exact row count | write -> 1 = succeeds, 0 = blocked (0 rows OR 42501)
//                      D = must be refused with 42501 (no privilege / RLS violation), E = any error
// Fixture ids are in fixtures.sql ({S1}..{ADM} expand to user uuids, {me} to the acting user).

const U = {
  ADM: "a0000000-0000-0000-0000-000000000001",
  I1: "a0000000-0000-0000-0000-000000000011",
  I2: "a0000000-0000-0000-0000-000000000012",
  S1: "a0000000-0000-0000-0000-000000000021",
  S2: "a0000000-0000-0000-0000-000000000022",
  S3: "a0000000-0000-0000-0000-000000000023",
  SX: "a0000000-0000-0000-0000-000000000024",
};
const ZERO = "00000000-0000-0000-0000-000000000000";
const P = {
  S: { name: "student", role: "authenticated", uid: U.S1 },
  SO: { name: "student(no class)", role: "authenticated", uid: U.S3 },
  I: { name: "instructor(owner)", role: "authenticated", uid: U.I1 },
  IO: { name: "instructor(other)", role: "authenticated", uid: U.I2 },
  A: { name: "admin", role: "authenticated", uid: U.ADM },
  N: { name: "anon", role: "anon", uid: null },
  SX: { name: "student(inactive)", role: "authenticated", uid: U.SX },
};
const ORDER = ["S", "SO", "I", "IO", "A", "N"];

export const TABLES = [];
export const VIEWS = ["class_progress", "student_tasks"];
const cases = [];

const fill = (sql, p) =>
  sql.replace(/\{me\}/g, p.uid ?? ZERO).replace(/\{(ADM|I1|I2|S1|S2|S3|SX)\}/g, (_, k) => U[k]);
const parse = (e) => e.trim().split(/\s+/).map((t) => (/^\d+$/.test(t) ? Number(t) : t));

/** Adds one case per persona. */
function add(table, op, label, sql, exp, pre) {
  if (!TABLES.includes(table) && !VIEWS.includes(table) && table !== "storage.objects" && table !== "rpc") TABLES.push(table);
  const e = parse(exp);
  ORDER.forEach((k, i) => {
    const dml = op === "select" || op === "rpc" ? sql : `with x as (${sql} returning 1) select * from x`;
    cases.push({ table, op, label, persona: P[k], sql: fill(dml, P[k]), pre: pre && fill(pre, P[k]), exp: e[i] });
  });
}
/** One persona only. */
function solo(k, table, op, label, sql, exp, pre) {
  if (!TABLES.includes(table) && !VIEWS.includes(table) && table !== "rpc") TABLES.push(table);
  const dml = op === "select" || op === "rpc" ? sql : `with x as (${sql} returning 1) select * from x`;
  cases.push({ table, op, label, persona: P[k], sql: fill(dml, P[k]), pre, exp });
}

export function buildCases() {
  if (cases.length) return cases;
  const sel = (t, l, sql, e, pre) => add(t, "select", l, sql, e, pre);
  const ins = (t, l, sql, e, pre) => add(t, "insert", l, sql, e, pre);
  const upd = (t, l, sql, e, pre) => add(t, "update", l, sql, e, pre);
  const del = (t, l, sql, e, pre) => add(t, "delete", l, sql, e, pre);
  const NONE = "0 0 0 0 0 0";

  // ------------------------------------------------------------ identity
  const SAFE_COLS = "id, role, full_name, email, username, course, year_level, section, department, phone, status, last_active_at";
  sel("users", "rows visible", "select id from public.users", "2 1 3 2 1 D");
  sel("users", "safe columns readable", `select ${SAFE_COLS} from public.users`, "2 1 3 2 1 D");
  sel("users", "lockout columns hidden", "select failed_login_count, locked_until from public.users", "D D D D D D");
  ins("users", "create profile", "insert into public.users (id, role, full_name, email) values (gen_random_uuid(), 'student', 'x', 'x@omsu.edu.ph')", NONE);
  upd("users", "edit own name", "update public.users set full_name = 'New' where id = '{me}'", "1 1 1 1 1 0");
  upd("users", "edit someone else", "update public.users set full_name = 'Hax' where id = '{S2}'", NONE);
  upd("users", "self-promote role", "update public.users set role = 'admin' where id = '{me}'", NONE);
  upd("users", "self-activate status", "update public.users set status = 'active' where id = '{me}'", NONE);
  upd("users", "change own email", "update public.users set email = 'z@omsu.edu.ph' where id = '{me}'", NONE);
  upd("users", "clear own lockout", "update public.users set locked_until = null where id = '{me}'", NONE);
  del("users", "delete profile", "delete from public.users where id = '{me}'", NONE);

  for (const t of ["otp_codes", "auth_tokens", "idempotency_keys", "login_attempts"]) {
    sel(t, "no client access", `select 1 from public.${t}`, "D D D D D D");
    del(t, "no client delete", `delete from public.${t}`, NONE);
  }
  ins("otp_codes", "no client insert", "insert into public.otp_codes (email, purpose, code_hash, expires_at) values ('a@omsu.edu.ph','signup','h', now() + interval '1 min')", NONE);
  upd("otp_codes", "no client update", "update public.otp_codes set attempts = 0", NONE);
  ins("auth_tokens", "no client insert", "insert into public.auth_tokens (email, kind, token_hash, expires_at) values ('a@omsu.edu.ph','reset','hh', now() + interval '1 min')", NONE);
  upd("auth_tokens", "no client update", "update public.auth_tokens set consumed_at = null", NONE);
  ins("idempotency_keys", "no client insert", "insert into public.idempotency_keys (idem_key, user_id, endpoint) values ('idem-key-9999','{me}','/x')", NONE);
  upd("idempotency_keys", "no client update", "update public.idempotency_keys set status_code = 200", NONE);
  ins("login_attempts", "no client insert", "insert into public.login_attempts (identifier) values ('x')", NONE);
  upd("login_attempts", "no client update", "update public.login_attempts set success = true", NONE);

  sel("sessions", "own devices only", "select id, user_id, device, platform, created_at, last_active_at, expires_at, revoked_at from public.sessions", "1 0 0 0 0 D");
  sel("sessions", "token hash hidden", "select token_hash from public.sessions", "D D D D D D");
  ins("sessions", "no client insert", "insert into public.sessions (user_id, token_hash, expires_at) values ('{me}','hx', now() + interval '1 day')", NONE);
  upd("sessions", "no client update", "update public.sessions set revoked_at = null where user_id = '{me}'", NONE);
  del("sessions", "no client delete", "delete from public.sessions where user_id = '{me}'", NONE);

  // ------------------------------------------------------------ classes
  sel("classes", "rows visible", "select id from public.classes", "1 0 1 1 0 D");
  ins("classes", "create own class", "insert into public.classes (subject_code, title, instructor_id, course, year_level, section) values ('X','T','{me}','BSIT','1','C')", "0 0 1 1 0 0");
  ins("classes", "create for another instructor", "insert into public.classes (subject_code, title, instructor_id, course, year_level, section) values ('X','T','{I2}','BSIT','1','C')", "0 0 0 1 0 0");
  upd("classes", "edit own class", "update public.classes set title = 'New' where id = 'c1'", "0 0 1 0 0 0");
  upd("classes", "rewrite join code", "update public.classes set join_code = 'ZZZZZZ' where id = 'c1'", NONE);
  upd("classes", "reassign owner", "update public.classes set instructor_id = '{I2}' where id = 'c1'", NONE);
  upd("classes", "archive own class", "update public.classes set archived = true where id = 'c1'", "0 0 1 0 0 0");
  upd("classes", "soft-delete by direct UPDATE", "update public.classes set deleted_at = now() where id = 'c1'", NONE);
  add("rpc", "rpc", "delete_class (soft delete)", "select public.delete_class('c1')", "D D 1 D D D");
  add("rpc", "rpc", "private helpers not callable by anon", "select private.is_admin()", "1 1 1 1 1 D");
  sel("classes", "student removed by instructor loses access", "select id from public.classes", "0 0 1 1 0 D", "update public.class_enrollments set left_at = now() where id = 'e1'");
  sel("announcements", "student removed by instructor loses access", "select id from public.announcements", "0 0 1 1 0 D", "update public.class_enrollments set left_at = now() where id = 'e1'");
  del("classes", "delete class", "delete from public.classes where id = 'c1'", "0 0 1 0 0 0");

  sel("class_enrollments", "rows visible", "select id from public.class_enrollments", "1 0 2 1 0 D");
  ins("class_enrollments", "self-enrol without code", "insert into public.class_enrollments (class_id, student_id) values ('c1','{me}')", NONE);
  upd("class_enrollments", "remove student (left_at)", "update public.class_enrollments set left_at = now() where id = 'e1'", "0 0 1 0 0 0");
  upd("class_enrollments", "move student to another class", "update public.class_enrollments set class_id = 'c2' where id = 'e1'", NONE);
  del("class_enrollments", "delete enrolment", "delete from public.class_enrollments where id = 'e1'", NONE);
  add("rpc", "rpc", "join_class with a valid code", "select public.join_class('AAAAAA')", "1 1 D D D D");
  add("rpc", "rpc", "join_class with a bad code", "select public.join_class('NOPE00')", "E E D D D D");

  sel("announcements", "rows visible", "select id from public.announcements", "1 0 1 1 0 D");
  ins("announcements", "post to own class", "insert into public.announcements (class_id, author_id, title, body) values ('c1','{me}','t','b')", "0 0 1 0 0 0");
  ins("announcements", "post as someone else", "insert into public.announcements (class_id, author_id, title, body) values ('c1','{I2}','t','b')", NONE);
  upd("announcements", "edit", "update public.announcements set title = 'x' where id = 'an1'", "0 0 1 0 0 0");
  upd("announcements", "soft-delete", "update public.announcements set deleted_at = now() where id = 'an1'", "0 0 1 0 0 0");
  del("announcements", "delete", "delete from public.announcements where id = 'an1'", "0 0 1 0 0 0");

  sel("announcement_comments", "rows visible", "select id from public.announcement_comments", "1 0 1 1 0 D");
  ins("announcement_comments", "comment in own class", "insert into public.announcement_comments (announcement_id, author_id, body) values ('an1','{me}','hi')", "1 0 1 0 0 0");
  ins("announcement_comments", "comment as someone else", "insert into public.announcement_comments (announcement_id, author_id, body) values ('an1','{S2}','hi')", NONE);
  upd("announcement_comments", "edit", "update public.announcement_comments set body = 'x' where id = 'cm1'", NONE);
  del("announcement_comments", "delete (author or class owner)", "delete from public.announcement_comments where id = 'cm1'", "1 0 1 0 0 0");

  // ------------------------------------------------------------ content
  sel("files", "rows visible", "select id from public.files", "2 1 2 1 0 D");
  const FILE = (by, bucket = "materials", extra = "") =>
    `insert into public.files (original_name, bucket, object_path, kind, extension, mime_type, size_bytes, uploaded_by${extra ? ", " + extra.split("=")[0] : ""}) values ('a.pdf','${bucket}','p/new','pdf','pdf','application/pdf',1,'${by}'${extra ? ", " + extra.split("=")[1] : ""})`;
  ins("files", "register own upload", FILE("{me}"), "1 1 1 1 1 0");
  ins("files", "register upload as someone else", FILE("{I2}"), NONE.replace(/^0 0 0 0/, "0 0 0 1"));
  ins("files", "pre-mark as virus-scanned", FILE("{me}", "materials", "scan_result='clean'"), NONE);
  upd("files", "edit metadata", "update public.files set original_name = 'x'", NONE);
  del("files", "delete own upload (f1)", "delete from public.files where id = 'f1'", "0 0 1 0 0 0");
  del("files", "delete own upload (f2)", "delete from public.files where id = 'f2'", "1 0 0 0 0 0");

  sel("materials", "rows visible (students: ready only)", "select id from public.materials", "1 0 2 1 0 D");
  ins("materials", "upload to own class", "insert into public.materials (class_id, title, kind, owner_id) values ('c1','t','pdf','{me}')", "0 0 1 0 0 0");
  ins("materials", "insert already 'ready'", "insert into public.materials (class_id, title, kind, owner_id, processing) values ('c1','t','pdf','{me}','ready')", NONE);
  ins("materials", "attach someone else's file", "insert into public.materials (class_id, title, kind, owner_id, file_id) values ('c1','t','pdf','{me}','f3')", NONE);
  upd("materials", "rename", "update public.materials set title = 'x' where id = 'm1'", "0 0 1 0 0 0");
  upd("materials", "mark ready", "update public.materials set processing = 'ready' where id = 'm1p'", NONE);
  upd("materials", "soft-delete", "update public.materials set deleted_at = now() where id = 'm1'", "0 0 1 0 0 0");
  del("materials", "delete", "delete from public.materials where id = 'm1'", "0 0 1 0 0 0");

  sel("material_transcript_lines", "rows visible", "select id from public.material_transcript_lines", "1 0 2 0 0 D");
  ins("material_transcript_lines", "client write", "insert into public.material_transcript_lines (material_id, start_sec, body) values ('m1', 1, 'x')", NONE);
  upd("material_transcript_lines", "client write", "update public.material_transcript_lines set body = 'x'", NONE);
  del("material_transcript_lines", "client write", "delete from public.material_transcript_lines", NONE);
  sel("material_summaries", "rows visible", "select id from public.material_summaries", "1 0 1 0 0 D");
  ins("material_summaries", "client write", "insert into public.material_summaries (material_id, mode, tldr) values ('m1','bullets','x')", NONE);
  upd("material_summaries", "client write", "update public.material_summaries set tldr = 'x'", NONE);
  del("material_summaries", "client write", "delete from public.material_summaries", NONE);
  sel("material_objectives", "rows visible", "select id from public.material_objectives", "1 0 1 0 0 D");
  ins("material_objectives", "add objective", "insert into public.material_objectives (material_id, body) values ('m1','x')", "0 0 1 0 0 0");
  upd("material_objectives", "edit", "update public.material_objectives set body = 'y' where id = 'o1'", "0 0 1 0 0 0");
  del("material_objectives", "delete", "delete from public.material_objectives where id = 'o1'", "0 0 1 0 0 0");

  sel("material_views", "rows visible", "select id from public.material_views", "1 0 1 0 0 D");
  const NOVIEW = "delete from public.material_views";
  ins("material_views", "record own view", "insert into public.material_views (material_id, student_id) values ('m1','{me}')", "1 0 0 0 0 0", NOVIEW);
  ins("material_views", "record view as someone else", "insert into public.material_views (material_id, student_id) values ('m1','{S2}')", NONE, NOVIEW);
  upd("material_views", "update own progress", "update public.material_views set watch_seconds = 50 where id = 'v1'", "1 0 0 0 0 0");
  upd("material_views", "reassign view", "update public.material_views set student_id = '{S3}' where id = 'v1'", NONE);
  del("material_views", "delete", "delete from public.material_views", NONE);

  // ------------------------------------------------------------ assessments
  sel("assignments", "rows visible", "select id from public.assignments", "1 0 1 1 0 D");
  ins("assignments", "create in own class", "insert into public.assignments (class_id, title, due_at, created_by) values ('c1','t', now(),'{me}')", "0 0 1 0 0 0");
  upd("assignments", "edit", "update public.assignments set title = 'x' where id = 'a1'", "0 0 1 0 0 0");
  upd("assignments", "soft-delete", "update public.assignments set deleted_at = now() where id = 'a1'", "0 0 1 0 0 0");
  del("assignments", "delete", "delete from public.assignments where id = 'a1'", "0 0 1 0 0 0");
  sel("assignment_attachments", "rows visible", "select 1 from public.assignment_attachments", "1 0 1 0 0 D");
  ins("assignment_attachments", "attach own file", "insert into public.assignment_attachments (assignment_id, file_id) values ('a1','f1')", "0 0 1 0 0 0", "delete from public.assignment_attachments");
  ins("assignment_attachments", "attach someone else's file", "insert into public.assignment_attachments (assignment_id, file_id) values ('a1','f3')", NONE, "delete from public.assignment_attachments");
  del("assignment_attachments", "detach", "delete from public.assignment_attachments where assignment_id = 'a1'", "0 0 1 0 0 0");

  const NOSUB = "delete from public.assignment_submissions";
  sel("assignment_submissions", "rows visible", "select id from public.assignment_submissions", "1 0 1 1 0 D");
  ins("assignment_submissions", "start own draft", "insert into public.assignment_submissions (assignment_id, student_id) values ('a1','{me}')", "1 0 0 0 0 0", NOSUB);
  ins("assignment_submissions", "insert as 'submitted'", "insert into public.assignment_submissions (assignment_id, student_id, status, submitted_at) values ('a1','{me}','submitted', now())", NONE, NOSUB);
  ins("assignment_submissions", "attach someone else's file", "insert into public.assignment_submissions (assignment_id, student_id, file_id) values ('a1','{me}','f4')", NONE, NOSUB);
  upd("assignment_submissions", "edit own draft", "update public.assignment_submissions set submission_text = 'x' where id = 'asub1'", "1 0 0 0 0 0");
  upd("assignment_submissions", "swap in someone else's file", "update public.assignment_submissions set file_id = 'f4' where id = 'asub1'", NONE);
  upd("assignment_submissions", "turn in directly", "update public.assignment_submissions set status = 'submitted', submitted_at = now() where id = 'asub1'", NONE);
  upd("assignment_submissions", "grade directly", "update public.assignment_submissions set score = 10 where id = 'asub1'", NONE);
  upd("assignment_submissions", "edit after turn-in", "update public.assignment_submissions set submission_text = 'late edit' where id = 'asub1'", NONE,
    "update public.assignment_submissions set status = 'submitted', submitted_at = now() where id = 'asub1'");
  del("assignment_submissions", "delete", "delete from public.assignment_submissions", NONE);

  sel("quizzes", "rows visible (students: published only)", "select id from public.quizzes", "1 0 2 1 0 D");
  ins("quizzes", "create in own class", "insert into public.quizzes (class_id, title, created_by) values ('c1','t','{me}')", "0 0 1 0 0 0");
  upd("quizzes", "edit", "update public.quizzes set title = 'x' where id = 'q1'", "0 0 1 0 0 0");
  upd("quizzes", "soft-delete", "update public.quizzes set deleted_at = now() where id = 'q1'", "0 0 1 0 0 0");
  del("quizzes", "delete", "delete from public.quizzes where id = 'q1d'", "0 0 1 0 0 0");
  sel("quiz_questions", "rows visible", "select id from public.quiz_questions", "2 0 3 1 0 D");
  ins("quiz_questions", "add question", "insert into public.quiz_questions (quiz_id, type, prompt) values ('q1','essay','p')", "0 0 1 0 0 0");
  upd("quiz_questions", "edit", "update public.quiz_questions set prompt = 'x' where id = 'qq1b'", "0 0 1 0 0 0");
  del("quiz_questions", "delete", "delete from public.quiz_questions where id = 'qq1b'", "0 0 1 0 0 0");
  sel("quiz_options", "rows visible", "select id from public.quiz_options", "2 0 2 2 0 D");
  ins("quiz_options", "add option", "insert into public.quiz_options (question_id, position, body) values ('qq1', 2, 'C')", "0 0 1 0 0 0");
  upd("quiz_options", "edit", "update public.quiz_options set body = 'x' where id = 'qo1a'", "0 0 1 0 0 0");
  del("quiz_options", "delete", "delete from public.quiz_options where id = 'qo1a'", "0 0 1 0 0 0");

  // answer keys: never to a student before they are done with the quiz
  const SUBMIT = "update public.quiz_attempts set submitted_at = now(), score = 0, max_score = 1 where id = 'att1'";
  sel("quiz_question_keys", "no attempt yet", "select question_id from public.quiz_question_keys", "0 0 3 1 0 D");
  sel("quiz_question_keys", "1 of 2 attempts submitted", "select question_id from public.quiz_question_keys", "0 0 3 1 0 D", SUBMIT);
  sel("quiz_question_keys", "all attempts used", "select question_id from public.quiz_question_keys", "2 0 3 1 0 D",
    `${SUBMIT}; update public.quizzes set max_attempts = 1 where id = 'q1'`);
  sel("quiz_question_keys", "submitted and past due", "select question_id from public.quiz_question_keys", "2 0 3 1 0 D",
    `${SUBMIT}; update public.quizzes set due_at = now() - interval '1 day' where id = 'q1'`);
  sel("quiz_question_keys", "past due but never submitted", "select question_id from public.quiz_question_keys", "0 0 3 1 0 D",
    "update public.quizzes set due_at = now() - interval '1 day' where id = 'q1'");
  sel("quiz_question_keys", "correct_index/answer/rationale", "select correct_index, correct_answer, rationale from public.quiz_question_keys", "0 0 3 1 0 D");
  ins("quiz_question_keys", "add key", "insert into public.quiz_question_keys (question_id, correct_answer) values ('qq1b','x')", "0 0 1 0 0 0", "delete from public.quiz_question_keys where question_id = 'qq1b'");
  upd("quiz_question_keys", "edit key", "update public.quiz_question_keys set rationale = 'x' where question_id = 'qq1b'", "0 0 1 0 0 0");
  del("quiz_question_keys", "delete key", "delete from public.quiz_question_keys where question_id = 'qq1b'", "0 0 1 0 0 0");

  sel("quiz_attempts", "rows visible", "select id from public.quiz_attempts", "1 0 1 1 0 D");
  ins("quiz_attempts", "start 2nd attempt", "insert into public.quiz_attempts (quiz_id, student_id, attempt_no) values ('q1','{me}',2)", "1 0 0 0 0 0");
  ins("quiz_attempts", "start attempt on a draft quiz", "insert into public.quiz_attempts (quiz_id, student_id) values ('q1d','{me}')", NONE);
  ins("quiz_attempts", "start attempt with a score", "insert into public.quiz_attempts (quiz_id, student_id, attempt_no, score, max_score) values ('q1','{me}',2,5,5)", NONE);
  ins("quiz_attempts", "start attempt for someone else", "insert into public.quiz_attempts (quiz_id, student_id, attempt_no) values ('q1','{S3}',2)", NONE);
  upd("quiz_attempts", "self-score / submit", "update public.quiz_attempts set score = 1, max_score = 1, submitted_at = now() where id = 'att1'", NONE);
  del("quiz_attempts", "delete attempt", "delete from public.quiz_attempts where id = 'att1'", NONE);

  sel("quiz_answers", "rows visible", "select id from public.quiz_answers", "1 0 1 0 0 D");
  ins("quiz_answers", "answer open attempt", "insert into public.quiz_answers (attempt_id, question_id, response_text) values ('att1','qq1b','Paris')", "1 0 0 0 0 0");
  ins("quiz_answers", "answer a question from another quiz", "insert into public.quiz_answers (attempt_id, question_id, response_text) values ('att1','qq2','x')", NONE);
  ins("quiz_answers", "self-mark correct", "insert into public.quiz_answers (attempt_id, question_id, response_text, is_correct) values ('att1','qq1b','Paris', true)", NONE);
  ins("quiz_answers", "answer after submitting", "insert into public.quiz_answers (attempt_id, question_id, response_text) values ('att1','qq1b','Paris')", NONE, SUBMIT);
  upd("quiz_answers", "change answer", "update public.quiz_answers set response_index = 1 where id = 'ans1'", "1 0 0 0 0 0");
  upd("quiz_answers", "change answer after submitting", "update public.quiz_answers set response_index = 1 where id = 'ans1'", NONE, SUBMIT);
  upd("quiz_answers", "self-grade", "update public.quiz_answers set is_correct = true, awarded_points = 1 where id = 'ans1'", NONE);
  del("quiz_answers", "delete answer", "delete from public.quiz_answers where id = 'ans1'", NONE);

  // ------------------------------------------------------------ planner / tasks / notifications
  sel("student_task_overrides", "own rows", "select id from public.student_task_overrides", "1 0 0 0 0 D");
  ins("student_task_overrides", "tick own task", "insert into public.student_task_overrides (student_id, kind, ref_id) values ('{S1}','quiz','q1')", "1 0 0 0 0 0");
  upd("student_task_overrides", "edit", "update public.student_task_overrides set done = false where id = 'to1'", "1 0 0 0 0 0");
  del("student_task_overrides", "delete", "delete from public.student_task_overrides where id = 'to1'", "1 0 0 0 0 0");
  sel("planner_weeks", "own rows", "select id from public.planner_weeks", "1 0 0 0 0 D");
  ins("planner_weeks", "create own week", "insert into public.planner_weeks (student_id, week_start) values ('{S1}','2026-11-23')", "1 0 0 0 0 0");
  upd("planner_weeks", "edit", "update public.planner_weeks set generated_at = now() where id = 'pw1'", "1 0 0 0 0 0");
  del("planner_weeks", "delete", "delete from public.planner_weeks where id = 'pw1'", "1 0 0 0 0 0");
  sel("planner_blocks", "own rows", "select id from public.planner_blocks", "1 0 0 0 0 D");
  ins("planner_blocks", "add to own week", "insert into public.planner_blocks (week_id, day_date, start_hour, title) values ('pw1','2026-11-17',10,'x')", "1 0 0 0 0 0");
  ins("planner_blocks", "add to someone else's week", "insert into public.planner_blocks (week_id, day_date, start_hour, title) values ('pw2','2026-11-17',10,'x')", NONE);
  upd("planner_blocks", "edit", "update public.planner_blocks set done = true where id = 'pb1'", "1 0 0 0 0 0");
  del("planner_blocks", "delete", "delete from public.planner_blocks where id = 'pb1'", "1 0 0 0 0 0");
  sel("planner_exams", "own rows", "select id from public.planner_exams", "1 0 0 0 0 D");
  ins("planner_exams", "add own exam", "insert into public.planner_exams (student_id, title, exam_date) values ('{S1}','e','2026-12-02')", "1 0 0 0 0 0");
  upd("planner_exams", "edit", "update public.planner_exams set title = 'x' where id = 'pe1'", "1 0 0 0 0 0");
  del("planner_exams", "delete", "delete from public.planner_exams where id = 'pe1'", "1 0 0 0 0 0");

  sel("notifications", "own rows", "select id from public.notifications", "1 0 1 0 0 D");
  ins("notifications", "client-created", "insert into public.notifications (user_id, kind, title) values ('{me}','notice','x')", NONE);
  upd("notifications", "mark read", "update public.notifications set read_at = now() where id in ('n1','n2')", "1 0 1 0 0 0");
  upd("notifications", "rewrite title", "update public.notifications set title = 'x' where id in ('n1','n2')", NONE);
  del("notifications", "delete own", "delete from public.notifications where id in ('n1','n2')", "1 0 1 0 0 0");
  sel("platform_announcements", "audience targeting", "select id from public.platform_announcements", "3 2 2 2 1 D");
  ins("platform_announcements", "client write", "insert into public.platform_announcements (title, body) values ('t','b')", NONE);
  upd("platform_announcements", "client write", "update public.platform_announcements set title = 'x'", NONE);
  del("platform_announcements", "client write", "delete from public.platform_announcements", NONE);

  // ------------------------------------------------------------ AI, settings, audit
  sel("ai_requests", "own rows", "select id from public.ai_requests", "1 0 1 0 0 D");
  ins("ai_requests", "client write", "insert into public.ai_requests (user_id, feature) values ('{me}','chat')", NONE);
  upd("ai_requests", "client write", "update public.ai_requests set status = 'ok'", NONE);
  del("ai_requests", "client write", "delete from public.ai_requests", NONE);
  sel("ai_chat_messages", "own rows", "select id from public.ai_chat_messages", "1 0 0 0 0 D");
  ins("ai_chat_messages", "send own message", "insert into public.ai_chat_messages (user_id, thread_id, sender, body) values ('{me}','t','user','hi')", "1 1 1 1 1 0");
  ins("ai_chat_messages", "forge an AI reply", "insert into public.ai_chat_messages (user_id, thread_id, sender, body) values ('{me}','t','ai','hi')", NONE);
  ins("ai_chat_messages", "message into someone else's chat", "insert into public.ai_chat_messages (user_id, thread_id, sender, body) values ('{S2}','th2','user','hi')", NONE);
  upd("ai_chat_messages", "edit", "update public.ai_chat_messages set body = 'x'", NONE);
  del("ai_chat_messages", "delete own", "delete from public.ai_chat_messages where id = 'ch1'", "1 0 0 0 0 0");

  sel("settings", "clients read non-sensitive sections", "select section from public.settings", "3 3 3 3 3 D");
  sel("settings", "backup/system hidden from clients", "select section from public.settings where section in ('backup','system')", NONE.replace(/ 0$/, " D"));
  ins("settings", "client write", "insert into public.settings (section, data) values ('email','{}')", NONE);
  upd("settings", "client write", "update public.settings set data = '{}'", NONE);
  del("settings", "client write", "delete from public.settings", NONE);
  for (const [t, ins_] of [
    ["audit_log", "insert into public.audit_log (actor_name, action, summary) values ('x','create','x')"],
    ["backup_runs", "insert into public.backup_runs (ok) values (true)"],
    ["security_findings", "insert into public.security_findings (title, category, severity, description, recommendation) values ('t','c','low','d','r')"],
  ]) {
    sel(t, "service role only", `select 1 from public.${t}`, "D D D D D D");
    ins(t, "client write", ins_, NONE);
    upd(t, "client write", `update public.${t} set id = id`, NONE);
    del(t, "client write", `delete from public.${t}`, NONE);
  }

  // ------------------------------------------------------------ views (security_invoker: RLS of the base tables applies)
  sel("class_progress", "rows visible", "select * from public.class_progress", "1 0 2 1 0 D");
  sel("class_progress", "student can't see classmates' progress", "select * from public.class_progress where student_id <> '{me}'", "0 0 2 1 0 D");
  sel("student_tasks", "rows visible", "select * from public.student_tasks", "2 0 4 2 0 D");

  // ------------------------------------------------------------ storage: clients never touch objects directly
  add("storage.objects", "select", "no client policies", "select 1 from storage.objects", "0 0 0 0 0 0");
  add("storage.objects", "insert", "no direct upload", "insert into storage.objects (bucket_id, name, owner) values ('materials','x','{me}')", NONE);

  // ------------------------------------------------------------ deactivated account keeps no access
  for (const [t, q] of [
    ["classes", "select id from public.classes"],
    ["announcements", "select id from public.announcements"],
    ["materials", "select id from public.materials"],
    ["assignments", "select id from public.assignments"],
    ["quizzes", "select id from public.quizzes"],
    ["student_tasks", "select * from public.student_tasks"],
  ]) solo("SX", t, "select", "inactive student", q, 0);
  solo("SX", "announcement_comments", "insert", "inactive student comments", "insert into public.announcement_comments (announcement_id, author_id, body) values ('an1','{me}','hi')", 0);
  solo("SX", "rpc", "rpc", "inactive student joins a class", "select public.join_class('AAAAAA')", "D");

  return cases;
}
