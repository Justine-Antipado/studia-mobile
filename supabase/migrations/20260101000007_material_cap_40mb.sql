-- 007: material upload cap 500 MB -> 40 MB (fits the Supabase free plan's 50 MB per-file limit).
-- 40 * 1024 * 1024 = 41943040 bytes.
update storage.buckets set file_size_limit = 41943040 where id = 'materials';

update public.settings
   set data = jsonb_set(data, '{max_material_size_mb}', '40'::jsonb)
 where section = 'uploads';
