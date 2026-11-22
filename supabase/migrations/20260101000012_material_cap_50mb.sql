-- 012: material upload cap 40 MB -> 50 MB, matching the mobile client (MATERIAL_FILE_POLICY) and the
-- Supabase free plan's hard 50 MB per-file limit. There is no margin above this on the free plan.
-- 50 * 1024 * 1024 = 52428800 bytes.
update storage.buckets set file_size_limit = 52428800 where id = 'materials';

update public.settings
   set data = jsonb_set(data, '{max_material_size_mb}', '50'::jsonb)
 where section = 'uploads';
