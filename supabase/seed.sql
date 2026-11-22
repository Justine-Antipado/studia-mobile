-- Defaults only. Sample/migrated data comes from supabase/seed/csv via scripts/ (Phase 1B).
-- updated_by is NULL here: the admin row does not exist until the import script creates it.
insert into public.settings (section, data) values
  ('term',            '{"school_year":"2026-2027","semester":"1st Semester","start_date":"2026-08-11","end_date":"2026-12-18"}'),
  ('email',           '{"sender_email":"studia.noreply2026@gmail.com","otp_expiry_minutes":5,"require_otp_for_reset":true,"resend_seconds":30}'),
  ('security_policy', '{"min_password_length":8,"require_uppercase":true,"require_lowercase":true,"require_number":true,"require_symbol":true,"max_password_length":64,"session_timeout_minutes":20,"max_login_attempts":5,"lockout_minutes":1}'),
  ('uploads',         '{"allowed_types":["pdf","doc","docx","ppt","pptx","mp4","mov","jpg","jpeg","png"],"max_material_size_mb":40,"max_submission_size_mb":50,"storage_quota_gb":50,"max_file_name_length":120}'),
  ('system',          '{"maintenance_mode":false,"maintenance":{"enabled":false,"scope":"all","roles":[],"features":[],"message":"","starts_at":null,"ends_at":null},"app_version":"v1.0.0","up_to_date":true,"timezone":"Asia/Manila"}'),
  ('backup',          '{"schedule":"nightly","retain_points":4}'),
  ('legal',           '{"terms":"1. Using STUDIA - provided by OMSU Mamburao Campus for learning and academic activities.","privacy":"STUDIA collects only the account and academic data needed to run classes, lessons and AI features for OMSU Mamburao Campus. Data is never sold or shared outside the university."}'),
  ('ai',              '{"summarizer":true,"planner":true,"quiz_synthesizer":true,"chat":true,"language":"English","daily_request_limit":5000}')
on conflict (section) do nothing;
