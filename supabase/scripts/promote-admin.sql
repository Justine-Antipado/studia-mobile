-- Promote one existing Auth user to THE Studia administrator.
--
-- Why a script and not a migration/seed: `private.handle_new_user` deliberately never grants
-- 'admin' from signup metadata (migration 009), so the single admin has to be promoted by hand,
-- once per environment, by someone holding database access.
--
-- How to run (studia-dev first, then prod):
--   1. Supabase Dashboard > Authentication > Users > "Add user" > Create new user.
--      Email: the address below. Password: the admin password. Tick "Auto Confirm User".
--   2. Dashboard > SQL Editor > paste this file > Run. It is idempotent.
--   3. Sign in at the admin site; then change the password from Google/Supabase, not from here.
--
-- Change v_email if the admin address ever changes. `users_email_domain` exempts role = 'admin',
-- so the address does not have to be @gmail.com / @omsu.edu.ph.
do $$
declare
  v_email text := lower(btrim('studia.noreply2026@gmail.com'));
  v_name  text := 'Studia Administrator';
  v_id    uuid;
begin
  select id into v_id from auth.users where lower(btrim(email)) = v_email;
  if v_id is null then
    raise exception
      'No auth user for %. Create it in Authentication > Users (Auto Confirm) before running this.', v_email;
  end if;

  insert into public.users (id, role, full_name, email, username, auth_provider,
                            status, profile_completed)
  values (v_id, 'admin', v_name, v_email, 'admin', 'password', 'active', true)
  on conflict (id) do update
     set role               = 'admin',
         username           = 'admin',
         email              = excluded.email,
         status             = 'active',
         profile_completed  = true,
         deleted_at         = null,
         failed_login_count = 0,   -- clear any lockout left by failed attempts
         locked_until       = null;

  raise notice 'Admin ready: % (%).', v_email, v_id;
end $$;

-- Verify (expect exactly one row, role = admin, status = active):
select id, email, username, role, status, profile_completed
from public.users
where role = 'admin';
