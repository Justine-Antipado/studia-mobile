-- Two instructors, three students (+1 deactivated), one admin; every table gets rows in two separate classes.
-- ids: admin ...01, instructors ...11/12, students ...21 (S1, enrolled c1) ...22 (S2, enrolled c2) ...23 (S3, none) ...24 (SX, inactive, c1)
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
 ('a0000000-0000-0000-0000-000000000001','admin@omsu.edu.ph','{"full_name":"Admin"}','{}'),
 ('a0000000-0000-0000-0000-000000000011','i1@omsu.edu.ph','{"full_name":"Inst One","role":"instructor"}','{}'),
 ('a0000000-0000-0000-0000-000000000012','i2@omsu.edu.ph','{"full_name":"Inst Two","role":"instructor"}','{}'),
 ('a0000000-0000-0000-0000-000000000021','s1@omsu.edu.ph','{"full_name":"Stud One"}','{}'),
 ('a0000000-0000-0000-0000-000000000022','s2@omsu.edu.ph','{"full_name":"Stud Two"}','{}'),
 ('a0000000-0000-0000-0000-000000000023','s3@omsu.edu.ph','{"full_name":"Stud Three"}','{}'),
 ('a0000000-0000-0000-0000-000000000024','sx@omsu.edu.ph','{"full_name":"Stud Gone"}','{}');
-- admin is granted by the service role only (never by metadata); the campus-domain check exempts admin
update public.users set role = 'admin' where id = 'a0000000-0000-0000-0000-000000000001';
update public.users set course = 'BSIT' where id in ('a0000000-0000-0000-0000-000000000021','a0000000-0000-0000-0000-000000000022','a0000000-0000-0000-0000-000000000024');
update public.users set course = 'BSBA-FM' where id = 'a0000000-0000-0000-0000-000000000023';
update public.users set status = 'inactive' where id = 'a0000000-0000-0000-0000-000000000024';

insert into public.classes (id, subject_code, title, instructor_id, course, year_level, section, join_code) values
 ('c1','IT101','Intro','a0000000-0000-0000-0000-000000000011','BSIT','1','A','AAAAAA'),
 ('c2','IT102','Other','a0000000-0000-0000-0000-000000000012','BSIT','1','B','BBBBBB');
insert into public.class_enrollments (id, class_id, student_id) values
 ('e1','c1','a0000000-0000-0000-0000-000000000021'),
 ('e2','c2','a0000000-0000-0000-0000-000000000022'),
 ('e3','c1','a0000000-0000-0000-0000-000000000024');
insert into public.announcements (id, class_id, author_id, title, body) values
 ('an1','c1','a0000000-0000-0000-0000-000000000011','t','b'),
 ('an2','c2','a0000000-0000-0000-0000-000000000012','t','b');
insert into public.announcement_comments (id, announcement_id, author_id, body) values
 ('cm1','an1','a0000000-0000-0000-0000-000000000021','hi'),
 ('cm2','an2','a0000000-0000-0000-0000-000000000022','hi');

insert into public.files (id, original_name, bucket, object_path, kind, extension, mime_type, size_bytes, uploaded_by) values
 ('f1','a.pdf','materials','p/f1','pdf','pdf','application/pdf',1,'a0000000-0000-0000-0000-000000000011'),
 ('f2','b.pdf','submissions','p/f2','pdf','pdf','application/pdf',1,'a0000000-0000-0000-0000-000000000021'),
 ('f3','c.pdf','materials','p/f3','pdf','pdf','application/pdf',1,'a0000000-0000-0000-0000-000000000012'),
 ('f4','d.pdf','submissions','p/f4','pdf','pdf','application/pdf',1,'a0000000-0000-0000-0000-000000000023');
insert into public.materials (id, class_id, title, kind, file_id, processing, owner_id) values
 ('m1','c1','Lesson 1','pdf','f1','ready','a0000000-0000-0000-0000-000000000011'),
 ('m1p','c1','Lesson 2','pdf',null,'processing','a0000000-0000-0000-0000-000000000011'),
 ('m2','c2','Lesson X','pdf','f3','ready','a0000000-0000-0000-0000-000000000012');
insert into public.material_transcript_lines (id, material_id, start_sec, body) values
 ('t1','m1',0,'x'),('t1p','m1p',0,'x');
insert into public.material_objectives (id, material_id, body) values ('o1','m1','obj');
insert into public.material_summaries (id, material_id, mode, tldr) values ('sum1','m1','tldr','short');
insert into public.material_views (id, material_id, student_id) values ('v1','m1','a0000000-0000-0000-0000-000000000021');

insert into public.assignments (id, class_id, title, due_at, points, created_by) values
 ('a1','c1','HW1', now() + interval '7 day', 10,'a0000000-0000-0000-0000-000000000011'),
 ('a2','c2','HW2', now() + interval '7 day', 10,'a0000000-0000-0000-0000-000000000012');
insert into public.assignment_attachments (assignment_id, file_id) values ('a1','f1');
insert into public.assignment_submissions (id, assignment_id, student_id, file_id) values
 ('asub1','a1','a0000000-0000-0000-0000-000000000021','f2'),
 ('asub2','a2','a0000000-0000-0000-0000-000000000022',null);

