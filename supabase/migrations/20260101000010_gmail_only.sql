-- 010 gmail only: the campus owns no mail domain, so every NEW account must be @gmail.com.
-- The Auth "Before User Created" hook is the server-side gate (email signup AND Google sign-in).
-- Existing seeded demo users (@omsu.edu.ph, not real mailboxes) stay valid for password login, so the
-- table constraint is left as widened in 009; nobody can create or sign up a new non-Gmail account.
create or replace function private.hook_before_user_created(event jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(event -> 'user' ->> 'email', '')));
begin
  if v_email ~ '^[a-z0-9._+-]{1,64}@gmail\.com$' then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'message', 'Use a Gmail (@gmail.com) email address.',
    'http_code', 400));
end $$;
