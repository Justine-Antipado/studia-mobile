-- 018: stream new notifications to the signed-in user's app (Supabase Realtime respects RLS, so a
-- user only receives their own rows via notif_select).
alter publication supabase_realtime add table public.notifications;
