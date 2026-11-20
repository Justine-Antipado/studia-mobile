-- ============================================================================
--  studia.db.sql - STUDIA shared database (single importable file)
--  Occidental Mindoro State University - Mamburao Campus
--
--  ONE database for BOTH clients:
--    studia-mobile/  (student + instructor app, Expo)
--    studia-admin/   (admin web dashboard, Vite + React)
--
--  Target: MariaDB 10.4+ / MySQL 5.7+ (XAMPP ships MariaDB 10.4).
--  Import:  phpMyAdmin > Import > choose this file     (creates the DB itself)
--      or:  C:\xampp\mysql\bin\mysql.exe -u root < studia.db.sql
--
--  Re-importing is safe: every table is dropped first, so the file always
--  produces the same state.
--
--  CONVENTIONS (these are the contract - see SCHEMA-AUDIT.md for the why)
--    * Ids are opaque strings, VARCHAR(36). No numeric row id is ever exposed:
--      studia-admin currently assumes integer user ids and must stop.
--    * Columns are snake_case. The API answers snake_case; studia-admin's
--      core/logic/mappers.js converts to camelCase and studia-mobile's
--      repositories map explicitly, so no client sees a name it cannot map.
--    * Enum values are lowercase, matching studia-mobile's TypeScript unions.
--      studia-admin capitalises for display only ('Ready', 'Active',
--      'Published') - that is a label, never a stored value.
--    * All timestamps are DATETIME in UTC. The clients render Asia/Manila and
--      the API serialises ISO 8601 with an offset.
--    * Sizes are bytes, durations are seconds. "2.4 MB" and "18:24" are
--      formatted by the client (shared/utils/file.ts), not stored.
--    * Derived values - progress, the task list, nav counts, "authorIsMe",
--      "current session" - are computed per request, never stored as a second
--      source of truth.
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

CREATE DATABASE IF NOT EXISTS `studia`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE `studia`;

DROP TABLE IF EXISTS idempotency_keys;
DROP TABLE IF EXISTS security_findings;
DROP TABLE IF EXISTS backup_runs;
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS ai_chat_messages;
DROP TABLE IF EXISTS ai_requests;
DROP TABLE IF EXISTS platform_announcements;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS planner_exams;
DROP TABLE IF EXISTS planner_blocks;
DROP TABLE IF EXISTS planner_weeks;
DROP TABLE IF EXISTS student_task_overrides;
DROP TABLE IF EXISTS quiz_answers;
DROP TABLE IF EXISTS quiz_attempts;
DROP TABLE IF EXISTS quiz_options;
DROP TABLE IF EXISTS quiz_questions;
DROP TABLE IF EXISTS quizzes;
DROP TABLE IF EXISTS assignment_submissions;
DROP TABLE IF EXISTS assignment_attachments;
DROP TABLE IF EXISTS assignments;
DROP TABLE IF EXISTS material_views;
DROP TABLE IF EXISTS material_summaries;
DROP TABLE IF EXISTS material_objectives;
DROP TABLE IF EXISTS material_transcript_lines;
DROP TABLE IF EXISTS materials;
DROP TABLE IF EXISTS announcement_comments;
DROP TABLE IF EXISTS announcements;
DROP TABLE IF EXISTS class_enrollments;
DROP TABLE IF EXISTS classes;
DROP TABLE IF EXISTS files;
DROP TABLE IF EXISTS login_attempts;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS auth_tokens;
DROP TABLE IF EXISTS otp_codes;
DROP TABLE IF EXISTS users;


-- ============================================================================
--  1. IDENTITY AND AUTH
-- ============================================================================

