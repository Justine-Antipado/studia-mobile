-- 015 user avatars: a profile photo per user, stored in a PRIVATE bucket and shown through
-- short-lived signed URLs (the same pattern as materials and submissions).
--
--   users.avatar_path   object path inside the 'avatars' bucket, always '<user id>/<generated name>'
--   avatars bucket      2 MB per file, JPEG or PNG only
--
-- Who writes it: ONLY the API (service role). `avatar_path` is deliberately not in the column
-- grants of migration 001, so a signed-in client cannot point its row at someone else's object.
-- The API must, on POST /me/avatar: sniff the real content type (not the header or file name),
-- re-encode or strip metadata, store under a generated name in the caller's own folder, delete the
-- previous object, then set avatar_path. DELETE /me/avatar removes the object and nulls the column.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

alter table public.users
  add column avatar_path text;

alter table public.users
  add constraint users_avatar_path_owner check (
    avatar_path is null
    or (char_length(avatar_path) <= 200 and avatar_path like (id::text || '/%') and avatar_path !~ '\.\.')
  );