-- question + options + key must share one transaction (deferred integrity trigger)
begin;
insert into public.quizzes (id, class_id, title, status, published_at, max_attempts, created_by) values
 ('q1','c1','Quiz 1','published', now(), 2,'a0000000-0000-0000-0000-000000000011'),
 ('q1d','c1','Quiz draft','draft', null, 1,'a0000000-0000-0000-0000-000000000011'),
 ('q2','c2','Quiz 2','published', now(), 1,'a0000000-0000-0000-0000-000000000012');
insert into public.quiz_questions (id, quiz_id, position, type, prompt) values
 ('qq1','q1',0,'multiple_choice','Pick'),('qq1b','q1',1,'identification','Capital?'),
 ('qq1d','q1d',0,'essay','Discuss'),('qq2','q2',0,'multiple_choice','Pick');
insert into public.quiz_options (id, question_id, position, body) values
 ('qo1a','qq1',0,'A'),('qo1b','qq1',1,'B'),('qo2a','qq2',0,'A'),('qo2b','qq2',1,'B');
insert into public.quiz_question_keys (question_id, correct_index, correct_answer, rationale) values
 ('qq1',1,null,'because'),('qq1b',null,'Paris','because'),('qq1d',null,null,'rubric'),('qq2',0,null,'because');
commit;
insert into public.quiz_attempts (id, quiz_id, student_id, attempt_no) values
 ('att1','q1','a0000000-0000-0000-0000-000000000021',1),
 ('att2','q2','a0000000-0000-0000-0000-000000000022',1);
insert into public.quiz_answers (id, attempt_id, question_id, response_index) values ('ans1','att1','qq1',0);

insert into public.student_task_overrides (id, student_id, kind, ref_id, done) values
 ('to1','a0000000-0000-0000-0000-000000000021','assignment','a1',true);
insert into public.planner_weeks (id, student_id, week_start) values
 ('pw1','a0000000-0000-0000-0000-000000000021','2026-11-16'),('pw2','a0000000-0000-0000-0000-000000000022','2026-11-16');
insert into public.planner_blocks (id, week_id, day_date, start_hour, title) values
 ('pb1','pw1','2026-11-17',9,'Study'),('pb2','pw2','2026-11-17',9,'Study');
insert into public.planner_exams (id, student_id, title, exam_date) values
 ('pe1','a0000000-0000-0000-0000-000000000021','Midterm','2026-12-01'),('pe2','a0000000-0000-0000-0000-000000000022','Midterm','2026-12-01');
insert into public.notifications (id, user_id, kind, title) values
 ('n1','a0000000-0000-0000-0000-000000000021','notice','t'),('n2','a0000000-0000-0000-0000-000000000011','notice','t'),
 ('n3','a0000000-0000-0000-0000-000000000022','notice','t');
insert into public.platform_announcements (id, author_id, title, body, audience, course, status, scheduled_at, published_at) values
 ('pa1','a0000000-0000-0000-0000-000000000001','t','b','all',null,'published',null,now()),
 ('pa2','a0000000-0000-0000-0000-000000000001','t','b','instructors',null,'published',null,now()),
 ('pa3','a0000000-0000-0000-0000-000000000001','t','b','students',null,'published',null,now()),
 ('pa4','a0000000-0000-0000-0000-000000000001','t','b','course','BSIT','published',null,now()),
 ('pa5','a0000000-0000-0000-0000-000000000001','t','b','course','BEED','published',null,now()),
 ('pa6','a0000000-0000-0000-0000-000000000001','t','b','all',null,'scheduled', now() + interval '1 day',null);

insert into public.ai_requests (id, user_id, feature) values
 ('ar1','a0000000-0000-0000-0000-000000000021','chat'),('ar2','a0000000-0000-0000-0000-000000000011','planner');
insert into public.ai_chat_messages (id, user_id, thread_id, sender, body) values
 ('ch1','a0000000-0000-0000-0000-000000000021','th1','user','hi'),('ch2','a0000000-0000-0000-0000-000000000022','th2','user','hi');
insert into public.settings (section, data) values
 ('term','{}'),('uploads','{}'),('ai','{}'),('backup','{}'),('system','{}');
insert into public.audit_log (id, actor_name, action, summary) values ('au1','admin','create','x');
insert into public.backup_runs (id) values ('bk1');
insert into public.security_findings (id, title, category, severity, description, recommendation) values ('sf1','t','c','low','d','r');
insert into public.idempotency_keys (idem_key, user_id, endpoint) values ('idem-key-0001','a0000000-0000-0000-0000-000000000021','/x');
insert into public.otp_codes (id, email, purpose, code_hash, expires_at) values ('ot1','s1@omsu.edu.ph','signup','h', now() + interval '5 min');
insert into public.auth_tokens (id, email, kind, token_hash, expires_at) values ('at1','s1@omsu.edu.ph','reset','h', now() + interval '5 min');
insert into public.login_attempts (id, identifier) values ('la1','s1@omsu.edu.ph');
insert into public.sessions (id, user_id, token_hash, expires_at) values
 ('se1','a0000000-0000-0000-0000-000000000021','h1', now() + interval '1 day'),
 ('se2','a0000000-0000-0000-0000-000000000022','h2', now() + interval '1 day');