-- One accounts table for all three roles. studia-mobile registers students and
-- instructors; the admin is a seeded row here, not a constant inside the
-- client (studia-admin core/data/mock/mockBackend.js ADMIN_ACCOUNT).
CREATE TABLE users (
  id                 VARCHAR(36)  NOT NULL,
  role               ENUM('student','instructor','admin') NOT NULL,
  full_name          VARCHAR(80)  NOT NULL,           -- LIMITS.name = 80
  email              VARCHAR(254) NOT NULL,           -- LIMITS.email = 254; stored normalized (trimmed, lowercased)
  -- The admin signs in with an email OR a username; students and instructors
  -- have none. NULL is excluded from a UNIQUE index in MySQL/MariaDB, so this
  -- stays unique without forcing a value on every row.
  username           VARCHAR(40)  DEFAULT NULL,
  -- NULL for a Google-only account. argon2id (preferred) or bcrypt; 255 fits
  -- both formats. Never a plain password, never a reversible hash.
  password_hash      VARCHAR(255) DEFAULT NULL,
  auth_provider      ENUM('password','google') NOT NULL DEFAULT 'password',
  google_id          VARCHAR(64)  DEFAULT NULL,       -- "sub" of a server-verified Google ID token
  -- Academic identity: students carry course + year_level + section,
  -- instructors carry department. The "BSIT 3-A" string both clients show is
  -- composed from the three columns (composeSection) and is NOT stored -
  -- storing that label is exactly what let the two apps drift apart.
  course             ENUM('BSIT','BEED','BSBA-FM','BSBA-OM') DEFAULT NULL,
  year_level         ENUM('1','2','3','4')                   DEFAULT NULL,
  section            ENUM('A','B','C','D','E')               DEFAULT NULL,
  department         ENUM('FM','OM','IT','ED')               DEFAULT NULL,
  phone              VARCHAR(13)  DEFAULT NULL,       -- normalized +639XXXXXXXXX
  email_verified_at  DATETIME     DEFAULT NULL,       -- NULL = not verified (replaces the boolean flag)
  -- 'pending_approval' is what REQUIRE_INSTRUCTOR_APPROVAL in auth-service.ts
  -- sets; 'inactive' is what the admin user list filters on. Both clients see
  -- the same three values (SCHEMA-AUDIT.md, finding 3).
  status             ENUM('active','inactive','pending_approval') NOT NULL DEFAULT 'active',
  failed_login_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until       DATETIME     DEFAULT NULL,       -- LOGIN_MAX_FAILS 5, LOGIN_LOCK_MS 60s
  last_active_at     DATETIME     DEFAULT NULL,       -- the admin user list sorts on this; mobile must touch it
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at         DATETIME     DEFAULT NULL,       -- admin deletes are permanent; this is for a staged delete
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_google_id (google_id),
  KEY ix_users_role_status (role, status),
  KEY ix_users_cys (course, year_level, section),
  KEY ix_users_last_active (last_active_at),
  KEY ix_users_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- OTPs for signup, password reset, Google first sign-in and the admin's own
-- password change. Only the hash is stored; the plain code is e-mailed and
-- never logged (the mocks' devCode must not exist in production).
CREATE TABLE otp_codes (
  id          VARCHAR(36)  NOT NULL,
  email       VARCHAR(254) NOT NULL,                  -- keyed by email, not user_id: a signup OTP predates a usable account
  purpose     ENUM('signup','google_login','google_signup','reset','password_change') NOT NULL,
  code_hash   VARCHAR(255) NOT NULL,                  -- hash of the 6-digit code
  attempts    TINYINT UNSIGNED NOT NULL DEFAULT 0,    -- OTP_MAX_ATTEMPTS = 5
  sent_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  DATETIME     NOT NULL,                  -- OTP_TTL_MS 5 min / settings.email.otp_expiry_minutes
  consumed_at DATETIME     DEFAULT NULL,              -- single use
  request_ip  VARCHAR(45)  DEFAULT NULL,              -- rate-limit per account AND per IP
  PRIMARY KEY (id),
  KEY ix_otp_email_purpose (email, purpose, sent_at),
  KEY ix_otp_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The short-lived tokens verifyOtp() hands back: a reset token, or a profile
-- token for a first-time Google signup. Hashed and single-use, like an OTP.
CREATE TABLE auth_tokens (
  id          VARCHAR(36)  NOT NULL,
  email       VARCHAR(254) NOT NULL,
  kind        ENUM('reset','google_profile') NOT NULL,
  token_hash  VARCHAR(255) NOT NULL,
  payload     JSON         DEFAULT NULL,              -- google_profile: {"full_name":"...","google_id":"..."}
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  DATETIME     NOT NULL,                  -- TOKEN_TTL_MS = 10 min
  consumed_at DATETIME     DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_auth_tokens_hash (token_hash),
  KEY ix_auth_tokens_email (email, kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Every signed-in device, for all three roles. This is what
-- /security/sessions lists and what revokeSession kills, and it is where the
-- mobile refresh token will live once expo-secure-store is wired up.
-- The admin UI's "current" flag is "this row is the caller's session" -
-- computed per request, not a column.
CREATE TABLE sessions (
  id             VARCHAR(36)  NOT NULL,
  user_id        VARCHAR(36)  NOT NULL,
  token_hash     VARCHAR(255) NOT NULL,               -- hash of the refresh/session token
  device         VARCHAR(60)  DEFAULT NULL,           -- 'Windows PC', 'iPhone'
  browser        VARCHAR(60)  DEFAULT NULL,           -- 'Chrome 131'; NULL for the mobile app
  platform       ENUM('web','android','ios') NOT NULL DEFAULT 'web',
  ip             VARCHAR(45)  DEFAULT NULL,
  location       VARCHAR(80)  DEFAULT NULL,           -- coarse, from the IP; display only
  user_agent     VARCHAR(255) DEFAULT NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_active_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at     DATETIME     NOT NULL,               -- settings.security_policy.session_timeout_minutes
  revoked_at     DATETIME     DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_token (token_hash),
  KEY ix_sessions_user (user_id, last_active_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Appended on EVERY login call from every client, success or failure. The
-- lockout decision and /security/login-attempts read these same rows, so the
-- list and the behaviour can never disagree. identifier is stored exactly as
-- typed (not normalized) so enumeration attempts stay visible.
CREATE TABLE login_attempts (
  id           VARCHAR(36)  NOT NULL,
  identifier   VARCHAR(254) NOT NULL,
  user_id      VARCHAR(36)  DEFAULT NULL,             -- NULL when the identifier matched nothing
  role         ENUM('student','instructor','admin') DEFAULT NULL,  -- which app asked
  success      TINYINT(1)   NOT NULL DEFAULT 0,
  locked       TINYINT(1)   NOT NULL DEFAULT 0,       -- this attempt was refused by the lockout
  ip           VARCHAR(45)  DEFAULT NULL,
  user_agent   VARCHAR(255) DEFAULT NULL,
  attempted_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_attempts_identifier (identifier, attempted_at),
  KEY ix_attempts_at (attempted_at),
  CONSTRAINT fk_attempts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
--  2. FILES
-- ============================================================================

-- Every upload: material videos/PDFs/slides, assignment briefs and student
-- submissions. The client sends a name and gets back an opaque id; the server
-- stores the bytes under stored_name (an id it generates), never under the
-- name that came from the device.
CREATE TABLE files (
  id            VARCHAR(36)  NOT NULL,
  original_name VARCHAR(120) NOT NULL,                -- sanitizeFileName(), MAX_NAME_LENGTH = 120
  stored_name   VARCHAR(160) NOT NULL,                -- server-generated; the path under backend/storage/uploads
  kind          ENUM('pdf','image','video','doc','slide') NOT NULL,  -- AttachmentKind, from the extension whitelist
  extension     VARCHAR(8)   NOT NULL,                -- pdf doc docx ppt pptx mp4 mov jpg jpeg png
  mime_type     VARCHAR(120) NOT NULL,                -- SNIFFED from the bytes, never copied from the request header
  size_bytes    BIGINT UNSIGNED NOT NULL,             -- the client formats "2.4 MB"; the column stays numeric
  checksum_sha256 CHAR(64)   DEFAULT NULL,            -- de-duplication and integrity
  scanned_at    DATETIME     DEFAULT NULL,            -- malware scan; NULL = never serve it back yet
  scan_result   ENUM('clean','infected','error') DEFAULT NULL,
  uploaded_by   VARCHAR(36)  DEFAULT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_files_stored_name (stored_name),
  KEY ix_files_uploader (uploaded_by),
  CONSTRAINT fk_files_uploader FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
--  3. CLASSES AND ENROLMENT
-- ============================================================================

-- One class row serves three views: the student's StudentClass, the
-- instructor's InstructorClass and the admin's class list.
--   subject_code  "IT 321"  - the instructor's own subject code (mobile `code`)
--   join_code     "K7P9QX"  - the 6-char enrolment code, SERVER-generated and unique
-- The admin list's `code` column is this same subject_code; its own generated
-- format ("BSIT301") is a mock artefact (SCHEMA-AUDIT.md, finding 7).
-- student_count and progress are COUNT/AVG over class_enrollments, not columns.
CREATE TABLE classes (
  id            VARCHAR(36)  NOT NULL,
  subject_code  VARCHAR(20)  NOT NULL,                -- displayed by both apps; not unique (reused across terms)
  title         VARCHAR(120) NOT NULL,
  instructor_id VARCHAR(36)  NOT NULL,                -- the owner; every instructor endpoint checks it
  course        ENUM('BSIT','BEED','BSBA-FM','BSBA-OM') NOT NULL,
  year_level    ENUM('1','2','3','4') NOT NULL,
  section       ENUM('A','B','C','D','E') NOT NULL,   -- the "BSIT 3-A" label is composed, never stored
  join_code     CHAR(6)      NOT NULL,                -- [A-Z0-9]{6}, generated by the server
  school_year   VARCHAR(12)  DEFAULT NULL,            -- '2026-2027', from settings.term
  semester      VARCHAR(20)  DEFAULT NULL,            -- '1st Semester'
  archived      TINYINT(1)   NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    DATETIME     DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_classes_join_code (join_code),
  KEY ix_classes_instructor (instructor_id, archived),
  KEY ix_classes_cys (course, year_level, section),
  CONSTRAINT fk_classes_instructor FOREIGN KEY (instructor_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Membership. Leaving a class sets left_at and keeps the submissions, which is
-- what both "leave" (student) and "remove" (instructor) are specified to do.
-- progress_pct is a cache of the computed value (see the comment on
-- material_views); recompute it on view/submission, never let a client set it.
CREATE TABLE class_enrollments (
  id           VARCHAR(36)  NOT NULL,
  class_id     VARCHAR(36)  NOT NULL,
  student_id   VARCHAR(36)  NOT NULL,
  joined_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  left_at      DATETIME     DEFAULT NULL,
  progress_pct TINYINT UNSIGNED NOT NULL DEFAULT 0,   -- 0..100; the clients use 0..1, so divide on the way out
  PRIMARY KEY (id),
  UNIQUE KEY uq_enrollment (class_id, student_id),
  KEY ix_enrollment_student (student_id, left_at),
  CONSTRAINT fk_enrollment_class FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE,
  CONSTRAINT fk_enrollment_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
--  4. CLASS ANNOUNCEMENTS AND COMMENTS
-- ============================================================================

-- A class's own notices, written by its instructor. Distinct from
-- platform_announcements (section 10), which is the admin's campus-wide feed.
-- Caps are the API contract's: title 100, body 2000, plain text - never HTML.
CREATE TABLE announcements (
  id         VARCHAR(36)   NOT NULL,
  class_id   VARCHAR(36)   NOT NULL,
  author_id  VARCHAR(36)   DEFAULT NULL,              -- NULL keeps the notice after the author is deleted
  title      VARCHAR(100)  NOT NULL,
  body       VARCHAR(2000) NOT NULL,
  pinned     TINYINT(1)    NOT NULL DEFAULT 0,        -- pinned first, then newest
  posted_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME      DEFAULT NULL,
  PRIMARY KEY (id),
  KEY ix_announcements_class (class_id, pinned, posted_at),
  CONSTRAINT fk_announcements_class FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE,
  CONSTRAINT fk_announcements_author FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Comment.authorIsMe is NOT a column: it is author_id = the caller. A student
-- may delete only their own comment; the class instructor may delete any.
CREATE TABLE announcement_comments (
  id              VARCHAR(36)  NOT NULL,
  announcement_id VARCHAR(36)  NOT NULL,
  author_id       VARCHAR(36)  DEFAULT NULL,
  body            VARCHAR(500) NOT NULL,              -- <= 500 chars, stored and returned as plain text
  posted_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at      DATETIME     DEFAULT NULL,
  deleted_by      VARCHAR(36)  DEFAULT NULL,          -- moderation trail: author or instructor
  PRIMARY KEY (id),
  KEY ix_comments_announcement (announcement_id, posted_at),
  CONSTRAINT fk_comments_announcement FOREIGN KEY (announcement_id) REFERENCES announcements (id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_author FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_comments_deleter FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
--  5. MATERIALS (the instructor's "Material" = the student's "Lesson")
-- ============================================================================

-- One table, three projections:
--   instructor Material -> transcript + objectives
--   student    Lesson   -> transcript + ai_summary
--   admin      Content  -> class, owner, size, processing state
-- They were never different things (SCHEMA-AUDIT.md, finding 11).
CREATE TABLE materials (
  id           VARCHAR(36)  NOT NULL,
  class_id     VARCHAR(36)  NOT NULL,
  title        VARCHAR(140) NOT NULL,
  kind         ENUM('video','pdf','slide') NOT NULL,
  file_id      VARCHAR(36)  DEFAULT NULL,             -- the uploaded video/PDF/slide deck itself
  duration_sec INT UNSIGNED DEFAULT NULL,             -- video only; the client formats "18:24"
  -- Transcription is asynchronous: the upload answers 'processing' and the
  -- client polls. The admin content list shows the same three values.
  processing   ENUM('processing','ready','failed') NOT NULL DEFAULT 'processing',
  processing_error VARCHAR(255) DEFAULT NULL,         -- why it failed; the admin inbox quotes this
  attempt_count TINYINT UNSIGNED NOT NULL DEFAULT 0,  -- "could not be transcribed after 3 attempts"
  owner_id     VARCHAR(36)  DEFAULT NULL,             -- the uploading instructor
  posted_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at   DATETIME     DEFAULT NULL,             -- a delete must also remove the stored file
  PRIMARY KEY (id),
  KEY ix_materials_class (class_id, posted_at),
  KEY ix_materials_processing (processing),
  KEY ix_materials_owner (owner_id),
  CONSTRAINT fk_materials_class FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE,
  CONSTRAINT fk_materials_file FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE SET NULL,
  CONSTRAINT fk_materials_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per transcript line, so the player can seek to start_sec.
CREATE TABLE material_transcript_lines (
  id          VARCHAR(36)  NOT NULL,
  material_id VARCHAR(36)  NOT NULL,
  start_sec   INT UNSIGNED NOT NULL,
  body        TEXT         NOT NULL,
  PRIMARY KEY (id),
  KEY ix_transcript_material (material_id, start_sec),
  CONSTRAINT fk_transcript_material FOREIGN KEY (material_id) REFERENCES materials (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AI-extracted learning objectives (the instructor's Material.objectives).
CREATE TABLE material_objectives (
  id          VARCHAR(36)  NOT NULL,
  material_id VARCHAR(36)  NOT NULL,
  position    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  body        VARCHAR(500) NOT NULL,
  PRIMARY KEY (id),
  KEY ix_objectives_material (material_id, position),
  CONSTRAINT fk_objectives_material FOREIGN KEY (material_id) REFERENCES materials (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The AI summary cache behind POST /ai/summary. One row per (material, mode);
-- source_version invalidates it when the material changes, and "Regenerate"
-- bypasses the cache by writing a new row.
CREATE TABLE material_summaries (
  id             VARCHAR(36) NOT NULL,
  material_id    VARCHAR(36) NOT NULL,
  mode           ENUM('tldr','bullets','mindmap') NOT NULL,
  tldr           VARCHAR(500) DEFAULT NULL,           -- Lesson.aiSummary.tldr
  bullets        JSON         DEFAULT NULL,           -- Lesson.aiSummary.bullets: ["...","..."]
  mindmap        JSON         DEFAULT NULL,           -- concept map nodes/edges
  source_version INT UNSIGNED NOT NULL DEFAULT 1,
  generated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_summary_material_mode (material_id, mode, source_version),
  CONSTRAINT fk_summary_material FOREIGN KEY (material_id) REFERENCES materials (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The missing half of every "progress" and "engagement" number in both apps.
-- Nothing in either client writes this yet (SCHEMA-AUDIT.md, finding 14), so
-- the formula is fixed here:
--   class progress   = completed materials / total materials of the class
--   engagement %     = students with a view in the last 7 days / enrolled
--   consumption rate = views / enrolled, completion = completed / views
CREATE TABLE material_views (
  id            VARCHAR(36)  NOT NULL,
  material_id   VARCHAR(36)  NOT NULL,
  student_id    VARCHAR(36)  NOT NULL,
  first_seen_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  watch_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  completed_at  DATETIME     DEFAULT NULL,            -- >= 90% watched, or opened for a PDF/slide
  view_count    INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_view_material_student (material_id, student_id),
  KEY ix_view_student (student_id, last_seen_at),
  CONSTRAINT fk_view_material FOREIGN KEY (material_id) REFERENCES materials (id) ON DELETE CASCADE,
  CONSTRAINT fk_view_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
--  6. ASSIGNMENTS AND SUBMISSIONS
-- ============================================================================

CREATE TABLE assignments (
  id           VARCHAR(36)   NOT NULL,
  class_id     VARCHAR(36)   NOT NULL,
  title        VARCHAR(140)  NOT NULL,
  instructions VARCHAR(4000) NOT NULL DEFAULT '',
  due_at       DATETIME      NOT NULL,
  points       SMALLINT UNSIGNED NOT NULL DEFAULT 0,  -- the submission's max_score
  -- Drives the late rule, so it MUST be enforced server-side:
  --   allow_late = 1 and past due -> 'late'
  --   allow_late = 0 and past due -> stays 'draft' (never auto-submitted)
  allow_late   TINYINT(1)    NOT NULL DEFAULT 1,
  created_by   VARCHAR(36)   DEFAULT NULL,
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at   DATETIME      DEFAULT NULL,
  PRIMARY KEY (id),
  KEY ix_assignments_class (class_id, due_at),
  CONSTRAINT fk_assignments_class FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE,
  CONSTRAINT fk_assignments_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The instructor's brief files. Assignment.attachments[] is this join, ordered.
CREATE TABLE assignment_attachments (
  assignment_id VARCHAR(36) NOT NULL,
  file_id       VARCHAR(36) NOT NULL,
  position      TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (assignment_id, file_id),
  KEY ix_asg_attach_file (file_id),
  CONSTRAINT fk_asg_attach_assignment FOREIGN KEY (assignment_id) REFERENCES assignments (id) ON DELETE CASCADE,
  CONSTRAINT fk_asg_attach_file FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The student's work. Assignment.status in the mobile app is five values, but
-- 'assigned' is the ABSENCE of a row, so it is not stored here
-- (SCHEMA-AUDIT.md, finding 12). The server decides the status, never the client.
CREATE TABLE assignment_submissions (
  id              VARCHAR(36)   NOT NULL,
  assignment_id   VARCHAR(36)   NOT NULL,
  student_id      VARCHAR(36)   NOT NULL,
  status          ENUM('draft','submitted','late','graded') NOT NULL DEFAULT 'draft',
  submission_text TEXT          DEFAULT NULL,
  file_id         VARCHAR(36)   DEFAULT NULL,         -- <= 50 MB for a submission
  submitted_at    DATETIME      DEFAULT NULL,         -- NULL while 'draft'
  score           DECIMAL(6,2)  DEFAULT NULL,         -- 0 <= score <= assignments.points, checked server-side
  feedback        VARCHAR(2000) DEFAULT NULL,
  graded_at       DATETIME      DEFAULT NULL,         -- set = the grade is visible to the student
  graded_by       VARCHAR(36)   DEFAULT NULL,
  idempotency_key VARCHAR(64)   DEFAULT NULL,         -- the attach / turn-in retry guard
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_submission_assignment_student (assignment_id, student_id),
  KEY ix_asub_student (student_id, status),
  KEY ix_asub_grading (status, submitted_at),
  CONSTRAINT fk_asub_assignment FOREIGN KEY (assignment_id) REFERENCES assignments (id) ON DELETE CASCADE,
  CONSTRAINT fk_asub_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_asub_file FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE SET NULL,
  CONSTRAINT fk_asub_grader FOREIGN KEY (graded_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
--  7. QUIZZES, QUESTIONS, ATTEMPTS
-- ============================================================================

CREATE TABLE quizzes (
  id             VARCHAR(36)  NOT NULL,
  class_id       VARCHAR(36)  NOT NULL,               -- the mobile Quiz.classCode is this class's subject_code
  title          VARCHAR(140) NOT NULL,
  status         ENUM('draft','published') NOT NULL DEFAULT 'draft',
  source         ENUM('manual','ai') NOT NULL DEFAULT 'manual',  -- the admin shows 'Manual'/'AI'
  time_limit_min SMALLINT UNSIGNED DEFAULT NULL,
  due_at         DATETIME     DEFAULT NULL,
  max_attempts   TINYINT UNSIGNED NOT NULL DEFAULT 1, -- a second attempt is 409 unless this allows it
  source_material_id VARCHAR(36) DEFAULT NULL,        -- set when the AI synthesised it from a material
  created_by     VARCHAR(36)  DEFAULT NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at   DATETIME     DEFAULT NULL,
  deleted_at     DATETIME     DEFAULT NULL,           -- deleting with attempts is 409; archive instead
  PRIMARY KEY (id),
  KEY ix_quizzes_class (class_id, status),
  KEY ix_quizzes_source (source),
  CONSTRAINT fk_quizzes_class FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE,
  CONSTRAINT fk_quizzes_material FOREIGN KEY (source_material_id) REFERENCES materials (id) ON DELETE SET NULL,
  CONSTRAINT fk_quizzes_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The column is `prompt`, which is the student type's name for it. The
-- instructor type calls the same field `text` (SCHEMA-AUDIT.md, finding 9).
-- correct_index / correct_answer / rationale MUST NOT be sent to a student
-- before their attempt is submitted.
CREATE TABLE quiz_questions (
  id             VARCHAR(36)   NOT NULL,
  quiz_id        VARCHAR(36)   NOT NULL,
  position       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  type           ENUM('multiple_choice','identification','essay') NOT NULL,
  prompt         VARCHAR(1000) NOT NULL,
  correct_index  TINYINT       DEFAULT NULL,          -- multiple_choice only: 0-based into quiz_options.position
  correct_answer VARCHAR(255)  DEFAULT NULL,          -- identification only; essay has no auto-grade
  bloom          ENUM('Remember','Understand','Apply','Analyze','Evaluate','Create') DEFAULT NULL,
  difficulty     ENUM('Easy','Medium','Hard') DEFAULT NULL,
  points         SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  rationale      VARCHAR(1000) DEFAULT NULL,          -- shown after submission
  -- The tag the admin's "struggling concepts" report needs. Neither client
  -- sets it yet; until it is filled, that report stays mock data
  -- (SCHEMA-AUDIT.md, finding 18).
  concept        VARCHAR(120)  DEFAULT NULL,
  PRIMARY KEY (id),
  KEY ix_questions_quiz (quiz_id, position),
  KEY ix_questions_concept (concept),
  CONSTRAINT fk_questions_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- QuizQuestion.options[] - the editor always offers 4 slots for a
-- multiple_choice item; a row per option keeps the correct index honest.
CREATE TABLE quiz_options (
  id          VARCHAR(36)  NOT NULL,
  question_id VARCHAR(36)  NOT NULL,
  position    TINYINT UNSIGNED NOT NULL,
  body        VARCHAR(500) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_option_position (question_id, position),
  CONSTRAINT fk_options_question FOREIGN KEY (question_id) REFERENCES quiz_questions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per student attempt. This is also the instructor's gradebook row:
-- the mobile Submission type is quiz-only, so assignment work is graded
-- through assignment_submissions instead (SCHEMA-AUDIT.md, finding 13).
CREATE TABLE quiz_attempts (
  id              VARCHAR(36)   NOT NULL,
  quiz_id         VARCHAR(36)   NOT NULL,
  student_id      VARCHAR(36)   NOT NULL,
  attempt_no      TINYINT UNSIGNED NOT NULL DEFAULT 1,
  started_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at    DATETIME      DEFAULT NULL,
  -- Auto-graded items are scored on submit; an essay leaves score NULL until
  -- the instructor grades it, while max_score already counts its points.
  score           DECIMAL(6,2)  DEFAULT NULL,
  max_score       DECIMAL(6,2)  NOT NULL DEFAULT 0,
  graded_at       DATETIME      DEFAULT NULL,
  graded_by       VARCHAR(36)   DEFAULT NULL,
  feedback        VARCHAR(2000) NOT NULL DEFAULT '',
  idempotency_key VARCHAR(64)   DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_attempt (quiz_id, student_id, attempt_no),
  KEY ix_attempts_student (student_id, submitted_at),
  KEY ix_attempts_grading (graded_at, submitted_at),
  CONSTRAINT fk_attempts_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes (id) ON DELETE CASCADE,
  CONSTRAINT fk_attempts_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_attempts_grader FOREIGN KEY (graded_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE quiz_answers (
  id             VARCHAR(36)  NOT NULL,
  attempt_id     VARCHAR(36)  NOT NULL,
  question_id    VARCHAR(36)  NOT NULL,
  -- QuizAnswer.response is string | number | null: an index for
  -- multiple_choice, text for identification/essay.
  response_index TINYINT      DEFAULT NULL,
  response_text  TEXT         DEFAULT NULL,
  is_correct     TINYINT(1)   DEFAULT NULL,           -- NULL = not auto-gradable (essay)
  awarded_points DECIMAL(6,2) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_answer_attempt_question (attempt_id, question_id),
  KEY ix_answers_question (question_id),
  CONSTRAINT fk_answers_attempt FOREIGN KEY (attempt_id) REFERENCES quiz_attempts (id) ON DELETE CASCADE,
  CONSTRAINT fk_answers_question FOREIGN KEY (question_id) REFERENCES quiz_questions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
--  8. STUDENT TASKS AND PLANNER
-- ============================================================================

-- GET /student/tasks is DERIVED: every assignment and published quiz of every
-- class the student is enrolled in, with done = "a submission exists".
-- This table stores only the manual tick for an item with no submission
-- behind it; toggling a task that a real submission already completed is 409.
CREATE TABLE student_task_overrides (
  id         VARCHAR(36) NOT NULL,
  student_id VARCHAR(36) NOT NULL,
  kind       ENUM('assignment','quiz') NOT NULL,
  ref_id     VARCHAR(36) NOT NULL,                    -- assignments.id or quizzes.id
  done       TINYINT(1)  NOT NULL DEFAULT 0,
  updated_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_task_override (student_id, kind, ref_id),
  CONSTRAINT fk_task_override_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The AI study plan, one row per student per week (the mock keeps a single
-- mutable week; the real one is keyed by week_start).
CREATE TABLE planner_weeks (
  id           VARCHAR(36) NOT NULL,
  student_id   VARCHAR(36) NOT NULL,
  week_start   DATE        NOT NULL,                  -- Monday
  generated_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_planner_week (student_id, week_start),
  CONSTRAINT fk_planner_week_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE planner_blocks (
  id             VARCHAR(36)  NOT NULL,
  week_id        VARCHAR(36)  NOT NULL,
  day_date       DATE         NOT NULL,
  start_hour     TINYINT UNSIGNED NOT NULL,           -- 0..23, the grid is hour-aligned
  duration_hours TINYINT UNSIGNED NOT NULL DEFAULT 1,
  title          VARCHAR(140) NOT NULL,
  task_kind      ENUM('assignment','quiz') DEFAULT NULL,  -- what the block reviews, if anything
  task_ref_id    VARCHAR(36)  DEFAULT NULL,
  done           TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY ix_blocks_week (week_id, day_date, start_hour),
  CONSTRAINT fk_blocks_week FOREIGN KEY (week_id) REFERENCES planner_weeks (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Exam dates the student adds by hand. They survive a regenerate, so they
-- hang off the student, not the week.
CREATE TABLE planner_exams (
  id         VARCHAR(36)  NOT NULL,
  student_id VARCHAR(36)  NOT NULL,
  title      VARCHAR(140) NOT NULL,
  exam_date  DATE         NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_exams_student (student_id, exam_date),
  CONSTRAINT fk_exams_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
--  9. NOTIFICATIONS (one table, all three roles)
-- ============================================================================

-- The mobile feed and the admin inbox are the same thing with different
-- categories, so they share a table: GET /notifications filters by the
-- caller's id, and the admin's unread_notifications badge is
--   SELECT COUNT(*) WHERE user_id = <admin> AND read_at IS NULL
-- over these same rows - never a separately maintained counter.
--
-- icon and tone are NOT stored: the mobile NotificationItem carries UI tokens
-- ("megaphone-outline", "primary") that the client derives from `kind`
-- (SCHEMA-AUDIT.md, finding 16).
CREATE TABLE notifications (
  id          VARCHAR(36)  NOT NULL,
  user_id     VARCHAR(36)  NOT NULL,
  kind        ENUM(
                'notice','quiz','grade','lesson','class','ai','reminder',  -- mobile tags
                'job','storage','security'                                 -- admin inbox types
              ) NOT NULL,
  title       VARCHAR(140) NOT NULL,
  body        VARCHAR(500) NOT NULL DEFAULT '',       -- the mobile "meta" line / the admin "message"
  link_route  VARCHAR(120) DEFAULT NULL,              -- deep link, e.g. '/student/quiz-detail'
  link_params JSON         DEFAULT NULL,              -- e.g. {"classId":"it321","quizId":"qz1"}
  read_at     DATETIME     DEFAULT NULL,              -- NULL = unread
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_notifications_user (user_id, read_at, created_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
--  10. PLATFORM ANNOUNCEMENTS (the admin's only create endpoint)
-- ============================================================================

-- Campus-wide notices from /announcements. Separate from a class's own
-- announcements (section 4), which instructors write.
-- Caps here are the admin client's LIMITS: title 140, body 4000
-- (SCHEMA-AUDIT.md, finding 20 - the two clients cap announcements differently).
CREATE TABLE platform_announcements (
  id           VARCHAR(36)   NOT NULL,
  author_id    VARCHAR(36)   DEFAULT NULL,            -- the admin who posted it
  title        VARCHAR(140)  NOT NULL,
  body         VARCHAR(4000) NOT NULL,
  audience     ENUM('all','students','instructors','course') NOT NULL DEFAULT 'all',
  course       ENUM('BSIT','BEED','BSBA-FM','BSBA-OM') DEFAULT NULL,  -- required iff audience = 'course'
  status       ENUM('scheduled','published') NOT NULL DEFAULT 'published',
  scheduled_at DATETIME      DEFAULT NULL,            -- future -> 'scheduled'; NULL -> publish now
  published_at DATETIME      DEFAULT NULL,            -- set server-side, never by the client
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at   DATETIME      DEFAULT NULL,
  PRIMARY KEY (id),
  KEY ix_platform_ann_status (status, scheduled_at),
  KEY ix_platform_ann_audience (audience, course),
  CONSTRAINT fk_platform_ann_author FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
--  11. AI
-- ============================================================================

-- One row per AI call. Everything the admin's /ai and /dashboard show is an
-- aggregate over this table: requests_trend, usage_by_feature, feature_health
-- (AVG latency, error rate), quota usage, and a user profile's ai_usage.
CREATE TABLE ai_requests (
  id          VARCHAR(36)  NOT NULL,
  user_id     VARCHAR(36)  DEFAULT NULL,
  feature     ENUM('summarizer','planner','quiz_synthesizer','chat','transcription') NOT NULL,
  status      ENUM('ok','error','timeout') NOT NULL DEFAULT 'ok',
  latency_ms  INT UNSIGNED DEFAULT NULL,
  source_type ENUM('material','class','quiz','chat','planner') DEFAULT NULL,
  source_id   VARCHAR(36)  DEFAULT NULL,
  tokens_in   INT UNSIGNED DEFAULT NULL,
  tokens_out  INT UNSIGNED DEFAULT NULL,
  cost_usd    DECIMAL(10,4) DEFAULT NULL,
  error_code  VARCHAR(60)  DEFAULT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_ai_feature_created (feature, created_at),
  KEY ix_ai_user (user_id, created_at),
  CONSTRAINT fk_ai_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- POST /ai/chat history. The mobile assistant keeps its thread in memory
-- today; persisting it is what lets a reinstall keep the conversation.
CREATE TABLE ai_chat_messages (
  id         VARCHAR(36) NOT NULL,
  user_id    VARCHAR(36) NOT NULL,
  thread_id  VARCHAR(36) NOT NULL,                    -- one thread per role-session for now
  sender     ENUM('user','ai') NOT NULL,
  body       TEXT        NOT NULL,
  created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_chat_thread (thread_id, created_at),
  KEY ix_chat_user (user_id, created_at),
  CONSTRAINT fk_chat_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
--  12. SETTINGS, AUDIT, BACKUPS, SECURITY FINDINGS
-- ============================================================================

-- GET/PUT /api/admin/settings is a partial update per section, so one row per
-- section. The 'ai' row is the SAME object /ai's toggles read and write -
-- one source, so the two pages can never disagree.
-- These values are the server's authority for the limits both clients only
-- *display*: OTP expiry and resend, login attempts and lockout, password
-- rules, upload types and sizes (SCHEMA-AUDIT.md, findings 21-23).
CREATE TABLE settings (
  section    ENUM('term','email','security_policy','uploads','system','backup','legal','ai') NOT NULL,
  data       JSON     NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by VARCHAR(36) DEFAULT NULL,
  PRIMARY KEY (section),
  CONSTRAINT fk_settings_updater FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Written by the SERVER on every write the admin surface performs: every
-- delete, createAnnouncement, every settings save, every AI toggle, the admin
-- password change and every session revoke. actor_name is denormalized so a
-- deleted account does not blank the history.
CREATE TABLE audit_log (
  id          VARCHAR(36)  NOT NULL,
  actor_id    VARCHAR(36)  DEFAULT NULL,
  actor_name  VARCHAR(80)  NOT NULL,
  action      ENUM('create','update','delete','settings','security') NOT NULL,
  summary     VARCHAR(255) NOT NULL,
  target_type VARCHAR(40)  DEFAULT NULL,              -- 'user', 'class', 'material', 'announcement', 'session'
  target_ids  JSON         DEFAULT NULL,              -- the bulk delete's ids
  ip          VARCHAR(45)  DEFAULT NULL,
  logged_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_audit_action_at (action, logged_at),
  KEY ix_audit_at (logged_at),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- POST /settings/backup/run prepends a row; settings.backup's restore_points
-- is the newest rows of this table, not a stored array.
CREATE TABLE backup_runs (
  id          VARCHAR(36)  NOT NULL,
  started_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME     DEFAULT NULL,
  size_bytes  BIGINT UNSIGNED DEFAULT NULL,           -- the client formats "1.8 GB"
  ok          TINYINT(1)   NOT NULL DEFAULT 0,
  note        VARCHAR(255) DEFAULT NULL,              -- 'finished, 2 large video files skipped'
  triggered_by VARCHAR(36) DEFAULT NULL,              -- NULL = the schedule
  PRIMARY KEY (id),
  KEY ix_backup_started (started_at),
  CONSTRAINT fk_backup_user FOREIGN KEY (triggered_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- GET /security/vulnerabilities. Mock data in the client by design; the row
-- shape is the contract. A real implementation runs the checks on a schedule
-- and this table holds the latest run.
CREATE TABLE security_findings (
  id             VARCHAR(36)   NOT NULL,
  title          VARCHAR(140)  NOT NULL,
  category       VARCHAR(60)   NOT NULL,              -- 'Dependencies', 'CSP', 'File uploads'
  severity       ENUM('critical','high','medium','low') NOT NULL,
  description    VARCHAR(1000) NOT NULL,
  recommendation VARCHAR(1000) NOT NULL,
  detected_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at    DATETIME      DEFAULT NULL,
  PRIMARY KEY (id),
  KEY ix_findings_severity (severity, detected_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Every write the contract marks "Needs Idempotency-Key" records its key here
-- so a retried request returns the first result instead of acting twice.
CREATE TABLE idempotency_keys (
  idem_key    VARCHAR(64)  NOT NULL,
  user_id     VARCHAR(36)  NOT NULL,
  endpoint    VARCHAR(120) NOT NULL,
  status_code SMALLINT UNSIGNED DEFAULT NULL,
  response    JSON         DEFAULT NULL,              -- the first answer, replayed on a retry
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (idem_key),
  KEY ix_idem_user (user_id, created_at),
  CONSTRAINT fk_idem_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
--  13. SEED DATA
--
--  Enough for both clients to run against a real server: the mobile app's demo
--  logins and its four class ids (it321, it314, it318, ge105) are preserved, so
--  existing routes and deep links still resolve, and the admin dashboard has
--  users, classes, content, assessments, logs and an inbox to list.
--
--  Passwords are real bcrypt hashes (cost 12) of:
--    student@omsc.edu.ph     Student@123
--    instructor@omsc.edu.ph  Instructor@123
--    admin@omsu.edu.ph       Studia@2026   (username: admin)
--  Regenerate with:  php -r "echo password_hash('...', PASSWORD_ARGON2ID);"
--  and replace these before the app leaves the campus network.
-- ============================================================================

-- --- Users ------------------------------------------------------------------
-- NOTE ON THE EMAIL DOMAIN (SCHEMA-AUDIT.md, finding 1): the product domain is
-- @omsu.edu.ph, which is what the admin client enforces. The two rows below
-- marked "legacy" keep the mobile app's seeded @omsc.edu.ph demo logins working
-- after the switch to a real server. Enforce the domain on REGISTRATION only,
-- so these grandfathered rows stay usable, and delete them before production.
INSERT INTO users
  (id, role, full_name, email, username, password_hash, auth_provider, course, year_level, section, department, phone, email_verified_at, status, last_active_at, created_at) VALUES
-- the single fixed admin
('u-admin-1','admin','OMSU Administrator','admin@omsu.edu.ph','admin','$2y$12$vdSskXOIUte6G1DdPQPsc.ZCmsinRXNJXCDwQtXgwj4/F4rOQmTjq','password',NULL,NULL,NULL,NULL,NULL,'2026-01-01 00:00:00','active','2026-11-20 08:00:00','2026-01-01 00:00:00'),
-- legacy demo accounts from studia-mobile's auth-service.ts SEEDS
('u-seed-1','student','Juan Dela Cruz','student@omsc.edu.ph',NULL,'$2y$12$m/awckINxp1XVur5LW2WVukWSgN39XNvCmjuJPXU6u9h20KWrzl2m','password','BSIT','3','A',NULL,NULL,'2026-01-01 00:00:00','active','2026-11-20 07:10:00','2026-01-01 00:00:00'),
('u-seed-2','instructor','Maria Santos','instructor@omsc.edu.ph',NULL,'$2y$12$MW91RHiahqyAw1RHg.L4nuvt9d.7W2qrD1qgOAtxVc8IpXxjMjgM2','password',NULL,NULL,NULL,'IT',NULL,'2026-01-01 00:00:00','active','2026-11-20 06:40:00','2026-01-01 00:00:00'),
-- instructors
('u-ins-2','instructor','Ramon Reyes','ramon.reyes@omsu.edu.ph',NULL,NULL,'password',NULL,NULL,NULL,'IT',NULL,'2026-06-02 09:00:00','active','2026-11-19 09:20:00','2026-06-02 09:00:00'),
('u-ins-3','instructor','Ana Lim','ana.lim@omsu.edu.ph',NULL,NULL,'password',NULL,NULL,NULL,'IT',NULL,'2026-06-04 09:00:00','active','2026-11-18 14:05:00','2026-06-04 09:00:00'),
('u-ins-4','instructor','Jose Cruz','jose.cruz@omsu.edu.ph',NULL,NULL,'password',NULL,NULL,NULL,'ED',NULL,'2026-06-08 09:00:00','active','2026-11-17 10:30:00','2026-06-08 09:00:00'),
('u-ins-5','instructor','Teresa Navarro','teresa.navarro@omsu.edu.ph',NULL,NULL,'password',NULL,NULL,NULL,'FM',NULL,'2026-07-01 09:00:00','inactive','2026-10-02 11:00:00','2026-07-01 09:00:00'),
-- students (BSIT 3-A: the classmates studia-mobile seeds)
('u-stu-2','student','Ana Villanueva','ana.villanueva@omsu.edu.ph',NULL,NULL,'password','BSIT','3','A',NULL,'+639171234567','2026-08-12 09:14:00','active','2026-11-19 08:02:00','2026-08-12 09:14:00'),
('u-stu-3','student','Mark Bautista','mark.bautista@omsu.edu.ph',NULL,NULL,'password','BSIT','3','A',NULL,NULL,'2026-08-12 09:20:00','active','2026-11-19 12:40:00','2026-08-12 09:20:00'),
('u-stu-4','student','Liza Mercado','liza.mercado@omsu.edu.ph',NULL,NULL,'password','BSIT','3','A',NULL,NULL,'2026-08-13 10:05:00','active','2026-11-18 16:15:00','2026-08-13 10:05:00'),
('u-stu-5','student','Carlo Dizon','carlo.dizon@omsu.edu.ph',NULL,NULL,'password','BSIT','3','A',NULL,NULL,'2026-08-13 10:40:00','active','2026-11-17 09:00:00','2026-08-13 10:40:00'),
('u-stu-6','student','Rica Santiago','rica.santiago@omsu.edu.ph',NULL,NULL,'password','BSIT','3','A',NULL,NULL,'2026-08-14 08:30:00','active','2026-11-20 07:45:00','2026-08-14 08:30:00'),
-- students from the other courses, so the admin charts and filters have data
('u-stu-7','student','Ella Fernandez','ella.fernandez@omsu.edu.ph',NULL,NULL,'password','BEED','1','A',NULL,NULL,'2026-09-01 09:00:00','inactive','2026-10-28 13:00:00','2026-09-01 09:00:00'),
('u-stu-8','student','Paolo Aquino','paolo.aquino@omsu.edu.ph',NULL,NULL,'password','BSBA-FM','2','B',NULL,NULL,'2026-09-03 09:00:00','active','2026-11-16 15:20:00','2026-09-03 09:00:00'),
('u-stu-9','student','Grace Torres','grace.torres@omsu.edu.ph',NULL,NULL,'password','BSBA-OM','4','A',NULL,NULL,'2026-09-05 09:00:00','active','2026-11-15 10:10:00','2026-09-05 09:00:00'),
-- an instructor still waiting for approval (REQUIRE_INSTRUCTOR_APPROVAL)
('u-ins-6','instructor','Victor Ocampo','victor.ocampo@omsu.edu.ph',NULL,NULL,'password',NULL,NULL,NULL,'OM',NULL,NULL,'pending_approval',NULL,'2026-11-18 11:00:00');

-- --- Classes ----------------------------------------------------------------
-- The four ids studia-mobile already routes to, plus the instructor-only class
-- and one archived class. it314's section is BSIT 3-A here: the student and
-- instructor directories disagreed about it (SCHEMA-AUDIT.md, finding 6) and
-- one class row can only have one section.
INSERT INTO classes
  (id, subject_code, title, instructor_id, course, year_level, section, join_code, school_year, semester, archived, created_at) VALUES
('it321','IT 321','Information Assurance and Security','u-seed-2','BSIT','3','A','K7P9QX','2026-2027','1st Semester',0,'2026-08-11 08:00:00'),
('it314','IT 314','Web Systems and Technologies','u-ins-2','BSIT','3','A','M2D8LA','2026-2027','1st Semester',0,'2026-08-11 08:10:00'),
('it318','IT 318','Mobile Application Development','u-ins-3','BSIT','3','A','R5T3ZB','2026-2027','1st Semester',0,'2026-08-11 08:20:00'),
('ge105','GE 105','Purposive Communication','u-ins-4','BSIT','3','A','H4F6WT','2026-2027','1st Semester',0,'2026-08-11 08:30:00'),
('it322','IT 322','Systems Integration and Architecture','u-seed-2','BSIT','4','A','W9C4NH','2026-2027','1st Semester',0,'2026-08-11 08:40:00'),
('cls-arch-1','ED 101','Child Development','u-ins-4','BEED','1','A','T3B8KM','2025-2026','2nd Semester',1,'2026-01-12 08:00:00');

-- --- Enrolments -------------------------------------------------------------
-- progress_pct is NOT invented here: every value below is exactly
--   completed materials / materials of the class
-- over the material_views rows seeded further down. Verify with the query in
-- SCHEMA-AUDIT.md, finding 14 - cached and computed must match.
INSERT INTO class_enrollments (id, class_id, student_id, joined_at, progress_pct) VALUES
('enr-1','it321','u-seed-1','2026-08-15 09:00:00',75),
('enr-2','it314','u-seed-1','2026-08-15 09:05:00',50),
('enr-3','it318','u-seed-1','2026-08-15 09:10:00',25),
('enr-4','ge105','u-seed-1','2026-08-15 09:15:00',75),
('enr-5','it321','u-stu-2','2026-08-15 10:00:00',100),
('enr-6','it321','u-stu-3','2026-08-15 10:05:00',50),
('enr-7','it321','u-stu-4','2026-08-15 10:10:00',50),
('enr-8','it321','u-stu-5','2026-08-15 10:15:00',25),
('enr-9','it321','u-stu-6','2026-08-15 10:20:00',75),
('enr-10','it314','u-stu-2','2026-08-15 11:00:00',50),
('enr-11','it314','u-stu-3','2026-08-15 11:05:00',25),
('enr-12','it318','u-stu-2','2026-08-15 11:30:00',25),
('enr-13','ge105','u-stu-6','2026-08-15 11:45:00',75),
('enr-14','cls-arch-1','u-stu-7','2026-01-20 09:00:00',100);

-- --- Files ------------------------------------------------------------------
INSERT INTO files
  (id, original_name, stored_name, kind, extension, mime_type, size_bytes, scanned_at, scan_result, uploaded_by, created_at) VALUES
('f-l1-vid','Lesson3_Network_Security.mp4','f-l1-vid.mp4','video','mp4','video/mp4',214958080,'2026-11-18 10:05:00','clean','u-seed-2','2026-11-18 10:00:00'),
('f-l1-pdf','Lesson3_Slides.pdf','f-l1-pdf.pdf','pdf','pdf','application/pdf',2516582,'2026-11-18 10:06:00','clean','u-seed-2','2026-11-18 10:00:00'),
('f-l2-pdf','CIA_Triad_Handout.pdf','f-l2-pdf.pdf','pdf','pdf','application/pdf',1887436,'2026-11-10 09:05:00','clean','u-seed-2','2026-11-10 09:00:00'),
('f-l3-slide','REST_API_Basics.pptx','f-l3-slide.pptx','slide','pptx','application/vnd.openxmlformats-officedocument.presentationml.presentation',4404019,'2026-11-12 14:05:00','clean','u-ins-2','2026-11-12 14:00:00'),
('f-l4-vid','Expo_Router_Walkthrough.mp4','f-l4-vid.mp4','video','mp4','video/mp4',198180864,NULL,NULL,'u-ins-3','2026-11-19 16:00:00'),
('f-asg1','Exercise_Brief.pdf','f-asg1.pdf','pdf','pdf','application/pdf',430080,'2026-11-15 08:05:00','clean','u-seed-2','2026-11-15 08:00:00'),
('f-sub1','Firewall_Rules_JuanDelaCruz.pdf','f-sub1.pdf','pdf','pdf','application/pdf',655360,'2026-11-19 20:05:00','clean','u-seed-1','2026-11-19 20:00:00'),
-- the remaining lesson files, so the admin content list has something to sort by size
('f-l6','Firewalls_And_IDS.pptx','f-l6.pptx','slide','pptx','application/vnd.openxmlformats-officedocument.presentationml.presentation',5872025,'2026-11-05 09:05:00','clean','u-seed-2','2026-11-05 09:00:00'),
('f-l7','Access_Control_Models.mp4','f-l7.mp4','video','mp4','video/mp4',167772160,'2026-11-02 09:05:00','clean','u-seed-2','2026-11-02 09:00:00'),
('f-l8','HTTP_Status_Codes.pdf','f-l8.pdf','pdf','pdf','application/pdf',1310720,'2026-11-06 14:05:00','clean','u-ins-2','2026-11-06 14:00:00'),
('f-l9','Auth_And_Sessions.mp4','f-l9.mp4','video','mp4','video/mp4',186646528,'2026-11-03 14:05:00','clean','u-ins-2','2026-11-03 14:00:00'),
('f-l10','Deploying_A_REST_API.pptx','f-l10.pptx','slide','pptx','application/vnd.openxmlformats-officedocument.presentationml.presentation',3774873,'2026-10-29 14:05:00','clean','u-ins-2','2026-10-29 14:00:00'),
('f-l11','Layout_And_Styling.pdf','f-l11.pdf','pdf','pdf','application/pdf',2097152,'2026-11-07 16:05:00','clean','u-ins-3','2026-11-07 16:00:00'),
('f-l12','Lists_And_Performance.pptx','f-l12.pptx','slide','pptx','application/vnd.openxmlformats-officedocument.presentationml.presentation',4194304,'2026-11-04 16:05:00','clean','u-ins-3','2026-11-04 16:00:00'),
('f-l13','Native_Modules_Overview.mp4','f-l13.mp4','video','mp4','video/mp4',231735296,'2026-10-30 16:05:00','clean','u-ins-3','2026-10-30 16:00:00'),
('f-l14','Audience_Analysis.pdf','f-l14.pdf','pdf','pdf','application/pdf',1572864,'2026-11-08 11:05:00','clean','u-ins-4','2026-11-08 11:00:00'),
('f-l15','Writing_For_The_Workplace.pptx','f-l15.pptx','slide','pptx','application/vnd.openxmlformats-officedocument.presentationml.presentation',3355443,'2026-11-05 11:05:00','clean','u-ins-4','2026-11-05 11:00:00'),
('f-l16','Oral_Presentation_Skills.mp4','f-l16.mp4','video','mp4','video/mp4',155189248,'2026-11-01 11:05:00','clean','u-ins-4','2026-11-01 11:00:00'),
('f-l17','Stages_Of_Child_Development.pdf','f-l17.pdf','pdf','pdf','application/pdf',1048576,'2026-01-15 08:05:00','clean','u-ins-4','2026-01-15 08:00:00');

-- --- Materials (= the student's lessons, = the admin's content) -------------
INSERT INTO materials
  (id, class_id, title, kind, file_id, duration_sec, processing, processing_error, attempt_count, owner_id, posted_at) VALUES
('l1','it321','Lesson 3: Network Security Basics','video','f-l1-vid',1104,'ready',NULL,1,'u-seed-2','2026-11-18 10:00:00'),
('l2','it321','Lesson 2: The CIA Triad','pdf','f-l2-pdf',NULL,'ready',NULL,1,'u-seed-2','2026-11-10 09:00:00'),
('l3','it314','Lesson 1: REST API Basics','slide','f-l3-slide',NULL,'ready',NULL,1,'u-ins-2','2026-11-12 14:00:00'),
('l4','it318','Lesson 1: Expo Router Walkthrough','video','f-l4-vid',1530,'processing',NULL,1,'u-ins-3','2026-11-19 16:00:00'),
('l5','ge105','Lesson 1: Audience and Purpose','pdf',NULL,NULL,'failed','Transcription timed out after 3 attempts.',3,'u-ins-4','2026-11-14 11:00:00'),
-- Four materials per active class, so progress moves in sensible 25% steps.
('l6','it321','Lesson 4: Firewalls and IDS in Practice','slide','f-l6',NULL,'ready',NULL,1,'u-seed-2','2026-11-05 09:00:00'),
('l7','it321','Lesson 5: Access Control Models','video','f-l7',900,'ready',NULL,1,'u-seed-2','2026-11-02 09:00:00'),
('l8','it314','Lesson 2: HTTP Status Codes','pdf','f-l8',NULL,'ready',NULL,1,'u-ins-2','2026-11-06 14:00:00'),
('l9','it314','Lesson 3: Authentication and Sessions','video','f-l9',1320,'ready',NULL,1,'u-ins-2','2026-11-03 14:00:00'),
('l10','it314','Lesson 4: Deploying a REST API','slide','f-l10',NULL,'ready',NULL,1,'u-ins-2','2026-10-29 14:00:00'),
('l11','it318','Lesson 2: Layout and Styling','pdf','f-l11',NULL,'ready',NULL,1,'u-ins-3','2026-11-07 16:00:00'),
('l12','it318','Lesson 3: Lists and Performance','slide','f-l12',NULL,'ready',NULL,1,'u-ins-3','2026-11-04 16:00:00'),
('l13','it318','Lesson 4: Native Modules Overview','video','f-l13',1680,'ready',NULL,1,'u-ins-3','2026-10-30 16:00:00'),
('l14','ge105','Lesson 2: Audience Analysis','pdf','f-l14',NULL,'ready',NULL,1,'u-ins-4','2026-11-08 11:00:00'),
('l15','ge105','Lesson 3: Writing for the Workplace','slide','f-l15',NULL,'ready',NULL,1,'u-ins-4','2026-11-05 11:00:00'),
('l16','ge105','Lesson 4: Oral Presentation Skills','video','f-l16',1260,'ready',NULL,1,'u-ins-4','2026-11-01 11:00:00'),
('l17','cls-arch-1','Lesson 1: Stages of Child Development','pdf','f-l17',NULL,'ready',NULL,1,'u-ins-4','2026-01-15 08:00:00');

INSERT INTO material_transcript_lines (id, material_id, start_sec, body) VALUES
('t1','l1',0,'Today we cover network security basics: firewalls, intrusion detection, and the CIA triad.'),
('t2','l1',42,'Confidentiality means only authorized people can read the data.'),
('t3','l1',95,'Integrity means the data was not changed without permission.'),
('t4','l1',150,'Availability means the data and systems are reachable when needed.'),
('t5','l1',210,'A firewall filters traffic using a set of rules based on IP, port and protocol.'),
('t6','l1',275,'An IDS watches traffic for suspicious patterns and raises an alert.');

INSERT INTO material_objectives (id, material_id, position, body) VALUES
('obj-1','l1',0,'Explain each element of the CIA triad in context.'),
('obj-2','l1',1,'Describe how a firewall filters traffic by IP, port and protocol.'),
('obj-3','l1',2,'Distinguish detection (IDS) from prevention (firewall).'),
('obj-4','l1',3,'Justify defense in depth for a small office network.');

INSERT INTO material_summaries (id, material_id, mode, tldr, bullets, source_version, generated_at) VALUES
('sum-1','l1','tldr','Firewalls and IDS enforce the CIA triad through layered, rule-based defense.',NULL,1,'2026-11-18 10:30:00'),
('sum-2','l1','bullets',NULL,'["Confidentiality, integrity, availability (the CIA triad) guide every security decision.","Firewalls filter traffic by IP, port and protocol rules.","An IDS detects suspicious activity and raises alerts.","Defense in depth: layer multiple controls so one failure is not catastrophic."]',1,'2026-11-18 10:30:00');

INSERT INTO material_views (id, material_id, student_id, first_seen_at, last_seen_at, watch_seconds, completed_at, view_count) VALUES
('mv-1','l1','u-seed-1','2026-11-18 19:00:00','2026-11-18 19:20:00',1050,'2026-11-18 19:20:00',2),
('mv-2','l1','u-stu-2','2026-11-18 20:00:00','2026-11-18 20:19:00',1104,'2026-11-18 20:19:00',1),
('mv-3','l1','u-stu-3','2026-11-19 08:00:00','2026-11-19 08:06:00',360,NULL,1),
('mv-4','l2','u-seed-1','2026-11-11 07:30:00','2026-11-11 07:48:00',0,'2026-11-11 07:48:00',1),
('mv-5','l2','u-stu-4','2026-11-12 13:00:00','2026-11-12 13:10:00',0,'2026-11-12 13:10:00',1),
('mv-6','l3','u-seed-1','2026-11-13 09:00:00','2026-11-13 09:25:00',0,'2026-11-13 09:25:00',1),
-- The rest of the views, chosen so each enrolment's progress_pct above is
-- exactly what the formula computes. A PDF or slide counts as completed when
-- it is opened; a video needs ~90% watched, so a short watch stays incomplete.
('mv-7','l6','u-seed-1','2026-11-06 20:00:00','2026-11-06 20:14:00',0,'2026-11-06 20:14:00',1),
('mv-8','l2','u-stu-2','2026-11-11 09:00:00','2026-11-11 09:12:00',0,'2026-11-11 09:12:00',1),
('mv-9','l6','u-stu-2','2026-11-06 10:00:00','2026-11-06 10:15:00',0,'2026-11-06 10:15:00',1),
('mv-10','l7','u-stu-2','2026-11-03 10:00:00','2026-11-03 10:16:00',880,'2026-11-03 10:16:00',1),
('mv-11','l2','u-stu-3','2026-11-11 14:00:00','2026-11-11 14:09:00',0,'2026-11-11 14:09:00',1),
('mv-12','l6','u-stu-3','2026-11-07 15:00:00','2026-11-07 15:11:00',0,'2026-11-07 15:11:00',1),
('mv-13','l7','u-stu-4','2026-11-03 19:00:00','2026-11-03 19:15:00',870,'2026-11-03 19:15:00',1),
('mv-14','l1','u-stu-5','2026-11-19 21:00:00','2026-11-19 21:19:00',1090,'2026-11-19 21:19:00',1),
('mv-15','l1','u-stu-6','2026-11-18 21:00:00','2026-11-18 21:19:00',1100,'2026-11-18 21:19:00',1),
('mv-16','l2','u-stu-6','2026-11-11 10:00:00','2026-11-11 10:08:00',0,'2026-11-11 10:08:00',1),
('mv-17','l6','u-stu-6','2026-11-06 16:00:00','2026-11-06 16:13:00',0,'2026-11-06 16:13:00',1),
('mv-18','l8','u-seed-1','2026-11-07 08:00:00','2026-11-07 08:10:00',0,'2026-11-07 08:10:00',1),
('mv-19','l3','u-stu-2','2026-11-13 11:00:00','2026-11-13 11:20:00',0,'2026-11-13 11:20:00',1),
('mv-20','l9','u-stu-2','2026-11-04 11:00:00','2026-11-04 11:23:00',1290,'2026-11-04 11:23:00',1),
('mv-21','l3','u-stu-3','2026-11-13 16:00:00','2026-11-13 16:18:00',0,'2026-11-13 16:18:00',1),
('mv-22','l11','u-seed-1','2026-11-08 07:30:00','2026-11-08 07:41:00',0,'2026-11-08 07:41:00',1),
('mv-23','l12','u-stu-2','2026-11-05 12:00:00','2026-11-05 12:14:00',0,'2026-11-05 12:14:00',1),
('mv-24','l13','u-stu-2','2026-11-02 12:00:00','2026-11-02 12:08:00',420,NULL,1),
('mv-25','l14','u-seed-1','2026-11-09 20:00:00','2026-11-09 20:12:00',0,'2026-11-09 20:12:00',1),
('mv-26','l15','u-seed-1','2026-11-06 20:30:00','2026-11-06 20:44:00',0,'2026-11-06 20:44:00',1),
('mv-27','l16','u-seed-1','2026-11-02 20:00:00','2026-11-02 20:21:00',1230,'2026-11-02 20:21:00',1),
('mv-28','l14','u-stu-6','2026-11-09 09:00:00','2026-11-09 09:11:00',0,'2026-11-09 09:11:00',1),
('mv-29','l15','u-stu-6','2026-11-06 09:00:00','2026-11-06 09:13:00',0,'2026-11-06 09:13:00',1),
('mv-30','l16','u-stu-6','2026-11-02 09:00:00','2026-11-02 09:20:00',1210,'2026-11-02 09:20:00',1),
('mv-31','l17','u-stu-7','2026-01-21 10:00:00','2026-01-21 10:15:00',0,'2026-01-21 10:15:00',1);

-- --- Assignments ------------------------------------------------------------
INSERT INTO assignments
  (id, class_id, title, instructions, due_at, points, allow_late, created_by, created_at) VALUES
('as1','it321','Firewall Rule Design Exercise','Design an iptables-style rule set for a small office network (1 server, 10 workstations). Submit as a PDF.','2026-11-22 17:00:00',20,1,'u-seed-2','2026-11-15 08:00:00'),
('as2','it321','CIA Triad Reflection Paper','Write a one-page reflection on how the CIA triad applies to a system you use daily. Late submissions are not accepted.','2026-11-19 17:00:00',10,0,'u-seed-2','2026-11-08 08:00:00'),
('as3','it314','REST Endpoint Design','Design the endpoints for a small library catalogue and document the request and response shapes.','2026-11-25 17:00:00',30,1,'u-ins-2','2026-11-13 09:00:00'),
('as4','it318','Expo Router Navigation Map','Draw the route tree of a three-tab app and explain where each screen file lives.','2026-11-27 17:00:00',25,1,'u-ins-3','2026-11-17 09:00:00');

INSERT INTO assignment_attachments (assignment_id, file_id, position) VALUES ('as1','f-asg1',0);

-- 'assigned' is the absence of a row: as2/as3/as4 have none for u-seed-1.
INSERT INTO assignment_submissions
  (id, assignment_id, student_id, status, submission_text, file_id, submitted_at, score, feedback, graded_at, graded_by, created_at) VALUES
('asub-1','as1','u-seed-1','submitted','Rule set attached, with a short note on the default-deny policy.','f-sub1','2026-11-19 20:00:00',NULL,NULL,NULL,NULL,'2026-11-19 20:00:00'),
('asub-2','as1','u-stu-2','graded','See attached design.',NULL,'2026-11-18 21:10:00',18.00,'Solid default-deny ordering. Tighten the outbound rules.','2026-11-19 09:00:00','u-seed-2','2026-11-18 21:10:00'),
('asub-3','as2','u-stu-3','late','Reflection submitted after the deadline.',NULL,'2026-11-20 06:30:00',NULL,NULL,NULL,NULL,'2026-11-20 06:30:00'),
('asub-4','as1','u-stu-4','draft','Draft notes only, not turned in yet.',NULL,NULL,NULL,NULL,NULL,NULL,'2026-11-19 18:00:00');

-- --- Quizzes ----------------------------------------------------------------
INSERT INTO quizzes
  (id, class_id, title, status, source, time_limit_min, due_at, max_attempts, source_material_id, created_by, created_at, published_at) VALUES
('quiz_it321_1','it321','Quiz 1: CIA Triad','published','manual',10,'2026-11-08 17:00:00',1,'l2','u-seed-2','2026-11-02 08:00:00','2026-11-02 08:30:00'),
('quiz_it321_2','it321','Quiz 2: Network Security','published','ai',15,'2026-11-21 17:00:00',1,'l1','u-seed-2','2026-11-18 11:00:00','2026-11-18 11:15:00'),
('quiz_it314_1','it314','Quiz 1: REST APIs','published','manual',15,'2026-11-14 17:00:00',1,'l3','u-ins-2','2026-11-10 09:00:00','2026-11-10 09:30:00'),
('quiz_it318_1','it318','Quiz 1: Navigation Basics','draft','ai',10,NULL,1,'l4','u-ins-3','2026-11-19 17:00:00',NULL);

INSERT INTO quiz_questions
  (id, quiz_id, position, type, prompt, correct_index, correct_answer, bloom, difficulty, points, rationale, concept) VALUES
('q1','quiz_it321_2',0,'multiple_choice','Which part of the CIA triad ensures data is reachable when needed?',2,NULL,'Remember','Easy',2,'Availability specifically covers systems and data being reachable to authorized users.','CIA Triad'),
('q2','quiz_it321_2',1,'multiple_choice','A device that filters traffic using IP, port and protocol rules is a:',1,NULL,'Understand','Easy',2,'Firewalls apply rule sets to allow or block traffic by IP, port and protocol.','Firewalls'),
('q3','quiz_it321_2',2,'identification','Name the control that watches traffic for suspicious patterns and raises an alert.',NULL,'IDS','Apply','Medium',3,'An intrusion detection system reports; it does not block.','Intrusion Detection'),
('q4','quiz_it321_2',3,'essay','Explain why defense in depth is recommended for a small office network.',NULL,NULL,'Evaluate','Hard',5,NULL,'Defense in Depth'),
('q5','quiz_it321_1',0,'multiple_choice','Which element of the CIA triad is broken when data is altered without permission?',1,NULL,'Remember','Easy',2,'Integrity is the guarantee that data has not been changed.','CIA Triad'),
('q6','quiz_it321_1',1,'identification','Which element of the CIA triad keeps data readable only by authorized people?',NULL,'Confidentiality','Understand','Easy',2,'Confidentiality restricts who can read the data.','CIA Triad'),
('q7','quiz_it314_1',0,'multiple_choice','Which HTTP method should be side-effect free?',0,NULL,'Understand','Easy',2,'GET is safe and may be retried, so it must not change state.','HTTP Methods'),
('q8','quiz_it314_1',1,'identification','Which status code should a REST API return when a resource does not exist?',NULL,'404','Apply','Medium',3,'404 Not Found, and it must not leak whether the caller merely lacks access.','HTTP Status Codes');

INSERT INTO quiz_options (id, question_id, position, body) VALUES
('o1','q1',0,'Confidentiality'),('o2','q1',1,'Integrity'),('o3','q1',2,'Availability'),('o4','q1',3,'Authentication'),
('o5','q2',0,'IDS'),('o6','q2',1,'Firewall'),('o7','q2',2,'Proxy cache'),('o8','q2',3,'Load balancer'),
('o9','q5',0,'Confidentiality'),('o10','q5',1,'Integrity'),('o11','q5',2,'Availability'),('o12','q5',3,'Non-repudiation'),
('o13','q7',0,'GET'),('o14','q7',1,'POST'),('o15','q7',2,'PATCH'),('o16','q7',3,'DELETE');

-- Attempts: three awaiting grading on quiz 2 (it has an essay item), three
-- already graded on quiz 1. max_score counts the essay's points even while
-- score is NULL, which is exactly how the mobile grading screen reads them.
INSERT INTO quiz_attempts
  (id, quiz_id, student_id, attempt_no, started_at, submitted_at, score, max_score, graded_at, graded_by, feedback) VALUES
('isub_it321_2_0','quiz_it321_2','u-seed-1',1,'2026-11-19 19:00:00','2026-11-19 19:18:00',NULL,12.00,NULL,NULL,''),
('isub_it321_2_1','quiz_it321_2','u-stu-2',1,'2026-11-19 20:00:00','2026-11-19 20:16:00',NULL,12.00,NULL,NULL,''),
('isub_it321_2_2','quiz_it321_2','u-stu-3',1,'2026-11-20 06:00:00','2026-11-20 06:14:00',NULL,12.00,NULL,NULL,''),
('ig1','quiz_it321_1','u-stu-4',1,'2026-11-08 10:00:00','2026-11-08 10:09:00',4.00,4.00,'2026-11-09 09:00:00','u-seed-2','Perfect.'),
('ig2','quiz_it321_1','u-stu-5',1,'2026-11-08 10:10:00','2026-11-08 10:21:00',2.00,4.00,'2026-11-09 09:05:00','u-seed-2','Review integrity vs availability.'),
('ig3','quiz_it321_1','u-stu-6',1,'2026-11-08 10:20:00','2026-11-08 10:28:00',4.00,4.00,'2026-11-09 09:10:00','u-seed-2',''),
('ig4','quiz_it314_1','u-seed-1',1,'2026-11-14 11:00:00','2026-11-14 11:12:00',5.00,5.00,'2026-11-15 08:00:00','u-ins-2','Good.');

INSERT INTO quiz_answers (id, attempt_id, question_id, response_index, response_text, is_correct, awarded_points) VALUES
('qa-1','isub_it321_2_0','q1',2,NULL,1,2.00),
('qa-2','isub_it321_2_0','q2',1,NULL,1,2.00),
('qa-3','isub_it321_2_0','q3',NULL,'IDS',1,3.00),
('qa-4','isub_it321_2_0','q4',NULL,'One control can fail, so layered controls limit the damage.',NULL,NULL),
('qa-5','isub_it321_2_1','q1',2,NULL,1,2.00),
('qa-6','isub_it321_2_1','q2',0,NULL,0,0.00),
('qa-7','isub_it321_2_1','q3',NULL,'Intrusion detection system',1,3.00),
('qa-8','isub_it321_2_1','q4',NULL,'Phishing is reduced with user training and multi-factor authentication.',NULL,NULL),
('qa-9','isub_it321_2_2','q1',1,NULL,0,0.00),
('qa-10','isub_it321_2_2','q2',1,NULL,1,2.00),
('qa-11','isub_it321_2_2','q3',NULL,'firewall',0,0.00),
('qa-12','isub_it321_2_2','q4',NULL,'Confidentiality, integrity and availability: keep data private, correct, and reachable.',NULL,NULL),
('qa-13','ig1','q5',1,NULL,1,2.00),
('qa-14','ig1','q6',NULL,'Confidentiality',1,2.00),
('qa-15','ig2','q5',2,NULL,0,0.00),
('qa-16','ig2','q6',NULL,'Confidentiality',1,2.00),
('qa-17','ig3','q5',1,NULL,1,2.00),
('qa-18','ig3','q6',NULL,'confidentiality',1,2.00),
('qa-19','ig4','q7',0,NULL,1,2.00),
('qa-20','ig4','q8',NULL,'404',1,3.00);

-- --- Class announcements and comments --------------------------------------
INSERT INTO announcements (id, class_id, author_id, title, body, pinned, posted_at) VALUES
('ann-1','it321','u-seed-2','Midterm exam schedule','Midterm exams run November 24 to 28. Bring your own calculator; no phones on the desk.',1,'2026-11-14 09:00:00'),
('ann-2','it321','u-seed-2','Lesson 3 is up','The network security video and its slides are posted. Watch before Friday.',0,'2026-11-18 10:15:00'),
('ann-3','it314','u-ins-2','Project groups','Group lists are final. Message me today if your name is missing.',0,'2026-11-16 13:00:00');

INSERT INTO announcement_comments (id, announcement_id, author_id, body, posted_at) VALUES
('cmt-1','ann-1','u-stu-2','Is the exam open notes?','2026-11-14 10:12:00'),
('cmt-2','ann-1','u-seed-2','One handwritten page is allowed.','2026-11-14 10:40:00'),
('cmt-3','ann-1','u-seed-1','Noted, thank you po.','2026-11-14 11:05:00'),
('cmt-4','ann-2','u-stu-3','The video stops at 12:00 for me.','2026-11-18 12:00:00');

-- --- Platform announcements (admin) ----------------------------------------
INSERT INTO platform_announcements
  (id, author_id, title, body, audience, course, status, scheduled_at, published_at, created_at) VALUES
('sysann-1','u-admin-1','Midterm examination schedule','Midterm exams run November 24-28. Check your class announcements for room assignments.','all',NULL,'published',NULL,'2026-11-18 08:00:00','2026-11-18 08:00:00'),
('sysann-2','u-admin-1','Server maintenance window','STUDIA will be briefly unavailable on Nov 23, 1:00-2:00 AM for scheduled maintenance.','all',NULL,'scheduled','2026-11-23 01:00:00',NULL,'2026-11-20 10:00:00'),
('sysann-3','u-admin-1','BSIT curriculum update','BSIT students: the updated prospectus for AY 2026-2027 is now available from your adviser.','course','BSIT','published',NULL,'2026-11-14 09:00:00','2026-11-14 09:00:00');

-- --- Notifications ---------------------------------------------------------
-- Student and instructor feeds plus the admin inbox, in one table.
INSERT INTO notifications (id, user_id, kind, title, body, link_route, link_params, read_at, created_at) VALUES
('ntf-s1','u-seed-1','notice','Midterm exam schedule','IT 321 - Nov 24-28, 2026','/student/announcement-detail','{"classId":"it321","id":"ann-1"}',NULL,'2026-11-20 06:00:00'),
('ntf-s2','u-seed-1','quiz','Quiz 2 due tomorrow','IT 321 - 5:00 PM','/student/quiz-detail','{"classId":"it321","quizId":"quiz_it321_2"}',NULL,'2026-11-20 03:00:00'),
('ntf-s3','u-seed-1','grade','Quiz 1 graded','You scored 5/5','/student/quiz-result','{"classId":"it314","quizId":"quiz_it314_1"}','2026-11-19 09:00:00','2026-11-15 08:05:00'),
('ntf-s4','u-seed-1','lesson','New lesson posted','IT 321 - Lesson 3: Network Security Basics','/student/lesson-detail','{"classId":"it321","id":"l1"}','2026-11-18 19:00:00','2026-11-18 10:05:00'),
('ntf-i1','u-seed-2','class','3 submissions awaiting grading','Quiz 2: Network Security - IT 321','/instructor/grading','{"quizId":"quiz_it321_2"}',NULL,'2026-11-20 06:30:00'),
('ntf-i2','u-seed-2','ai','Quiz synthesis finished','12 questions drafted from Lesson 3','/instructor/quiz-detail','{"id":"quiz_it321_2"}','2026-11-18 11:20:00','2026-11-18 11:15:00'),
('ntf-1','u-admin-1','job','Video transcription failed','Lesson "Audience and Purpose" could not be transcribed after 3 attempts.','/notifications',NULL,NULL,'2026-11-20 08:00:00'),
('ntf-2','u-admin-1','storage','Storage at 82% capacity','Uploaded media is approaching the campus storage quota.','/settings/system',NULL,NULL,'2026-11-20 06:00:00'),
('ntf-3','u-admin-1','security','Admin login from a new device','A sign-in to the admin portal was made from an unrecognized device.','/security/sessions',NULL,NULL,'2026-11-19 21:00:00'),
('ntf-4','u-admin-1','job','AI quiz generation failed','Quiz synthesis for IT 318 timed out and was not published.','/ai',NULL,'2026-11-19 09:00:00','2026-11-18 10:00:00'),
('ntf-5','u-admin-1','storage','Nightly backup completed with warnings','The backup finished, but 2 large video files were skipped.','/settings/backup',NULL,'2026-11-18 08:00:00','2026-11-17 02:00:00'),
('ntf-6','u-admin-1','security','5 failed login attempts detected','Multiple failed admin sign-ins were blocked and temporarily locked out.','/security/login-attempts',NULL,'2026-11-17 09:30:00','2026-11-16 10:00:00');

-- --- AI usage --------------------------------------------------------------
INSERT INTO ai_requests (id, user_id, feature, status, latency_ms, source_type, source_id, cost_usd, error_code, created_at) VALUES
('air-1','u-seed-1','summarizer','ok',1180,'material','l1',0.0120,NULL,'2026-11-18 19:05:00'),
('air-2','u-seed-1','planner','ok',620,'planner',NULL,0.0080,NULL,'2026-11-19 07:00:00'),
('air-3','u-seed-1','chat','ok',760,'chat','thr-stu-1',0.0050,NULL,'2026-11-19 21:30:00'),
('air-4','u-stu-2','summarizer','ok',1320,'material','l2',0.0120,NULL,'2026-11-12 13:05:00'),
('air-5','u-stu-3','summarizer','error',4200,'material','l3',0.0000,'UPSTREAM_TIMEOUT','2026-11-13 09:40:00'),
('air-6','u-seed-2','quiz_synthesizer','ok',2050,'material','l1',0.0400,NULL,'2026-11-18 11:10:00'),
('air-7','u-ins-3','quiz_synthesizer','timeout',9800,'material','l4',0.0000,'TIMEOUT','2026-11-19 17:05:00'),
('air-8','u-seed-2','chat','ok',880,'chat','thr-ins-1',0.0050,NULL,'2026-11-19 10:00:00'),
('air-9','u-ins-3','transcription','error',31000,'material','l4',0.0000,'ASR_FAILED','2026-11-19 16:30:00'),
('air-10','u-ins-4','transcription','error',30500,'material','l5',0.0000,'ASR_FAILED','2026-11-14 11:30:00');

INSERT INTO ai_chat_messages (id, user_id, thread_id, sender, body, created_at) VALUES
('chat-1','u-seed-1','thr-stu-1','user','Quiz me on the CIA triad.','2026-11-19 21:29:00'),
('chat-2','u-seed-1','thr-stu-1','ai','Sure. Which element guarantees that data has not been altered without permission?','2026-11-19 21:30:00'),
('chat-3','u-seed-2','thr-ins-1','user','Draft three analysis-level questions from Lesson 3.','2026-11-19 09:59:00'),
('chat-4','u-seed-2','thr-ins-1','ai','Here are three Analyze-level items on firewalls, IDS placement and layered controls.','2026-11-19 10:00:00');

-- --- Settings --------------------------------------------------------------
-- The server's authority for every limit the clients only display. Column
-- names inside the JSON are snake_case, like every other payload.
INSERT INTO settings (section, data, updated_by, updated_at) VALUES
('term','{"school_year":"2026-2027","semester":"1st Semester","start_date":"2026-08-11","end_date":"2026-12-18"}','u-admin-1','2026-11-18 09:00:00'),
-- resend_seconds is 30 to match studia-mobile's OTP_RESEND_MS; the admin mock
-- said 60 (SCHEMA-AUDIT.md, finding 22).
('email','{"sender_email":"no-reply@omsu.edu.ph","otp_expiry_minutes":5,"require_otp_for_reset":true,"resend_seconds":30}','u-admin-1','2026-11-18 09:00:00'),
('security_policy','{"min_password_length":8,"require_uppercase":true,"require_lowercase":true,"require_number":true,"require_symbol":true,"max_password_length":64,"session_timeout_minutes":20,"max_login_attempts":5,"lockout_minutes":1}','u-admin-1','2026-11-18 09:00:00'),
-- The union of both clients' whitelists, with the mobile app's two size caps
-- (SCHEMA-AUDIT.md, finding 23).
('uploads','{"allowed_types":["pdf","doc","docx","ppt","pptx","mp4","mov","jpg","jpeg","png"],"max_material_size_mb":500,"max_submission_size_mb":50,"storage_quota_gb":50,"max_file_name_length":120}','u-admin-1','2026-11-18 09:00:00'),
('system','{"maintenance_mode":false,"app_version":"v1.0.0","up_to_date":true,"timezone":"Asia/Manila"}','u-admin-1','2026-11-18 09:00:00'),
('backup','{"schedule":"nightly","retain_points":4}','u-admin-1','2026-11-16 02:00:00'),
('legal','{"terms":"1. Using STUDIA - provided by OMSU Mamburao Campus for learning and academic activities.","privacy":"STUDIA collects only the account and academic data needed to run classes, lessons and AI features for OMSU Mamburao Campus. Data is never sold or shared outside the university."}','u-admin-1','2026-11-18 09:00:00'),
('ai','{"summarizer":true,"planner":true,"quiz_synthesizer":true,"chat":true,"language":"English","daily_request_limit":5000}','u-admin-1','2026-11-18 09:00:00');

-- --- Audit log -------------------------------------------------------------
INSERT INTO audit_log (id, actor_id, actor_name, action, summary, target_type, target_ids, ip, logged_at) VALUES
('log-1','u-admin-1','OMSU Administrator','create','Published announcement "Midterm examination schedule".','platform_announcement','["sysann-1"]','203.177.42.10','2026-11-18 08:00:00'),
('log-2','u-admin-1','OMSU Administrator','settings','Updated Email and OTP settings.','settings','["email"]','203.177.42.10','2026-11-18 09:00:00'),
('log-3','u-admin-1','OMSU Administrator','security','Changed the admin password.','user','["u-admin-1"]','203.177.42.10','2026-11-17 10:00:00'),
('log-4','u-admin-1','OMSU Administrator','update','Disabled the AI chat feature.','settings','["ai"]','203.177.42.10','2026-11-16 13:00:00'),
('log-5','u-admin-1','OMSU Administrator','delete','Deleted 1 content item from IT 321.','material','["l0-removed"]','203.177.42.10','2026-11-15 08:00:00'),
('log-6','u-admin-1','OMSU Administrator','settings','Ran a manual backup.','backup','["bkp-1"]','203.177.42.10','2026-11-16 02:00:00'),
('log-7','u-admin-1','OMSU Administrator','security','Revoked a session on Chrome - Windows.','session','["sess-old-1"]','203.177.42.10','2026-11-12 09:00:00');

-- --- Sessions --------------------------------------------------------------
-- token_hash values are placeholders: a real row holds the SHA-256 of a token
-- that only the client has.
INSERT INTO sessions (id, user_id, token_hash, device, browser, platform, ip, location, created_at, last_active_at, expires_at) VALUES
('sess-1','u-admin-1','seed-placeholder-hash-1','Windows PC','Chrome 131','web','203.177.42.10','Mamburao, Occidental Mindoro','2026-11-20 08:00:00','2026-11-20 08:00:00','2026-11-20 08:20:00'),
('sess-2','u-admin-1','seed-placeholder-hash-2','iPhone','Safari 18','web','110.54.128.77','San Jose, Occidental Mindoro','2026-11-18 19:00:00','2026-11-19 07:00:00','2026-11-19 07:20:00'),
('sess-3','u-seed-1','seed-placeholder-hash-3','Android phone',NULL,'android','49.145.12.233','Mamburao, Occidental Mindoro','2026-11-20 07:00:00','2026-11-20 07:10:00','2026-12-20 07:00:00'),
('sess-4','u-seed-2','seed-placeholder-hash-4','iPhone',NULL,'ios','112.198.90.4','Mamburao, Occidental Mindoro','2026-11-20 06:30:00','2026-11-20 06:40:00','2026-12-20 06:30:00');

-- --- Login attempts -------------------------------------------------------
INSERT INTO login_attempts (id, identifier, user_id, role, success, locked, ip, attempted_at) VALUES
('att-1','admin@omsu.edu.ph','u-admin-1','admin',1,0,'203.177.42.10','2026-11-20 08:00:00'),
('att-2','admin@omsu.edu.ph','u-admin-1','admin',0,0,'58.69.201.14','2026-11-19 22:00:00'),
('att-3','admin@omsu.edu.ph','u-admin-1','admin',0,0,'58.69.201.14','2026-11-19 22:01:00'),
('att-4','admin',NULL,'admin',1,0,'110.54.128.77','2026-11-18 07:00:00'),
('att-5','administrator@omsu.edu.ph',NULL,'admin',0,0,'202.90.4.55','2026-11-16 10:00:00'),
('att-6','admin@omsu.edu.ph','u-admin-1','admin',0,1,'202.90.4.55','2026-11-16 10:05:00'),
('att-7','root',NULL,NULL,0,0,'41.223.9.88','2026-11-12 03:00:00'),
('att-8','student@omsc.edu.ph','u-seed-1','student',1,0,'49.145.12.233','2026-11-20 07:00:00'),
('att-9','instructor@omsc.edu.ph','u-seed-2','instructor',1,0,'112.198.90.4','2026-11-20 06:30:00');

-- --- Backups --------------------------------------------------------------
INSERT INTO backup_runs (id, started_at, finished_at, size_bytes, ok, note, triggered_by) VALUES
('bkp-1','2026-11-16 02:00:00','2026-11-16 02:18:00',1932735283,1,NULL,'u-admin-1'),
('bkp-2','2026-11-09 02:00:00','2026-11-09 02:16:00',1825361100,1,NULL,NULL),
('bkp-3','2026-11-02 02:00:00','2026-11-02 02:15:00',1717986918,1,'2 large video files skipped.',NULL),
('bkp-4','2026-10-26 02:00:00','2026-10-26 02:14:00',1717986918,1,NULL,NULL);

-- --- Security findings ----------------------------------------------------
INSERT INTO security_findings (id, title, category, severity, description, recommendation, detected_at) VALUES
('vuln-1','Dependencies are out of date','Dependencies','medium','One or more packages have a newer release with a security fix.','Run npm outdated in each sub-project, upgrade the flagged packages, then rebuild.','2026-11-20 02:00:00'),
('vuln-2','HTTPS is not yet enforced for the API','Transport security','high','The API is reachable over plain HTTP in development; production must redirect and send HSTS.','Terminate TLS at the web server and send Strict-Transport-Security.','2026-11-20 02:00:00'),
('vuln-3','Upload content type is not sniffed server-side','File uploads','high','Only the file extension is checked today; the real content type is not verified.','Check magic bytes in the PHP API before storing an upload, and store under a server-generated name.','2026-11-20 02:00:00'),
('vuln-4','Content-Security-Policy is a meta tag only','CSP','medium','frame-ancestors is ignored in a meta tag, so clickjacking protection is incomplete.','Send the same policy as a response header from the web server.','2026-11-20 02:00:00'),
('vuln-5','OTP policy matches the agreed standard','OTP policy','low','Codes are 6 digits, hashed, single-use and expire after 5 minutes.','Confirm the backend never logs the plain code and that devCode is absent in production.','2026-11-20 02:00:00'),
('vuln-6','Last backup is recent','Backup age','low','The most recent backup completed within the expected window.','Alert if a backup is more than 48 hours old.','2026-11-20 02:00:00');

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
--  END. 36 tables, one database, both clients.
--  Read SCHEMA-AUDIT.md next: it lists every place the mobile app and the
--  admin portal disagree today and which side this file follows.
-- ============================================================================
